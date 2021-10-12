import { strict as assert } from "assert"
import { differenceWith } from "lodash"
import { describe, it } from "mocha"
import { compareValue } from "tuple-database/helpers/compareTuple"
import { Triplestore } from "../database/Triplestore"
import { Value } from "../database/types"

type Player = { id: number; name: string; score: number }
type Game = { players: Player[] }

const db = new Triplestore()

const obj = (maybeId?: string) => {
	const id = maybeId === undefined ? randomId() : maybeId

	return new Proxy<Record<string, Value[]> & { id: string }>({} as any, {
		get(target, property) {
			if (typeof property === "symbol") throw new Error("No symbols.")
			if (property === "id") return id
			const results = db.query({
				filter: [[[{ value: id }, { value: property }, { var: "value" }]]],
			})
			return results.map((result) => result.value)
		},
		set(target, property, newValues: Value[]) {
			if (typeof property === "symbol") throw new Error("No symbols.")
			if (property === "id") throw new Error("The id is reserved.")

			const tx = db.transact()
			const results = tx.query({
				filter: [[[{ value: id }, { value: property }, { var: "value" }]]],
			})
			const existingValues = results.map((result) => result.value)

			for (const value of differenceWith(
				existingValues,
				newValues,
				(a, b) => compareValue(a, b) === 0
			)) {
				tx.remove([id, property, value])
			}
			for (const value of differenceWith(
				newValues,
				existingValues,
				(a, b) => compareValue(a, b) === 0
			)) {
				tx.set([id, property, value])
			}
			tx.commit()
			return true
		},
	})
}

describe("obj proxy", () => {
	it("works", () => {
		const chet = obj()
		chet.name = ["Chet"]
		const sean = obj()
		sean.name = ["Sean"]
		const meghan = obj()
		meghan.name = ["Meghan"]
		chet.friend = [sean.id, meghan.id]

		assert.deepEqual(chet.name, ["Chet"])
		assert.ok(chet.friend.length === 2)
		assert.ok(chet.friend.includes(sean.id))
		assert.ok(chet.friend.includes(meghan.id))
	})
})

db.ensureIndex({
	name: "list",
	filter: [
		[
			[{ var: "listId" }, { value: "item" }, { var: "itemId" }],
			[{ var: "itemId" }, { value: "order" }, { var: "order" }],
			[{ var: "itemId" }, { value: "value" }, { var: "value" }],
		],
	],
	sort: [{ var: "listId" }, { var: "order" }, { var: "value" }],
})

function getList(id: string) {
	const results = db.scanIndex({ index: "list", prefix: [id] })
	return results.map(([_id, _order, value]) => value)
}

function randomId() {
	return Math.random().toString().slice(4)
}

const list = (maybeId?: string) => {
	const id = maybeId === undefined ? randomId() : maybeId

	return new Proxy<Value[]>([], {
		get(target, property) {
			if (typeof property === "symbol") throw new Error("No symbols.")
			const results = db.scanIndex({ index: "list", prefix: [id] })
			const values = results.map(([_id, _order, value]) => value)
			if (property === "length") return values.length

			if (property === "push")
				return (value) => {
					let order = -1
					if (results.length) order = results[results.length - 1][1] as number
					const itemId = randomId()
					db.transact()
						.set([itemId, "order", order + 1])
						.set([itemId, "value", value])
						.set([id, "item", itemId])
						.commit()
				}

			const n = parseInt(property)
			if (!isNaN(n)) return values[n]

			// if (property === "splice")
		},
	})
}

describe("list proxy", () => {
	it("works", () => {
		const players = list()
		const chet = obj()
		chet.name = ["Chet"]
		chet.score = [0]
		const sean = obj()
		sean.name = ["Sean"]
		sean.score = [0]
		players.push(chet.id)
		players.push(sean.id)
		assert.equal(players[0], chet.id)
		assert.equal(players[1], sean.id)
		assert.equal(players.length, 2)
	})
})

class $Game {
	constructor(public id: string) {}

	get players() {
		const results = db.query({
			filter: [[[{ value: this.id }, { value: "players" }, { var: "listId" }]]],
		})
		if (results.length === 0) {
		}

		db.scanIndex({ index: "list", prefix: [] })

		return []
	}
}
