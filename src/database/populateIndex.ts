// import { Transaction } from "./storage"
// import {
// 	OrExpressionPlan,
// 	VariableSort,
// 	getOrExpressionPlan,
// 	prettyOrExpressionPlan,
// 	OrExpressionReport,
// 	evaluateOrExpressionPlan,
// 	prettyOrExpressionReport,
// } from "./query"
// import { indexes, DefineIndexArgs, DerivedIndex } from "./defineIndex"
// import { indentCascade } from "../helpers/printHelpers"
// import * as json from "../helpers/json"

// export type PopulateIndexPlan = {
// 	index: DerivedIndex
// 	orExpressionPlan: OrExpressionPlan
// 	sort: VariableSort
// }

// export function getPopulateIndexPlan(index: DerivedIndex): PopulateIndexPlan {
// 	const { filter, sort }: DefineIndexArgs = index.args
// 	return { index, sort, orExpressionPlan: getOrExpressionPlan(filter) }
// }

// export function prettyPopulateIndexPlan(populateIndexPlan: PopulateIndexPlan) {
// 	return indentCascade([
// 		`POPULATE ${json.stringify(populateIndexPlan.index.name)} ${json.stringify(
// 			populateIndexPlan.sort
// 		)}`,
// 		prettyOrExpressionPlan(populateIndexPlan.orExpressionPlan),
// 	])
// }

// export type PopulateIndexReport = {
// 	index: DerivedIndex
// 	orExpressionReport: OrExpressionReport
// 	sort: VariableSort
// }

// export function evaluatePopulateIndexPlan(
// 	transaction: Transaction,
// 	populateIndexPlan: PopulateIndexPlan
// ) {
// 	const { index, orExpressionPlan, sort } = populateIndexPlan
// 	const { report: orExpressionReport, bindings } = evaluateOrExpressionPlan(
// 		transaction,
// 		orExpressionPlan
// 	)

// 	for (const binding of bindings) {
// 		const tuple = sort.map(([variable]) => binding[variable.var])
// 		transaction.set(index, tuple)
// 	}
// 	const report: PopulateIndexReport = {
// 		index,
// 		orExpressionReport,
// 		sort,
// 	}
// 	return report
// }

// export function prettyPopulateIndexReport(
// 	populateIndexReport: PopulateIndexReport
// ) {
// 	return indentCascade([
// 		`POPULATE ${json.stringify(
// 			populateIndexReport.index.name
// 		)} ${json.stringify(populateIndexReport.sort)}`,
// 		prettyOrExpressionReport(populateIndexReport.orExpressionReport),
// 	])
// }

// export function populateIndex(transaction: Transaction, index: DerivedIndex) {
// 	const plan = getPopulateIndexPlan(index)
// 	return evaluatePopulateIndexPlan(transaction, plan)
// }
