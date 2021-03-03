import { Tuple3 } from "./triplestore"
import { isValue, Value } from "./storage"
import * as json from "../helpers/json"
import { Variable } from "./query"

// TODO: use proper tuple encoding!
export function getListenKey(expression: Array<Value | Variable>) {
	return (
		"[" +
		expression
			.map(item => (isValue(item) ? json.stringify(item) : "*"))
			.join(",") +
		"]"
	)
}

/**
 * Given a fact, return a list of all listeners to fire.
 */
export function generateListenKeys(fact: Tuple3) {
	const listenKeys: Array<string> = []
	for (const entity of [true, false]) {
		for (const attribute of [true, false]) {
			for (const value of [true, false]) {
				listenKeys.push(
					getListenKey([
						entity ? fact[0] : { var: "" },
						attribute ? fact[1] : { var: "" },
						value ? fact[2] : { var: "" },
					])
				)
			}
		}
	}
	return listenKeys
}
