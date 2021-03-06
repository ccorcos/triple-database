import * as _ from "lodash"
import {
	IndexerPlan,
	prettyRemoveIndexerPlan,
	prettySetIndexerPlan,
	DefineIndexArgs,
} from "./defineIndex"
import { ReadOnlyStorage, Transaction } from "tuple-database/storage/types"
import { generateFactListenKeys } from "./factListenKeyHelpers"
import { indentText, getIndentOfLastLine } from "../helpers/printHelpers"
import {
	prettyExpression,
	Expression,
	Binding,
	getAndExpressionPlan,
	evaluateAndExpressionPlan,
	AndExpressionReport,
	OrExpressionReport,
	prettyAndExpressionReport,
	prettyOrExpressionReport,
	isVariable,
	prettyFact,
} from "./query"
import { Fact, Tuple, FactOperation, indexes } from "./types"
import { unreachable } from "../helpers/typeHelpers"

export type UpdateIndexesPlan = {
	operation: FactOperation
	indexerPlans: Array<IndexerPlan>
}

export function getUpdateIndexesPlan(
	storage: ReadOnlyStorage,
	operation: FactOperation
) {
	const updateIndexesPlan: UpdateIndexesPlan = {
		operation,
		indexerPlans: [],
	}
	const listenKeys = generateFactListenKeys(operation.fact)
	for (const listenKey of listenKeys) {
		const indexerResults = storage.scan(indexes.indexersByKey, {
			prefix: [listenKey],
		})
		for (const [_listenKey, elm] of indexerResults) {
			// TODO: don't cast, use `data-type-ts`.
			const indexerPlan = elm as IndexerPlan
			updateIndexesPlan.indexerPlans.push(indexerPlan)
		}
	}
	return updateIndexesPlan
}

export type IndexerReport = {
	index: DefineIndexArgs
	expression: Expression
	restAndExpressionReport: AndExpressionReport
	restOrExpressionReport: OrExpressionReport
	write: { set: Array<Tuple>; remove: Array<Tuple> }
}

export type UpdateIndexesReport = {
	operation: FactOperation
	indexerReports: Array<IndexerReport>
}

export function evaluateUpdateIndexesPlan(
	transaction: Transaction,
	updateIndexesPlan: UpdateIndexesPlan
): UpdateIndexesReport {
	const { operation, indexerPlans } = updateIndexesPlan

	const updateIndexesReport: UpdateIndexesReport = {
		operation,
		indexerReports: [],
	}

	for (const indexerPlan of indexerPlans) {
		const {
			index,
			expression,
			restAndExpression,
			restOrExpression,
		} = indexerPlan.args

		const binding = getBindingFromIndexListener(expression, operation.fact)
		const andExpressionPlan = getAndExpressionPlan(restAndExpression, binding)
		const {
			bindings: partialBindings,
			report: restAndExpressionReport,
		} = evaluateAndExpressionPlan(transaction, andExpressionPlan)

		const indexerReport: IndexerReport = {
			index,
			expression,
			restAndExpressionReport,
			restOrExpressionReport: [],
			write: { set: [], remove: [] },
		}

		for (const partialBinding of partialBindings) {
			const fullBinding = { ...partialBinding, ...binding }
			const tuple = index.sort.map((unknown) => fullBinding[unknown.var])
			if (operation.type === "set") {
				// If we're adding to an index then we can add right now and it will get
				// deduped with any results from the other AndExpressions that are part
				// of the Or.
				transaction.set(index.name, tuple)
				indexerReport.write.set.push(tuple)
			} else if (operation.type === "remove") {
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
					transaction.remove(index.name, tuple)
					indexerReport.write.remove.push(tuple)
				}
			} else {
				throw unreachable(operation)
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
	operation: FactOperation
) {
	return evaluateUpdateIndexesPlan(
		transaction,
		getUpdateIndexesPlan(transaction, operation)
	)
}

function getBindingFromIndexListener(expression: Expression, fact: Fact) {
	const binding: Binding = {}
	for (let i = 0; i < expression.length; i++) {
		const elm = expression[i]
		if (isVariable(elm)) {
			binding[elm.var] = fact[i]
		}
	}
	return binding
}

export function prettyUpdateIndexesPlan(updateIndexesPlan: UpdateIndexesPlan) {
	const { operation, indexerPlans } = updateIndexesPlan
	const indexerUpdates = indexerPlans
		.map((indexerPlan) => {
			const plan =
				operation.type === "set"
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
		`${operation.type.toUpperCase()} ${prettyFact(operation.fact)}`,
		indentText(indexerUpdates),
	].join("\n")
}

export function prettyUpdateIndexesReport(
	updateIndexesReport: UpdateIndexesReport
) {
	const { operation, indexerReports } = updateIndexesReport
	const indexerUpdates = indexerReports
		.map((indexerReport) => {
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
		`${operation.type.toUpperCase()} ${prettyFact(operation.fact)}`,
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
