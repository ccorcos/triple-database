import { Transaction } from "tuple-database/storage/types"
import {
	OrExpressionPlan,
	VariableSort,
	getOrExpressionPlan,
	prettyOrExpressionPlan,
	OrExpressionReport,
	evaluateOrExpressionPlan,
	prettyOrExpressionReport,
} from "./query"
import { DefineIndexArgs } from "./defineIndex"
import { indentCascade } from "../helpers/printHelpers"

export type PopulateIndexPlan = {
	index: DefineIndexArgs
	orExpressionPlan: OrExpressionPlan
	sort: VariableSort
}

export function getPopulateIndexPlan(
	index: DefineIndexArgs
): PopulateIndexPlan {
	const { filter, sort } = index
	return { index, sort, orExpressionPlan: getOrExpressionPlan(filter) }
}

export function prettyPopulateIndexPlan(populateIndexPlan: PopulateIndexPlan) {
	return indentCascade([
		`POPULATE ${JSON.stringify(populateIndexPlan.index.index)} ${JSON.stringify(
			populateIndexPlan.sort
		)}`,
		prettyOrExpressionPlan(populateIndexPlan.orExpressionPlan),
	])
}

export type PopulateIndexReport = {
	index: DefineIndexArgs
	orExpressionReport: OrExpressionReport
	sort: VariableSort
}

export function evaluatePopulateIndexPlan(
	transaction: Transaction,
	populateIndexPlan: PopulateIndexPlan
) {
	const { index, orExpressionPlan, sort } = populateIndexPlan
	const { report: orExpressionReport, bindings } = evaluateOrExpressionPlan(
		transaction,
		orExpressionPlan
	)

	for (const binding of bindings) {
		const tuple = sort.map((variable) => binding[variable.var])
		transaction.set("index", tuple)
	}
	const report: PopulateIndexReport = {
		index,
		orExpressionReport,
		sort,
	}
	return report
}

export function prettyPopulateIndexReport(
	populateIndexReport: PopulateIndexReport
) {
	return indentCascade([
		`POPULATE ${JSON.stringify(
			populateIndexReport.index.index
		)} ${JSON.stringify(populateIndexReport.sort)}`,
		prettyOrExpressionReport(populateIndexReport.orExpressionReport),
	])
}

export function populateIndex(
	transaction: Transaction,
	index: DefineIndexArgs
) {
	const plan = getPopulateIndexPlan(index)
	return evaluatePopulateIndexPlan(transaction, plan)
}
