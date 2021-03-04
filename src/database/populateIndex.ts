import { Transaction } from "tuple-database/storage/types"
import {
	OrExpressionPlan,
	Sort,
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
}

export function getPopulateIndexPlan(
	index: DefineIndexArgs
): PopulateIndexPlan {
	const { filter } = index
	return { index, orExpressionPlan: getOrExpressionPlan(filter) }
}

export function prettyPopulateIndexPlan(populateIndexPlan: PopulateIndexPlan) {
	return indentCascade([
		`POPULATE ${JSON.stringify(populateIndexPlan.index.name)} ${JSON.stringify(
			populateIndexPlan.index.sort
		)}`,
		prettyOrExpressionPlan(populateIndexPlan.orExpressionPlan),
	])
}

export type PopulateIndexReport = {
	index: DefineIndexArgs
	orExpressionReport: OrExpressionReport
}

export function evaluatePopulateIndexPlan(
	transaction: Transaction,
	populateIndexPlan: PopulateIndexPlan
) {
	const { index, orExpressionPlan } = populateIndexPlan
	const { report: orExpressionReport, bindings } = evaluateOrExpressionPlan(
		transaction,
		orExpressionPlan
	)

	for (const binding of bindings) {
		const tuple = index.sort.map((variable) => binding[variable.var])
		transaction.set(index.name, tuple)
	}
	const report: PopulateIndexReport = {
		index,
		orExpressionReport,
	}
	return report
}

export function prettyPopulateIndexReport(
	populateIndexReport: PopulateIndexReport
) {
	return indentCascade([
		`POPULATE ${JSON.stringify(
			populateIndexReport.index.name
		)} ${JSON.stringify(populateIndexReport.index.sort)}`,
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
