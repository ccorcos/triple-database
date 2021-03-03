import * as _ from "lodash"
import {
	Transaction,
	ReadOnlyStorage,
	Tuple,
} from "tuple-database/storage/types"
import {
	OrExpression,
	Expression,
	AndExpression,
	Variable,
	isVariable,
	VariableSort,
	resolveUnknownsInAndExpression,
	getAndExpressionPlan,
	prettyAndExpressionPlan,
	prettyExpression,
} from "./query"
import { indentText, getIndentOfLastLine } from "../helpers/printHelpers"
import { getListenKey } from "./factListenerHelpers"

export type DefineIndexArgs = {
	index: string
	filter: OrExpression
	sort: VariableSort
}

export type DefineIndexPlan = DefineIndexArgs & {
	indexerPlans: Array<IndexerPlan>
}

export type IndexerPlan = {
	listenKey: Tuple
	args: {
		index: DefineIndexArgs
		/** For determining the var names */
		expression: Expression
		/* For evaluating the tuple to be added/removed */
		restAndExpression: AndExpression
		/* For checking if the tuple is redundant in another expression */
		restOrExpression: OrExpression
	}
}

export function getDefineIndexPlan(index: DefineIndexArgs): DefineIndexPlan {
	const orExpression = index.filter
	const indexerPlans = _.flatten(
		orExpression.map((andExpression) => {
			return andExpression.map((expression) => {
				// The rest of the andExpression that needs to be evaluated upon triggering
				// this indexer listener.
				const unknownsInExpression = getUnknownsInExpression(expression)
				const restAndExpression = resolveUnknownsInAndExpression(
					andExpression.filter((item) => item !== expression),
					unknownsInExpression
				)

				// Upon solving the entire andExpression, if we are removing a record from the
				// index, we need to check the rest of the orExpression to make sure that the
				// same result isn't redundant from the other queries.
				const unknownsInAndExpression = getUnknownsInAndExpression(
					andExpression
				)
				const restOrExpression = orExpression
					.filter((otherAndExpression) => otherAndExpression !== andExpression)
					.map((otherAndExpression) =>
						resolveUnknownsInAndExpression(
							otherAndExpression,
							unknownsInAndExpression
						)
					)

				const indexerPlan: IndexerPlan = {
					listenKey: getListenKey(expression),
					args: {
						index,
						expression,
						restAndExpression,
						restOrExpression,
					},
				}
				return indexerPlan
			})
		})
	)
	return { ...index, indexerPlans }
}

export function prettySetIndexerPlan(indexerPlan: IndexerPlan) {
	const { restAndExpression } = indexerPlan.args
	return prettyAndExpressionPlan(getAndExpressionPlan(restAndExpression))
}

export function prettyRemoveIndexerPlan(indexerPlan: IndexerPlan) {
	const { restOrExpression } = indexerPlan.args
	const andPlan = prettySetIndexerPlan(indexerPlan)
	if (restOrExpression.length === 0) {
		return andPlan
	}
	const orPlan = restOrExpression
		.map((andExpression) =>
			prettyAndExpressionPlan(getAndExpressionPlan(andExpression))
		)
		.join("\n")
	return [andPlan, indentText(orPlan, getIndentOfLastLine(andPlan) + 1)].join(
		"\n"
	)
}

export function prettyDefineIndexPlan(plan: DefineIndexPlan) {
	const indexersPlan = plan.indexerPlans.map((indexerPlan) => {
		return [
			`INDEXER ${prettyExpression(
				indexerPlan.args.expression
			)} ${JSON.stringify(indexerPlan.args.index.index)}`,
			`\tSET`,
			indentText(prettySetIndexerPlan(indexerPlan), 2),
			`\tREMOVE`,
			indentText(prettyRemoveIndexerPlan(indexerPlan), 2),
		].join("\n")
	})

	return indexersPlan.join("\n")
}

export function evaluateDefineIndexPlan(
	transaction: Transaction,
	plan: DefineIndexPlan
): DefineIndexArgs {
	transaction.set("indexes", [plan.index, plan])
	for (const indexer of plan.indexerPlans) {
		transaction.set("indexers", [indexer.listenKey, indexer.args])
	}
	return plan
}

export function defineIndex(transaction: Transaction, args: DefineIndexArgs) {
	return evaluateDefineIndexPlan(transaction, getDefineIndexPlan(args))
}

export function indexExists(storage: ReadOnlyStorage, plan: DefineIndexPlan) {
	return storage.scan("indexes", {
		gte: [plan.index, plan],
		lte: [plan.index, plan],
	}).length
}

function getUnknownsInExpression(expression: Expression): Array<Variable> {
	return _.uniqWith(expression.filter(isVariable), _.isEqual)
}

function getUnknownsInAndExpression(
	andExpression: AndExpression
): Array<Variable> {
	return _.uniqWith(
		_.flatten(andExpression.map(getUnknownsInExpression)),
		_.isEqual
	)
}
