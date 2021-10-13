import * as _ from "lodash"
import { ReadOnlyTupleStorage, Transaction } from "tuple-database/storage/types"
import { indentText } from "../helpers/printHelpers"
import { getFactListenKey } from "./factListenKeyHelpers"
import {
	Expression,
	getAndExpressionPlan,
	getOrExpressionPlan,
	isVariable,
	OrExpression,
	PartiallySolvedAndExpression,
	PartiallySolvedOrExpression,
	prettyAndExpressionPlan,
	prettyExpression,
	prettyOrExpressionPlan,
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
	index: DefineIndexArgs
	/** For determining the var names */
	expression: Expression
	/* For evaluating the tuple to be added/removed */
	restAndExpression: PartiallySolvedAndExpression
	/* For checking if the tuple has a redundant trace */
	restOrExpression: PartiallySolvedOrExpression
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
				let restOrExpression: PartiallySolvedOrExpression
				if (orExpression.length === 1) {
					if (andExpression.length === 1) {
						// If its just a single clause, then there's no redundant trance.
						restOrExpression = []
					} else {
						// It's possible there's a redundant trace in the same AndExpression.
						// For example, friend-of-a-friend.
						restOrExpression = orExpression.map((andExpression) =>
							resolveUnknownsInAndExpression(andExpression, index.sort)
						)
					}
				} else {
					// And obviously there can be redundancies if there is an OrExpression.
					restOrExpression = orExpression.map((andExpression) =>
						resolveUnknownsInAndExpression(andExpression, index.sort)
					)
				}

				const indexerPlan: IndexerPlan = {
					index,
					expression,
					restAndExpression,
					restOrExpression,
				}
				return indexerPlan
			})
		})
	)
	return { ...index, indexerPlans }
}

export function prettySetIndexerPlan(indexerPlan: IndexerPlan) {
	const { restAndExpression } = indexerPlan
	return prettyAndExpressionPlan(getAndExpressionPlan(restAndExpression))
}

export function prettyRemoveIndexerPlan(indexerPlan: IndexerPlan) {
	const { restOrExpression } = indexerPlan
	return prettyOrExpressionPlan(getOrExpressionPlan(restOrExpression))
}

export function prettyDefineIndexPlan(plan: DefineIndexPlan) {
	const indexersPlan = plan.indexerPlans.map((indexerPlan) => {
		return [
			`INDEXER ${JSON.stringify(indexerPlan.index.name)} ${prettyExpression(
				indexerPlan.expression
			)}`,
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
	const { name, filter, sort } = plan
	transaction.set(
		[indexes.indexesByName, name, "definition", { filter, sort }],
		null
	)
	for (const indexerPlan of plan.indexerPlans) {
		transaction.set(
			[
				indexes.indexersByKey,
				getFactListenKey(indexerPlan.expression),
				indexerPlan,
			],
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
	const { name, filter, sort } = plan
	return storage.exists([
		indexes.indexesByName,
		name,
		"definition",
		{ filter, sort },
	])
}

function getUnknownsInExpression(expression: Expression): Array<Variable> {
	return _.uniqWith(expression.filter(isVariable), _.isEqual)
}
