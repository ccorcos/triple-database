import * as _ from "lodash"
import { ReadOnlyTupleStorage, Transaction } from "tuple-database/storage/types"
import { getIndentOfLastLine, indentText } from "../helpers/printHelpers"
import { FactListenKey, getFactListenKey } from "./factListenKeyHelpers"
import {
	AndExpression,
	Expression,
	getAndExpressionPlan,
	isVariable,
	OrExpression,
	PartiallySolvedAndExpression,
	PartiallySolvedOrExpression,
	prettyAndExpressionPlan,
	prettyExpression,
	resolveUnknownsInAndExpression,
	Sort,
	Variable,
} from "./query"
import { indexes } from "./types"

export type DefineIndexArgs = {
	name: string
	filter: OrExpression
	sort: Sort
}

export type DefineIndexPlan = DefineIndexArgs & {
	indexerPlans: Array<IndexerPlan>
}

export type IndexerPlan = {
	listenKey: FactListenKey
	args: {
		index: DefineIndexArgs
		/** For determining the var names */
		expression: Expression
		/* For evaluating the tuple to be added/removed */
		restAndExpression: PartiallySolvedAndExpression
		/* For checking if the tuple is redundant from another expression */
		restOrExpression: PartiallySolvedOrExpression
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

				// Upon solving the andExpression, if we are removing a tuple from the index,
				// we need to check the rest of the orExpression to make sure that the same result
				// isn't redundant from the other traces.
				const restOrExpression = orExpression
					.filter((otherAndExpression) =>
						otherAndExpression === andExpression
							? restAndExpression
							: otherAndExpression
					)
					.map((andExpression) =>
						resolveUnknownsInAndExpression(andExpression, index.sort)
					)

				const indexerPlan: IndexerPlan = {
					listenKey: getFactListenKey(expression),
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
			`INDEXER ${JSON.stringify(
				indexerPlan.args.index.name
			)} ${prettyExpression(indexerPlan.args.expression)}`,
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
): DefineIndexPlan {
	transaction.set([indexes.indexesByName, plan.name, plan], null)
	for (const indexerPlan of plan.indexerPlans) {
		transaction.set(
			[indexes.indexersByKey, indexerPlan.listenKey, indexerPlan],
			null
		)
	}
	return plan
}

export function defineIndex(transaction: Transaction, args: DefineIndexArgs) {
	return evaluateDefineIndexPlan(transaction, getDefineIndexPlan(args))
}

export function indexExists(
	storage: ReadOnlyTupleStorage,
	plan: DefineIndexPlan
) {
	return storage.exists([indexes.indexesByName, plan.name, plan])
}

// TODO: delete index

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
