import { strict as assert } from "assert"
import * as _ from "lodash"
import { Binding } from "../database/query"

export function bindingsEqual(a: Array<Binding>, b: Array<Binding>) {
	for (const item of a) {
		if (!b.some((other) => _.isEqual(item, other))) {
			assert.fail(JSON.stringify(item) + " was not expected")
		}
	}

	for (const item of b) {
		if (!a.some((other) => _.isEqual(item, other))) {
			assert.fail(JSON.stringify(item) + " did not appear")
		}
	}
}
