// import { Tuple3 } from "./triplestore"
// import { isValue, Value } from "./storage"
// import * as json from "../helpers/json"
import { Tuple, Value } from "tuple-database/storage/types"
import { isVariable, Variable } from "./query"

// TODO: something better than "*"
export function getListenKey(expression: Array<Value | Variable>) {
	return expression.map((item) => (!isVariable(item) ? item : "*"))
}

type Tuple3 = [Value, Value, Value]

/**
 * Given a fact, return a list of all listeners to fire.
 */
export function generateListenKeys(fact: Tuple3) {
	const listenKeys: Array<Tuple> = []
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
