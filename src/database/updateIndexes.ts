import * as _ from "lodash"
import { Tuple3 } from "./triplestore"
import {
	IndexerPlan,
	indexers,
	prettyRemoveIndexerPlan,
	prettySetIndexerPlan,
	DerivedIndex,
} from "./defineIndex"
import { ReadOnlyStorage, Transaction, isValue, Tuple } from "./storage"
import { generateListenKeys } from "./factListenerHelpers"
import { indentText, getIndentOfLastLine } from "../helpers/printHelpers"
import {
	prettyExpression,
	Expression,
	Binding,
	getAndExpressionPlan,
	evaluateAndExpressionPlan,
	VariableSort,
	AndExpressionReport,
	OrExpressionReport,
	prettyAndExpressionReport,
	prettyOrExpressionReport,
} from "./query"

type OpType = "set" | "remove"

export type UpdateIndexesPlan = {
	opType: OpType
	fact: Tuple3
	indexerPlans: Array<IndexerPlan>
}

export function getUpdateIndexesPlan(
	storage: ReadOnlyStorage,
	opType: OpType,
	fact: Tuple3
) {
	const updateIndexesPlan: UpdateIndexesPlan = {
		fact,
		opType,
		indexerPlans: [],
	}
	const listenKeys = generateListenKeys(fact)
	for (const listenKey of listenKeys) {
		const indexerResults = storage.scan(indexers, {
			start: [listenKey],
			end: [listenKey],
		})
		for (const [_listenKey, jsonIndexerPlanArgs] of indexerResults) {
			const args: IndexerPlan["args"] = JSON.parse(
				jsonIndexerPlanArgs as string
			)
			const indexerPlan: IndexerPlan = { listenKey, args }

			updateIndexesPlan.indexerPlans.push(indexerPlan)
		}
	}
	return updateIndexesPlan
}

export type IndexerReport = {
	index: DerivedIndex
	querySort: VariableSort
	expression: Expression
	restAndExpressionReport: AndExpressionReport
	restOrExpressionReport: OrExpressionReport
	write: { set: Array<Tuple>; remove: Array<Tuple> }
}

export type UpdateIndexesReport = {
	opType: OpType
	fact: Tuple3
	indexerReports: Array<IndexerReport>
}

export function evaluateUpdateIndexesPlan(
	transaction: Transaction,
	updateIndexesPlan: UpdateIndexesPlan
): UpdateIndexesReport {
	const { fact, opType, indexerPlans } = updateIndexesPlan

	const updateIndexesReport: UpdateIndexesReport = {
		fact,
		opType,
		indexerReports: [],
	}

	for (const indexerPlan of indexerPlans) {
		const {
			querySort,
			index,
			expression,
			restAndExpression,
			restOrExpression,
		} = indexerPlan.args

		const binding = getBindingFromIndexListener(expression, fact)
		const andExpressionPlan = getAndExpressionPlan(restAndExpression, binding)
		const {
			bindings: partialBindings,
			report: restAndExpressionReport,
		} = evaluateAndExpressionPlan(transaction, andExpressionPlan)

		const indexerReport: IndexerReport = {
			index,
			querySort,
			expression,
			restAndExpressionReport,
			restOrExpressionReport: [],
			write: { set: [], remove: [] },
		}

		for (const partialBinding of partialBindings) {
			const fullBinding = { ...partialBinding, ...binding }
			const tuple = querySort.map(([unknown]) => fullBinding[unknown.var])
			if (opType === "set") {
				// If we're adding to an index then we can add right now and it will get
				// deduped with any results from the other AndExpressions that are part
				// of the Or.
				transaction.set(index, tuple)
				indexerReport.write.set.push(tuple)
			} else {
				// If we're removing, we need to check that this tuple doesn't satisfy any
				// of the other AndExpressions in the Or.
				let existsInOtherExpression = false
				for (const andExpression of restOrExpression) {
					const { bindings: result, report } = evaluateAndExpressionPlan(
						transaction,
						getAndExpressionPlan(andExpression, fullBinding)
					)
					indexerReport.restOrExpressionReport.push(report)
					existsInOtherExpression = result.length > 0
					if (existsInOtherExpression) {
						break
					}
				}
				if (!existsInOtherExpression) {
					transaction.remove(index, tuple)
					indexerReport.write.remove.push(tuple)
				}
			}
		}

		// Collapse reports together and remove the binding.
		indexerReport.restOrExpressionReport = collapseAndExpressionReports(
			indexerReport.restOrExpressionReport
		)

		updateIndexesReport.indexerReports.push(indexerReport)
	}

	return updateIndexesReport
}

export function updateIndexes(
	transaction: Transaction,
	opType: OpType,
	fact: Tuple3
) {
	return evaluateUpdateIndexesPlan(
		transaction,
		getUpdateIndexesPlan(transaction, opType, fact)
	)
}

function getBindingFromIndexListener(expression: Expression, fact: Tuple3) {
	const binding: Binding = {}
	for (let i = 0; i < expression.length; i++) {
		const elm = expression[i]
		if (!isValue(elm)) {
			binding[elm.var] = fact[i]
		}
	}
	return binding
}

export function prettyUpdateIndexesPlan(updateIndexesPlan: UpdateIndexesPlan) {
	const { fact, opType, indexerPlans } = updateIndexesPlan
	const indexerUpdates = indexerPlans
		.map(indexerPlan => {
			const plan =
				opType === "set"
					? prettySetIndexerPlan(indexerPlan)
					: prettyRemoveIndexerPlan(indexerPlan)
			return [
				`INDEXER ${prettyExpression(
					indexerPlan.args.expression
				)} ${JSON.stringify(indexerPlan.args.index.name)}`,
				indentText(plan),
			].join("\n")
		})
		.join("\n")

	return [
		`${opType.toUpperCase()} ${prettyExpression(fact)}`,
		indentText(indexerUpdates),
	].join("\n")
}

export function prettyUpdateIndexesReport(
	updateIndexesReport: UpdateIndexesReport
) {
	const { fact, opType, indexerReports } = updateIndexesReport
	const indexerUpdates = indexerReports
		.map(indexerReport => {
			let andReport = indentText(
				prettyAndExpressionReport(indexerReport.restAndExpressionReport)
			)

			return _.compact([
				`INDEXER ${prettyExpression(indexerReport.expression)} ${JSON.stringify(
					indexerReport.index.name
				)}`,
				andReport,
				indexerReport.restOrExpressionReport.length &&
					indentText(
						prettyOrExpressionReport(indexerReport.restOrExpressionReport),
						getIndentOfLastLine(andReport) + 1
					),
			]).join("\n")
		})
		.join("\n")

	return [
		`${opType.toUpperCase()} ${prettyExpression(fact)}`,
		indentText(indexerUpdates),
	].join("\n")
}

function collapseAndExpressionReports(
	andExpressionReports: Array<AndExpressionReport>
) {
	// Given a a bunch of bound recursive AndExpressionReports, remove the
	// binding and collapse them into a single report.
	return andExpressionReports.reduce<OrExpressionReport>(
		(reports, nextReport) => {
			for (const report of reports) {
				if (
					_.isEqual(
						nextReport.expressionReports.map(({ plan }) => plan),
						report.expressionReports.map(({ plan }) => plan)
					)
				) {
					for (let i = 0; i < report.expressionReports.length; i++) {
						report.expressionReports[i].evaluationCount +=
							nextReport.expressionReports[i].evaluationCount
						report.expressionReports[i].resultCount +=
							nextReport.expressionReports[i].resultCount
					}
					return reports
				}
			}
			const { expressionReports } = nextReport
			reports.push({ bind: {}, expressionReports })
			return reports
		},
		[]
	)
}
