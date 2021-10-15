import { strict as assert } from "assert"
import * as t from "data-type-ts"
import { describe, it } from "mocha"
import { Assert } from "../helpers/typeHelpers"
import {
	appendProp,
	deleteObj,
	hardDeleteObj,
	objToTuples,
	OrderedTriplestore,
	proxyList,
	proxyObj,
	readObj,
	setProp,
	subscribeObj,
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

type Player = typeof PlayerObj.value

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
	it.skip("writeObj + readObj with optional properties", () => {})

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

	it("deleteObj with optional properties", () => {})

	it("hardDeleteObj", () => {
		const player1: Player = { id: "player1", name: "Chet", score: 2 }
		const player2: Player = { id: "player2", name: "Meghan", score: 3 }

		const game: Game = {
			id: "game1",
			players: [player1, player2],
		}

		const db = new OrderedTriplestore()
		writeObj(db, game, GameObj)
		const game2 = readObj(db, game.id, GameObj)

		assert.ok(game !== game2)
		assert.deepEqual(game, game2)

		// NOTE: this does not delete the players!
		hardDeleteObj(db, game.id)
		assert.ok(db.scan().length > 0)

		hardDeleteObj(db, player1.id)
		assert.ok(db.scan().length > 0)

		hardDeleteObj(db, player2.id)
		assert.deepEqual(db.scan(), [])
	})

	describe("setProp", () => {
		it("string", () => {
			const player1: Player = { id: "player1", name: "Chet", score: 2 }
			const player2: Player = { id: "player2", name: "Meghan", score: 3 }
			const game: Game = { id: "game1", players: [player1, player2] }
			const db = new OrderedTriplestore()
			writeObj(db, game, GameObj)

			setProp(db, player1.id, "name", "Chester", PlayerObj)
			assert.throws(() => {
				// @ts-expect-error
				setProp(db, player1.id, "name2", "Chester", PlayerObj)
			})

			const newPlayer1 = readObj(db, player1.id, PlayerObj)
			assert.deepEqual(newPlayer1, { id: "player1", name: "Chester", score: 2 })
		})

		it.skip("object", () => {})
		it.skip("array", () => {})
		it.skip("optional properties", () => {})
	})

	it.skip("appendProp", () => {})

	it.skip("proxyObj nested objects", () => {
		const player1: Player = { id: "player1", name: "Chet", score: 2 }
		const player2: Player = { id: "player2", name: "Meghan", score: 3 }
		const game: Game = { id: "game1", players: [player1, player2] }
		const db = new OrderedTriplestore()
		writeObj(db, game, GameObj)

		const g = proxyObj(db, game.id, GameObj)

		assert.equal(g.id, game.id)
		assert.equal(g.players.length, 2)
		assert.equal(g.players[0].id, "player1")
		assert.equal(g.players[0].name, "Chet")
		assert.equal(g.players[0].score, 2)
		assert.equal(g.players[1].id, "player2")
		assert.equal(g.players[1].name, "Meghan")
		assert.equal(g.players[1].score, 3)
	})

	describe("flattened schema", () => {
		// Flattened out schema.
		const PlayerObj = t.object({
			required: {
				id: t.string,
				name: t.string,
				score: t.number,
			},
			optional: {},
		})
		const GameObj = t.object({
			required: { id: t.string, players: t.array(t.string) },
			optional: {},
		})

		type Game = typeof GameObj.value

		type Player = typeof PlayerObj.value

		const player1: Player = { id: "player1", name: "Chet", score: 2 }
		const player2: Player = { id: "player2", name: "Meghan", score: 3 }
		const game: Game = { id: "game1", players: [player1.id, player2.id] }

		it("proxyObj read", () => {
			const db = new OrderedTriplestore()
			writeObj(db, game, GameObj)
			writeObj(db, player1, PlayerObj)
			writeObj(db, player2, PlayerObj)

			const g = proxyObj(db, game.id, GameObj)

			assert.equal(g.id, game.id)
			assert.equal(g.players.length, 2)
			assert.equal(g.players[0], "player1")
			assert.equal(g.players[1], "player2")

			const p1 = proxyObj(db, player1.id, PlayerObj)
			const p2 = proxyObj(db, player2.id, PlayerObj)

			assert.equal(p1.id, "player1")
			assert.equal(p1.name, "Chet")
			assert.equal(p1.score, 2)

			assert.equal(p2.id, "player2")
			assert.equal(p2.name, "Meghan")
			assert.equal(p2.score, 3)
		})

		// TODO: this is failing, I think, because we need to be able to iterate properties
		// on the proxied object.
		it("proxyObj read and write", () => {
			const db = new OrderedTriplestore()
			writeObj(db, player1, PlayerObj)

			const p = proxyObj(db, player1.id, PlayerObj)
			assert.deepEqual(p, player1)

			p.name = "Chester"
			assert.deepEqual(p, { id: "player1", name: "Chester", score: 2 })

			p.score += 5
			assert.deepEqual(p, { id: "player1", name: "Chester", score: 7 })
		})

		// it("proxy an array and enumerate it", () => {
		// 	const numbers = [1, 2, 3]
		// 	const list = new Proxy<number[]>([], {
		// 		// This allows deepEqual to work.
		// 		ownKeys: function () {
		// 			return Object.getOwnPropertyNames(numbers)
		// 		},
		// 		getOwnPropertyDescriptor: (target, key) => {
		// 			return {
		// 				writable: key === "length",
		// 				value: getProp(key),
		// 				enumerable: key !== "length",
		// 				configurable: key !== "length",
		// 			}
		// 		},
		// 		get(target, prop) {
		// 			return getProp(prop)
		// 		},
		// 	})
		// })

		it("proxyList", () => {
			const db = new OrderedTriplestore()
			writeObj(db, game, GameObj)
			writeObj(db, player1, PlayerObj)
			writeObj(db, player2, PlayerObj)

			const p = proxyObj(db, game.id, GameObj)
			assert.equal(p.players.length, 2)
			assert.equal(p.players[0], player1.id)
			assert.equal(p.players[1], player2.id)
			assert.deepEqual(p.players, [player1.id, player2.id])
			assert.deepEqual([...p.players], [player1.id, player2.id])

			// This needs to print out correctly!
			// Seems it might not be possible: https://stackoverflow.com/questions/35929369/mobx-observable-array-does-not-display-correctly
			// console.log("HERE", p.players, [...p.players])

			const players = proxyList(db, game.id, "players", t.string)
			assert.equal(players.length, 2)
			assert.deepEqual(players, [player1.id, player2.id])
		})

		it("appendProp", () => {
			const db = new OrderedTriplestore()
			writeObj(db, game, GameObj)
			writeObj(db, player1, PlayerObj)
			writeObj(db, player2, PlayerObj)

			appendProp(db, game.id, "players", "player3", t.string)
			const players = proxyList(db, game.id, "players", t.string)
			assert.deepEqual(players, [player1.id, player2.id, "player3"])
		})

		it("proxyList push()", () => {
			const db = new OrderedTriplestore()
			writeObj(db, game, GameObj)
			writeObj(db, player1, PlayerObj)
			writeObj(db, player2, PlayerObj)

			const players = proxyList(db, game.id, "players", t.string)
			players.push("player3")
			assert.deepEqual(players, [player1.id, player2.id, "player3"])
		})

		it("subscribeObj", () => {
			const db = new OrderedTriplestore()
			writeObj(db, game, GameObj)
			writeObj(db, player1, PlayerObj)
			writeObj(db, player2, PlayerObj)

			let g: Game
			const [initialGame, unsubscribe] = subscribeObj(
				db,
				game.id,
				GameObj,
				(newGame) => {
					g = newGame
				}
			)
			g = initialGame

			const player1Id = g.players[0]
			const player2Id = g.players[1]

			let p1: Player
			const [initialPlayer1, unsubscribe1] = subscribeObj(
				db,
				player1Id,
				PlayerObj,
				(newPlayer1) => {
					p1 = newPlayer1
				}
			)
			p1 = initialPlayer1

			let p2: Player
			const [initialPlayer2, unsubscribe2] = subscribeObj(
				db,
				player2Id,
				PlayerObj,
				(newPlayer2) => {
					p2 = newPlayer2
				}
			)
			p2 = initialPlayer2

			const pp1 = proxyObj(db, p1.id, PlayerObj)
			const pp2 = proxyObj(db, p2.id, PlayerObj)

			pp1.name = "Chet"
			pp1.score = 6

			assert.deepEqual(p1, {
				id: player1.id,
				name: "Chet",
				score: 6,
			})

			pp2.name = "Meghan"
			pp2.score = 9

			assert.deepEqual(p2, {
				id: player2.id,
				name: "Meghan",
				score: 9,
			})

			assert.deepEqual(g, {
				id: game.id,
				players: [p1.id, p2.id],
			})
		})
	})
})
