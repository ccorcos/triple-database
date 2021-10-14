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
	required: { id: t.string, players: t.array(PlayerObj) },
	optional: {},
})

type Game = typeof GameObj.value

function randomId() {
	return Math.random().toString().slice(4)
}

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

function single<T>(values: T[]): T {
	if (values.length !== 1)
		throw new Error("Too many values: " + JSON.stringify(values))
	return values[0]
}

function first<T extends any[]>(tuple: T): T[0] {
	if (tuple.length === 0) throw new Error("Can't call first on empty.")
	return tuple[0]
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

function readObj<T extends { id: string }>(
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

		obj[key] = readValue(db, values, new t.RuntimeDataType(keySchema))
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

		const game: Game = {
			id: randomId(),
			players: [
				{ id: randomId(), name: "", score: 0 },
				{ id: randomId(), name: "", score: 0 },
			],
		}

		const tx = db.transact()
		for (const tuple of objToTuples(game, GameObj)) {
			tx.set(tuple, null)
		}
		tx.commit()
		// console.log(db.scan())

		const game2 = readObj(db, game.id, GameObj)
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
		return objToTuples(after, schema).forEach((tuple) => tx.set(tuple, null))
	} else if (after === undefined) {
		// Create the `before` object.
		return objToTuples(before, schema).forEach((tuple) => tx.remove(tuple))
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
				objToTuples(before, schema).forEach((tuple) => tx.remove(tuple))
				objToTuples(after, schema).forEach((tuple) => tx.set(tuple, null))
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

function newPlayer(): Player {
	return { id: randomId(), name: "", score: 0 }
}

function newGame(): Game {
	return { id: gameId, players: [newPlayer()] }
}

const reducers = {
	addPlayer(game: Game) {
		const { players } = game
		return { id: game.id, players: [...players, newPlayer()] }
	},
	deletePlayer(game: Game, index: number) {
		const { players } = game
		const newPlayers = [...players]
		newPlayers.splice(index, 1)
		return { id: game.id, players: newPlayers }
	},
	editName(game: Game, index: number, newName: string) {
		const players = game.players.map((player, i) => {
			if (i !== index) return player
			return { ...player, name: newName }
		})
		return { id: game.id, players }
	},
	incrementScore(game: Game, index: number, delta: number) {
		const players = game.players.map((player, i) => {
			if (i !== index) return player
			return { ...player, score: player.score + delta }
		})
		return { id: game.id, players }
	},
	resetGame(game: Game) {
		return newGame()
	},
}

describe("serializeObjDiff", () => {
	it("works", () => {
		const db = new Database()
		const game = newGame()

		let tx = db.transact()
		serializeObjDiff(tx, undefined, game, GameObj)
		tx.commit()

		assert.deepEqual(readObj(db, game.id, GameObj), game)

		let game2 = reducers.addPlayer(game)
		game2 = reducers.editName(game2, 0, "Chet")
		game2 = reducers.editName(game2, 1, "Meghan")
		game2 = reducers.incrementScore(game2, 0, 6)
		game2 = reducers.incrementScore(game2, 1, 9)

		tx = db.transact()
		serializeObjDiff(tx, game, game2, GameObj)
		tx.commit()

		assert.deepEqual(readObj(db, game.id, GameObj), game2)
	})

	it("deletePlayer", () => {
		const db = new Database()
		let game = newGame()
		game = reducers.editName(game, 0, "Chet")

		let tx = db.transact()
		serializeObjDiff(tx, undefined, game, GameObj)
		tx.commit()
		assert.deepEqual(readObj(db, game.id, GameObj), game)

		let game2 = reducers.addPlayer(game)
		game2 = reducers.editName(game2, 1, "Meghan")
		tx = db.transact()
		serializeObjDiff(tx, game, game2, GameObj)
		tx.commit()
		assert.deepEqual(readObj(db, game.id, GameObj), game2)

		let game3 = reducers.deletePlayer(game2, 1)
		tx = db.transact()
		serializeObjDiff(tx, game2, game3, GameObj)
		tx.commit()
		assert.deepEqual(readObj(db, game.id, GameObj), game3)
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

// ============================================================================

// Right now...
// - game counter with db tx for writes.
// - reconstruct the objects
// - listen for changes
// - break up the object queries/listeners.

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
	const player = newPlayer()
	writeObj(tx, player, PlayerObj)

	// TODO: this needs to be more type-constrained.
	const nextIndex = getNextIndex(tx, [gameId, "players"])
	tx.set(["eaov", gameId, "players", nextIndex, player.id], null)

	return player.id
})

const deletePlayer = transactional((tx, id: string) => {
	deleteObj(tx, id)
})

const setPlayerName = transactional((tx, id: string, newName: string) => {
	const names = tx.scan({ prefix: ["eaov", id, "name"] }).map(first)
	tx.write({ remove: names })
	tx.set(["eaov", id, "name", null, newName], null)
})

const incrementScore = transactional((tx, id: string, delta: number) => {
	const scores = tx.scan({ prefix: ["eaov", id, "score"] }).map(first)
	tx.write({ remove: scores })
	const currentScore: number = single(scores.map((tuple) => tuple[4])) as any
	tx.set(["eaov", id, "score", null, currentScore + delta], null)
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

describe("transactionalActions", () => {
	it("works", () => {
		const db = new Database()

		resetGame(db)
		const game = readObj(db, gameId, GameObj)

		const player1 = game.players[0].id
		const player2 = addPlayer(db)

		setPlayerName(db, player1, "Chet")
		incrementScore(db, player1, 6)

		setPlayerName(db, player2, "Meghan")
		incrementScore(db, player2, 9)

		assert.deepEqual(readObj(db, gameId, GameObj), {
			id: game.id,
			players: [
				{ id: player1, name: "Chet", score: 6 },
				{ id: player2, name: "Meghan", score: 9 },
			],
		})
	})
})
