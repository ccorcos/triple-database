import { Expression, isLiteral, Literal } from "./query"
import { Fact } from "./types"

export type Wildcard = { wild: true }
const wildcard: Wildcard = { wild: true }

export type FactListenKey = [
	Literal | Wildcard,
	Literal | Wildcard,
	Literal | Wildcard
]

export function getFactListenKey(expression: Expression): FactListenKey {
	return [
		isLiteral(expression[0]) ? expression[0] : wildcard,
		isLiteral(expression[1]) ? expression[1] : wildcard,
		isLiteral(expression[2]) ? expression[2] : wildcard,
	]
}

/**
 * Given a fact, return a list of all listeners to fire.
 */
export function generateFactListenKeys(fact: Fact) {
	const listenKeys: Array<FactListenKey> = []
	for (const entity of [true, false]) {
		for (const attribute of [true, false]) {
			for (const value of [true, false]) {
				listenKeys.push([
					entity ? { value: fact[0] } : wildcard,
					attribute ? { value: fact[1] } : wildcard,
					value ? { value: fact[2] } : wildcard,
				])
			}
		}
	}
	return listenKeys
}
