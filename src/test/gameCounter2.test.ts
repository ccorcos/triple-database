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
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"
import {
	ReadOnlyTupleStorage,
	Transaction,
	Value,
} from "tuple-database/storage/types"
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

const Player = t.object({
	required: {
		id: t.string,
		name: t.string,
		score: t.number,
	},
	optional: {},
})

const Game = t.object({
	required: { id: t.string, players: t.array(Player) },
	optional: {},
})

function randomId() {
	return Math.random().toString().slice(4)
}

function serializeObj<T extends { id: string }>(
	obj: T,
	schema: t.RuntimeDataType<T>
) {
	const dataType = schema.dataType
	if (dataType.type !== "object") throw new Error("Not an object schema.")

	const facts: Tuple[] = []

	for (const [key, keySchema] of Object.entries(dataType.required)) {
		if (key === "id") continue
		if (keySchema.type === "array") {
			const list: any[] = obj[key] as any

			for (let i = 0; i < list.length; i++) {
				const value = list[i]
				const valueSchema = keySchema.inner

				if (valueSchema.type === "array") throw new Error("No nested arrays.")
				if (valueSchema.type === "object") {
					facts.push(["eaov", obj.id, key, i, value.id])
					facts.push(...serializeObj(value, new t.RuntimeDataType(valueSchema)))
				} else if (
					valueSchema.type === "string" ||
					valueSchema.type === "number" ||
					valueSchema.type === "boolean"
				) {
					facts.push(["eaov", obj.id, key, i, value])
				} else {
					throw new Error("Invalid JSON schema type.")
				}
			}
		} else if (keySchema.type === "object") {
			const keyObj: { id: string } = obj[key] as any

			facts.push(["eaov", obj.id, key, null, keyObj.id])
			facts.push(...serializeObj(keyObj, new t.RuntimeDataType(keySchema)))
		} else if (
			keySchema.type === "string" ||
			keySchema.type === "number" ||
			keySchema.type === "boolean"
		) {
			const value = obj[key] as any
			facts.push(["eaov", obj.id, key, null, value])
		} else {
			throw new Error("Invalid JSON schema type.")
		}
	}
	return facts
}

function single<T>(values: T[]): T {
	if (values.length !== 1)
		throw new Error("Too many values: " + JSON.stringify(values))
	return values[0]
}

function parseValue<T>(
	db: ReadOnlyTupleStorage,
	values: Value[],
	schema: t.RuntimeDataType<T>
) {
	const dataType = schema.dataType
	if (dataType.type === "array") {
		// NOTE: a list of lists is not going to work!
		const inner = new t.RuntimeDataType(dataType.inner)
		return values.map((value) => parseValue(db, [value], inner))
	}

	const value = single(values)

	if (dataType.type === "object") {
		if (typeof value !== "string") throw new Error("Object id is not a string.")
		return parseObj(db, value, schema as any)
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

function parseObj<T extends { id: string }>(
	db: ReadOnlyTupleStorage,
	id: string,
	schema: t.RuntimeDataType<T>
): T {
	const dataType = schema.dataType
	if (dataType.type !== "object") throw new Error("Not an object schema.")

	const obj = { id } as any
	for (const [key, keySchema] of Object.entries(dataType.required)) {
		if (key === "id") continue
		const values = db
			.scan({ prefix: ["eaov", id, key] })
			.map(([tuple]) => tuple[tuple.length - 1])

		obj[key] = parseValue(db, values, new t.RuntimeDataType(keySchema))
		// try {
		// } catch (error) {
		// 	error.message += " " + key
		// 	throw error
		// }
	}

	return obj
}

describe("serializeObj", () => {
	it("works", () => {
		const db = new Database()

		const game: typeof Game.value = {
			id: randomId(),
			players: [
				{ id: randomId(), name: "", score: 0 },
				{ id: randomId(), name: "", score: 0 },
			],
		}

		const tx = db.transact()
		for (const tuple of serializeObj(game, Game)) {
			tx.set(tuple, null)
		}
		tx.commit()
		// console.log(db.scan())

		const game2 = parseObj(db, game.id, Game)
		// console.log(game2)

		assert.deepEqual(game, game2)
	})
})

// We can use the same immutable updates as before and just diff to generate fact updates.
// Example: suppose, one player is playing two games with the score synced between the two.
function serializeObjDiff<T extends { id: string }>(
	tx: Transaction,
	before: T | undefined,
	after: T | undefined,
	schema: t.RuntimeDataType<T>
) {
	const dataType = schema.dataType
	if (dataType.type !== "object") throw new Error("Not an object schema.")

	if (before === undefined) {
		if (after === undefined) return
		// Create the `after` object.
		return serializeObj(after, schema).forEach((tuple) => tx.set(tuple, null))
	} else if (after === undefined) {
		// Create the `before` object.
		return serializeObj(before, schema).forEach((tuple) => tx.remove(tuple))
	}

	// Diff the objects.
	if (before === after) return
	if (before.id !== after.id) throw new Error("Diffing different objects.")

	for (const [key, keySchema] of Object.entries(dataType.required)) {
		if (key === "id") continue

		const beforeValue = before[key]
		const afterValue = after[key]

		if (beforeValue === afterValue) continue

		if (keySchema.type === "array") {
			const innerSchema = keySchema.inner
			if (innerSchema.type === "array")
				throw new Error("Cannot have nested array types.")
			if (innerSchema.type === "object") {
				// Find objects with the same id and diff them separately than their order.
				// TODO: here.
				let i = 0
				while (i < beforeValue.length || i < afterValue.length) {
					if (i >= beforeValue.length) {
						const afterObj = afterValue[i]
						tx.set(["eaov", after.id, key, i, afterObj.id], null)
						serializeObjDiff(
							tx,
							undefined,
							afterObj,
							new t.RuntimeDataType(innerSchema)
						)
					} else if (i >= afterValue.length) {
						const beforeObj = beforeValue[i]
						tx.remove(["eaov", before.id, key, i, beforeObj.id])
						serializeObjDiff(
							tx,
							beforeObj,
							undefined,
							new t.RuntimeDataType(innerSchema)
						)
					} else {
						// TODO: efficiently re-order with fractional indexing.
						// Technically, you'd want to diff-patch-match here.
						const afterObj = afterValue[i]
						const beforeObj = beforeValue[i]
						serializeObjDiff(
							tx,
							beforeObj,
							afterObj,
							new t.RuntimeDataType(innerSchema)
						)
					}
					i++
				}
			} else if (
				innerSchema.type === "string" ||
				innerSchema.type === "number" ||
				innerSchema.type === "boolean"
			) {
				let i = 0
				while (i < beforeValue.length || i < afterValue.length) {
					if (i >= beforeValue.length) {
						tx.set(["eaov", after.id, key, i, afterValue[i]], null)
					} else if (i >= afterValue.length) {
						tx.remove(["eaov", before.id, key, i, beforeValue[i]])
					} else {
						// TODO: efficiently re-order with fractional indexing.
						// Technically, you'd want to diff-patch-match here.
						tx.set(["eaov", after.id, key, i, afterValue[i]], null)
						tx.remove(["eaov", before.id, key, i, beforeValue[i]])
					}
					i++
				}
			} else {
				throw new Error("Invalid schema.")
			}
		} else if (keySchema.type === "object") {
			// New object.
			if (beforeValue.id !== afterValue.id) {
				serializeObj(before, schema).forEach((tuple) => tx.remove(tuple))
				serializeObj(after, schema).forEach((tuple) => tx.set(tuple, null))
				return
			}
			// Diff object.
			return serializeObjDiff(
				tx,
				beforeValue,
				afterValue,
				new t.RuntimeDataType(keySchema)
			)
		} else if (
			keySchema.type === "string" ||
			keySchema.type === "number" ||
			keySchema.type === "boolean"
		) {
			tx.remove(["eaov", before.id, key, null, beforeValue])
			tx.set(["eaov", after.id, key, null, afterValue], null)
		} else {
			throw new Error("Invalid schema.")
		}
	}
}

// Regular old app state:

function newPlayer(): typeof Player.value {
	return { id: randomId(), name: "", score: 0 }
}

function newGame(): typeof Game.value {
	return { id: randomId(), players: [newPlayer()] }
}

const reducers = {
	addPlayer(game: typeof Game.value) {
		const { players } = game
		return { id: game.id, players: [...players, newPlayer()] }
	},
	deletePlayer(game: typeof Game.value, index: number) {
		const { players } = game
		const newPlayers = [...players]
		newPlayers.splice(index, 1)
		return { id: game.id, players: newPlayers }
	},
	editName(game: typeof Game.value, index: number, newName: string) {
		const players = game.players.map((player, i) => {
			if (i !== index) return player
			return { ...player, name: newName }
		})
		return { id: game.id, players }
	},
	incrementScore(game: typeof Game.value, index: number, delta: number) {
		const players = game.players.map((player, i) => {
			if (i !== index) return player
			return { ...player, score: player.score + delta }
		})
		return { id: game.id, players }
	},
	resetGame(game: typeof Game.value) {
		return newGame()
	},
}

describe("serializeObjDiff", () => {
	it("works", () => {
		const db = new Database()
		const game = newGame()

		let tx = db.transact()
		serializeObjDiff(tx, undefined, game, Game)
		tx.commit()

		assert.deepEqual(parseObj(db, game.id, Game), game)

		let game2 = reducers.addPlayer(game)
		game2 = reducers.editName(game2, 0, "Chet")
		game2 = reducers.editName(game2, 1, "Meghan")
		game2 = reducers.incrementScore(game2, 0, 6)
		game2 = reducers.incrementScore(game2, 1, 9)

		tx = db.transact()
		serializeObjDiff(tx, game, game2, Game)
		tx.commit()

		assert.deepEqual(parseObj(db, game.id, Game), game2)
	})

	it("deletePlayer", () => {
		const db = new Database()
		let game = newGame()
		game = reducers.editName(game, 0, "Chet")

		let tx = db.transact()
		serializeObjDiff(tx, undefined, game, Game)
		tx.commit()
		assert.deepEqual(parseObj(db, game.id, Game), game)

		let game2 = reducers.addPlayer(game)
		game2 = reducers.editName(game2, 1, "Meghan")
		tx = db.transact()
		serializeObjDiff(tx, game, game2, Game)
		tx.commit()
		assert.deepEqual(parseObj(db, game.id, Game), game2)

		let game3 = reducers.deletePlayer(game2, 1)
		tx = db.transact()
		serializeObjDiff(tx, game2, game3, Game)
		tx.commit()
		assert.deepEqual(parseObj(db, game.id, Game), game3)
	})
})

// Checkpoint: Where are we?
// 1. Represeting lists in the triplestore is pretty frustrating.
// 2. We can use EAOV and VAEO to handle ordered data with o=null for unordered things.
// 3. Lets ditch the triplestore for now and build one on the tuplestore.
// 4. If we can use the immutable data structure to efficiently diff objects, then we can still use StateMachines for our components.
// 5. So long as each component's data is completely normalized, we should be able to do this, just need parseObj to be reactive...
//
// TODO: What's next?
// - how can we make parseObj reactive so that we can use this for state updates?
//   - we want reactive updates to preserve structural sharing!
// - serializeObjDiff between steps
// - suppose we have a multiple games going on, but we want a single player's score to be synced between the two.
//   it's contrived in this case, but a clean example of the composition benefits we get from normalization.
//

// Reactive parseObj using Reactive Magic approach?
// A json object with reactive updates that preserves structural sharing.

class Cursor<T> {
	constructor(private _value: T) {}

	public get value() {
		return this._value
	}

	public set value(value: T) {
		this._value = value
		this.listeners.forEach((fn) => fn(value))
	}

	private listeners = new Set<(newValue: T) => void>()

	public listen(fn: (newValue: T) => void) {
		this.listeners.add(fn)
		return () => this.listeners.delete(fn)
	}
}

// Goal:
// - updating database somewhere else should update the JSON object immutably

function parseObj2<T extends { id: string }>(
	db: ReadOnlyTupleStorage,
	id: string,
	schema: t.RuntimeDataType<T>
): T {
	const dataType = schema.dataType
	if (dataType.type !== "object") throw new Error("Not an object schema.")

	const obj = { id } as any
	for (const [key, keySchema] of Object.entries(dataType.required)) {
		if (key === "id") continue

		const values = db
			.scan({ prefix: ["eaov", id, key] })
			.map(([tuple]) => tuple[tuple.length - 1])

		obj[key] = parseValue(db, values, new t.RuntimeDataType(keySchema))
		// try {
		// } catch (error) {
		// 	error.message += " " + key
		// 	throw error
		// }
	}

	const cursor = new Cursor<T>(obj as any)

	return obj
}
