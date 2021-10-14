import { strict as assert } from "assert"
import * as t from "data-type-ts"
import { describe, it } from "mocha"
import { Assert } from "../helpers/typeHelpers"
import {
	deleteObj,
	objToTuples,
	OrderedTriplestore,
	readObj,
	writeObj,
} from "./OrderedTriplestore"

// Later:
// - test with a nested object
// - test with duck-typed values such as { date: string }

const PlayerObj = t.object({
	required: {
		id: t.string,
		name: t.string,
		score: t.number,
	},
	optional: {},
})
const GameObj = t.object({
	required: { id: t.string, players: t.array(PlayerObj) },
	optional: {},
})

type Game = typeof GameObj.value

describe("OrderedTriplestore", () => {
	it("works", () => {
		assert.ok(true)
	})

	it("objToTuples", () => {
		const game: Game = {
			id: "game1",
			players: [
				{ id: "player1", name: "Chet", score: 2 },
				{ id: "player2", name: "Meghan", score: 3 },
			],
		}

		const tuples = objToTuples(game, GameObj)
		assert.deepEqual(tuples, [
			["eaov", "game1", "players", 0, "player1"],
			["eaov", "player1", "name", null, "Chet"],
			["eaov", "player1", "score", null, 2],
			["eaov", "game1", "players", 1, "player2"],
			["eaov", "player2", "name", null, "Meghan"],
			["eaov", "player2", "score", null, 3],
		])
	})

	it("writeObj + readObj", () => {
		const game: Game = {
			id: "game1",
			players: [
				{ id: "player1", name: "Chet", score: 2 },
				{ id: "player2", name: "Meghan", score: 3 },
			],
		}

		const db = new OrderedTriplestore()
		writeObj(db, game, GameObj)
		const game2 = readObj(db, game.id, GameObj)

		// TODO: assert typeof game2 is not any!
		type SameType = Assert<typeof game2, Game>

		assert.ok(game !== game2)
		assert.deepEqual(game, game2)
	})

	it("deleteObj", () => {
		const game: Game = {
			id: "game1",
			players: [
				{ id: "player1", name: "Chet", score: 2 },
				{ id: "player2", name: "Meghan", score: 3 },
			],
		}

		const db = new OrderedTriplestore()
		writeObj(db, game, GameObj)
		const game2 = readObj(db, game.id, GameObj)

		// TODO: assert typeof game2 is not any!
		type SameType = Assert<typeof game2, Game>

		assert.ok(game !== game2)
		assert.deepEqual(game, game2)

		// NOTE: this also deletes the players too!
		deleteObj(db, game.id, GameObj)

		assert.deepEqual(db.scan(), [])

		// This is an interesting special-case:
		// An object with a single array property and the array is empty...
		// So it doesnt throw!
		// assert.throws(() => {
		const game3 = readObj(db, game.id, GameObj)
		assert.deepEqual(game3, { id: "game1", players: [] })
		// })
	})

	// hardDeleteObj
	// deleteObj
	// setProp

	// appendProp
	// proxyObj
	// proxyLost
	// subscribeObj
})
