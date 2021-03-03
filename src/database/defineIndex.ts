import * as _ from "lodash"
import { Transaction, Index, Sort, ReadOnlyStorage } from "./storage"
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
import * as json from "../helpers/json"
import { indentText, getIndentOfLastLine } from "../helpers/printHelpers"
import { getListenKey } from "./factListenerHelpers"
import { randomId } from "../helpers/randomId"

export type DefineIndexArgs = {
	filter: OrExpression
	sort: VariableSort
}

export const indexes: Index = {
	name: "indexes",
	sort: [1, 1],
}

export const indexers: Index = {
	name: "indexers",
	sort: [1, 1],
}

export type DerivedIndex = {
	name: string
	sort: Sort
	args: DefineIndexArgs
}

export type DefineIndexPlan = {
	index: DerivedIndex
	args: DefineIndexArgs
	indexerPlans: Array<IndexerPlan>
}

export type IndexerPlan = {
	listenKey: string
	args: {
		index: DerivedIndex
		querySort: VariableSort
		/** For determining the var names */
		expression: Expression
		/* For evaluating the tuple to be added/removed */
		restAndExpression: AndExpression
		/* For checking if the tuple is redundant in another expression */
		restOrExpression: OrExpression
	}
}

export function getDefineIndexPlan(args: DefineIndexArgs): DefineIndexPlan {
	const index: DerivedIndex = {
		name: randomId(json.stringify(args)),
		sort: querySortToIndexSort(args.sort),
		args,
	}

	const orExpression = args.filter
	const indexerPlans = _.flatten(
		orExpression.map(andExpression => {
			return andExpression.map(expression => {
				// The rest of the andExpression that needs to be evaluated upon triggering
				// this indexer listener.
				const unknownsInExpression = getUnknownsInExpression(expression)
				const restAndExpression = resolveUnknownsInAndExpression(
					andExpression.filter(item => item !== expression),
					unknownsInExpression
				)

				// Upon solving the entire andExpression, if we are removing a record from the
				// index, we need to check the rest of the orExpression to make sure that the
				// same result isn't redundant from the other queries.
				const unknownsInAndExpression = getUnknownsInAndExpression(
					andExpression
				)
				const restOrExpression = orExpression
					.filter(otherAndExpression => otherAndExpression !== andExpression)
					.map(otherAndExpression =>
						resolveUnknownsInAndExpression(
							otherAndExpression,
							unknownsInAndExpression
						)
					)

				const indexerPlan: IndexerPlan = {
					listenKey: getListenKey(expression),
					args: {
						index,
						querySort: args.sort,
						expression,
						restAndExpression,
						restOrExpression,
					},
				}
				return indexerPlan
			})
		})
	)
	return { index, args, indexerPlans }
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
		.map(andExpression =>
			prettyAndExpressionPlan(getAndExpressionPlan(andExpression))
		)
		.join("\n")
	return [andPlan, indentText(orPlan, getIndentOfLastLine(andPlan) + 1)].join(
		"\n"
	)
}

export function prettyDefineIndexPlan(plan: DefineIndexPlan) {
	const indexersPlan = plan.indexerPlans.map(indexerPlan => {
		return [
			`INDEXER ${prettyExpression(
				indexerPlan.args.expression
			)} ${JSON.stringify(indexerPlan.args.index.name)}`,
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
): DerivedIndex {
	transaction.set(indexes, [plan.index.name, json.stringify(plan.args)])
	for (const indexer of plan.indexerPlans) {
		transaction.set(indexers, [indexer.listenKey, json.stringify(indexer.args)])
	}
	return plan.index
}

export function defineIndex(transaction: Transaction, args: DefineIndexArgs) {
	return evaluateDefineIndexPlan(transaction, getDefineIndexPlan(args))
}

export function indexExists(storage: ReadOnlyStorage, plan: DefineIndexPlan) {
	return storage.scan(indexes, {
		start: [plan.index.name, json.stringify(plan.args)],
		end: [plan.index.name, json.stringify(plan.args)],
	}).length
}

function querySortToIndexSort(sort: VariableSort) {
	return sort.map(([_var, dir]) => dir)
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
