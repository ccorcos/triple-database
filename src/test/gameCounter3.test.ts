// e, a, v, ea, ve, av
// What if lists were built in?
// - [e, a, o, v] -- list in order
// - [e, a, v, o] --
// - [a, v, e]
// - [v, e, a] -- how are two objects related?
// -

import { strict as assert } from "assert"
import * as t from "data-type-ts"
import { describe, it } from "mocha"
import { composeTx, transactional } from "tuple-database/helpers/transactional"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"
import {
	ReadOnlyTupleStorage,
	Transaction,
	TupleStorage,
	Value,
} from "tuple-database/storage/types"
import { randomId } from "../helpers/randomId"
import { Tuple } from "../main"

class Database extends ReactiveStorage {
	constructor() {
		super(new InMemoryStorage())
		// What if lists were built in?
		//
		// What indexes are we going to use? We need: e, a, v, ea, ve, av
		// - [e, a, o, v]
		//   - get the whole object, [e, *]
		//   - list in order, [e, a, *]
		// - [v, a, e, o]
		//   - lookup inverse relationships [v, *]
		//   - lookup an entity [v, a, *]
		//   - order position of a fact [v, a, e, *]
		//   - conveniently give you the whole quad when looking up all pointers to an object for deletion.
		// - [a, e, v]
		//   - lookup all entities by attribute [a, *]
		// - [e, v, a]
		//   - lookup how entites are related [e, v, *]

		this.index((tx, op) => {
			if (op.tuple[0] !== "eaov") return
			const [_, e, a, o, v] = op.tuple
			// tx[op.type](["eaov", e, a, o, v], null)
			tx[op.type](["vaeo", v, a, e, o], null)
			tx[op.type](["aev", a, e, v], null)
			tx[op.type](["eva", e, v, a], null)
		})
	}
}

const PlayerObj = t.object({
	required: {
		id: t.string,
		name: t.string,
		score: t.number,
	},
	optional: {},
})

type Player = typeof PlayerObj.value

const GameObj = t.object({
	required: { id: t.string, players: t.array(t.string) },
	optional: {},
})

type Game = typeof GameObj.value

// TODO: better types for what an object really is. no nested arrays. objects have an id.
//
// Example of how objects serialize
// {
// 	id: 1,
// 	name: "chet",
// 	tags: ["red", "blue"],
// 	wife: { id: 2, name: "meghan" },
// }
//
// ["eaov", 1, "name", null, "chet"]
// ["eaov", 1, "tags", 0, "red"]
// ["eaov", 1, "tags", 0, "blue"]
// ["eaov", 1, "wife", null, 2]
// ["eaov", 2, "name", null, "meghan"]
//
function objToTuples<T extends { id: string }>(
	obj: T,
	schema: t.RuntimeDataType<T>
) {
	const dataType = schema.dataType
	if (dataType.type !== "object") throw new Error("Not an object schema.")

	const tuples: Tuple[] = []

	for (const [key, keySchema] of Object.entries(dataType.required)) {
		if (key === "id") continue
		if (keySchema.type === "array") {
			const list: any[] = obj[key] as any

			for (let i = 0; i < list.length; i++) {
				const value = list[i]
				const valueSchema = keySchema.inner

				if (valueSchema.type === "array") throw new Error("No nested arrays.")
				if (valueSchema.type === "object") {
					tuples.push(["eaov", obj.id, key, i, value.id])
					tuples.push(...objToTuples(value, new t.RuntimeDataType(valueSchema)))
				} else if (
					valueSchema.type === "string" ||
					valueSchema.type === "number" ||
					valueSchema.type === "boolean"
				) {
					tuples.push(["eaov", obj.id, key, i, value])
				} else {
					throw new Error("Invalid JSON schema type.")
				}
			}
		} else if (keySchema.type === "object") {
			const keyObj: { id: string } = obj[key] as any

			tuples.push(["eaov", obj.id, key, null, keyObj.id])
			tuples.push(...objToTuples(keyObj, new t.RuntimeDataType(keySchema)))
		} else if (
			keySchema.type === "string" ||
			keySchema.type === "number" ||
			keySchema.type === "boolean"
		) {
			const value = obj[key] as any
			tuples.push(["eaov", obj.id, key, null, value])
		} else {
			throw new Error("Invalid JSON schema type.")
		}
	}
	return tuples
}

// Enforces that that the array is length 1 and that
// TODO: accept a schema in here to validate.
function single<T>(values: T[]): T {
	if (values.length !== 1)
		throw new Error("Too many values: " + JSON.stringify(values))
	return values[0]
}

// Returns the first value. Useful when we don't care about the value in the tuplestore.
function first<T extends any[]>(tuple: T): T[0] {
	if (tuple.length === 0) throw new Error("Can't call first on empty.")
	return tuple[0]
}

function last<T>(tuple: T[]): T {
	if (tuple.length === 0) throw new Error("Can't call last on empty.")
	return tuple[tuple.length - 1]
}

function readValue<T>(
	db: ReadOnlyTupleStorage,
	values: Value[],
	schema: t.RuntimeDataType<T>
) {
	const dataType = schema.dataType
	if (dataType.type === "array") {
		// NOTE: a list of lists is not going to work!
		const inner = new t.RuntimeDataType(dataType.inner)
		return values.map((value) => readValue(db, [value], inner))
	}

	const value = single(values)

	if (dataType.type === "object") {
		if (typeof value !== "string") throw new Error("Object id is not a string.")
		return readObj(db, value, schema as any)
	}

	if (dataType.type === "number") {
		if (typeof value !== "number") throw new Error("Value should be a number.")
		return value
	}

	if (dataType.type === "string") {
		if (typeof value !== "string") throw new Error("Value should be a string.")
		return value
	}

	if (dataType.type === "boolean") {
		if (typeof value !== "boolean")
			throw new Error("Value should be a boolean.")
		return value
	}

	throw new Error("Unsupported DataType: " + dataType.type)
}

function readProp<T>(
	db: ReadOnlyTupleStorage,
	id: string,
	prop: string,
	schema: t.RuntimeDataType<T>
) {
	if (prop === "id") return id

	const values = db
		.scan({ prefix: ["eaov", id, prop] })
		.map(([tuple]) => tuple[tuple.length - 1])

	return readValue(db, values, schema)
}

function readObj<T extends { id: string }>(
	db: ReadOnlyTupleStorage,
	id: string,
	schema: t.RuntimeDataType<T>
): T {
	const dataType = schema.dataType
	if (dataType.type !== "object") throw new Error("Not an object schema.")
	const obj = { id } as any
	for (const [key, keySchema] of Object.entries(dataType.required)) {
		obj[key] = readProp(db, id, key, new t.RuntimeDataType(keySchema))
	}
	return obj
}

function writeObj<T extends { id: string }>(
	dbOrTx: TupleStorage | Transaction,
	obj: T,
	schema: t.RuntimeDataType<T>
) {
	return composeTx(dbOrTx, (tx) => {
		const facts = objToTuples(obj, schema)
		facts.forEach((tuple) => tx.set(tuple, null))
	})
}

// TODO: "order" is an annoying term. I suppose its an index.
function getNextIndex(db: ReadOnlyTupleStorage, ea: [Value, Value]) {
	const result = db.scan({
		prefix: ["eaov", ...ea],
		reverse: true,
		limit: 1,
	})
	if (result.length === 0) return 0
	const tuple = first(result[0])
	// TODO: we can use fractional indexing here.
	const index = tuple[3] as number | null
	const nextIndex = index === null ? 0 : index + 1
	return nextIndex
}

function deleteObj<T extends { id: string }>(
	dbOrTx: TupleStorage | Transaction,
	id: string
) {
	return composeTx(dbOrTx, (tx) => {
		const objectProperties = tx.scan({ prefix: ["eaov", id] }).map(first)
		tx.write({ remove: objectProperties })

		const inverseRelationships = tx.scan({ prefix: ["vaeo", id] }).map(first)
		tx.write({ remove: inverseRelationships })
	})
}

const gameId = "theOnlyGame"

const addPlayer = transactional((tx) => {
	const player: Player = { id: randomId(), name: "", score: 0 }
	writeObj(tx, player, PlayerObj)

	const game = proxyObj(tx, gameId, GameObj)
	game.players.push(player.id)

	return player.id
})

const deletePlayer = transactional((tx, id: string) => {
	deleteObj(tx, id)
})

const setPlayerName = transactional((tx, id: string, newName: string) => {
	const player = proxyObj(tx, id, PlayerObj)
	player.name = newName
})

const incrementScore = transactional((tx, id: string, delta: number) => {
	const player = proxyObj(tx, id, PlayerObj)
	player.score += delta
})

const resetGame = transactional((tx) => {
	deleteObj(tx, gameId)
	addPlayer(tx)
})

// ============================================================================
//
// We have the following utility functions:
//
// - objToTuples
// - readObj
// - writeObj
// - deleteObj
//
// Where are we?
// - typed mutations
//   - add/remove list
//   - set property-value
// - reconstruct the objects
// - listen for changes
// - break up the object queries/listeners.
//

describe("normalizedDataActions", () => {
	it("works", () => {
		const db = new Database()

		resetGame(db)
		const game = readObj(db, gameId, GameObj)

		const player1 = game.players[0]
		const player2 = addPlayer(db)

		setPlayerName(db, player1, "Chet")
		incrementScore(db, player1, 6)

		setPlayerName(db, player2, "Meghan")
		incrementScore(db, player2, 9)

		assert.deepEqual(readObj(db, gameId, GameObj), {
			id: game.id,
			players: [player1, player2],
		})

		assert.deepEqual(readObj(db, player1, PlayerObj), {
			id: player1,
			name: "Chet",
			score: 6,
		})

		assert.deepEqual(readObj(db, player2, PlayerObj), {
			id: player2,
			name: "Meghan",
			score: 9,
		})
	})
})

function setProp<T>(
	dbOrTx: TupleStorage | Transaction,
	id: string,
	property: string,
	value: any,
	schema: t.RuntimeDataType<T>
) {
	const error = schema.validate(value)
	if (error) throw error
	return composeTx(dbOrTx, (tx) => {
		const existing = tx.scan({ prefix: ["eaov", id, property] }).map(first)
		tx.write({ remove: existing })
		tx.set(["eaov", id, property, null, value], null)
	})
}

function proxyObj<T extends { id: string }>(
	db: TupleStorage | Transaction,
	id: string,
	schema: t.RuntimeDataType<T>
): T {
	const dataType = schema.dataType
	if (dataType.type !== "object") throw new Error("Must be object schema.")

	return new Proxy<T>({} as any, {
		get(target, prop) {
			if (typeof prop === "symbol") return undefined
			if (!(prop in dataType.required)) return undefined
			const propSchema = new t.RuntimeDataType(dataType.required[prop])

			if (propSchema.dataType.type === "object")
				throw new Error("No nested objects, yet.")

			if (propSchema.dataType.type === "array") {
				return proxyList(db, id, prop, propSchema)
			}

			const value = readProp(db, id, prop, propSchema)
			return value
		},
		set(target, prop, value) {
			if (typeof prop === "symbol") throw new Error("No symbols.")
			if (prop === "id") throw new Error("The id is reserved.")
			if (!(prop in dataType.required))
				throw new Error("Invalid property for schema.")

			const propSchema = new t.RuntimeDataType(dataType.required[prop])

			if (propSchema.dataType.type === "object")
				throw new Error("No nested objects, yet.")

			if (propSchema.dataType.type === "array")
				throw new Error("Call the array mutation methods instead.")

			setProp(db, id, prop, value, propSchema)
			return true
		},
	})
}

function proxyList<T>(
	db: TupleStorage | Transaction,
	id: string,
	listProp: string,
	schema: t.RuntimeDataType<T>
): T[] {
	const dataType = schema.dataType
	if (dataType.type === "object") throw new Error("No nested objects, yet.")
	if (dataType.type === "array") throw new Error("No nested array.")

	return new Proxy([] as any, {
		get(target, prop) {
			if (typeof prop === "symbol") throw new Error("No symbols.")

			if (prop === "length") {
				const results = db.scan({ prefix: ["eaov", id, listProp] }).map(first)
				return results.length
			}

			if (prop === "push")
				return (value: any) => {
					const error = schema.validate(value)
					if (error) throw error

					const results = db
						.scan({ prefix: ["eaov", id, listProp], reverse: true, limit: 1 })
						.map(first)

					let index: number = 0
					if (results.length !== 0) {
						const order = single(results)[2]
						const error = t.number.validate(order)
						if (error) throw error
						index = order as any
					}

					composeTx(db, (tx) => {
						tx.set(["eaov", id, listProp, index, value], null)
					})
				}

			// if (property === "splice")
			// if (property === "insertAfter")
			// if (property === "insertBelow")
			// if (property === "remove...?")

			const n = parseInt(prop)
			if (!isNaN(n)) {
				const values = db
					.scan({ prefix: ["eaov", id, listProp] })
					.map(first)
					.map(last)
				const value = values[n]
				const error = schema.validate(value)
				if (error) throw error
				return value
			}
		},
	})
}
