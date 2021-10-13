import { strict as assert } from "assert"
import * as t from "data-type-ts"
import { differenceWith } from "lodash"
import { describe, it } from "mocha"
import { compareValue } from "tuple-database/helpers/compareTuple"
import { Triplestore } from "../database/Triplestore"
import { Fact, Value } from "../database/types"

const db = new Triplestore()

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

// id => {id} for the sake of duck typing.
function gameToFacts(game: typeof Game["value"]) {
	const facts: Fact[] = []

	const playersListId = randomId()
	facts.push([game.id, "players", playersListId])

	for (let i = 0; i < game.players.length; i++) {
		const player = game.players[i]
		const playerItemId = randomId()
		facts.push(
			[playersListId, "item", playerItemId],
			[playerItemId, "value", player.id],
			[playerItemId, "order", i]
		)

		facts.push(
			[player.id, "name", player.name],
			[player.id, "score", player.score]
		)
	}

	return facts
}

// What if lists were built in?
// - [e, a, o, v]
// - [e, a, v, o]
// - [a, v, e]
// - [v, a, e]
// - [e, v, a]

// - [doc tag red], [dog tag blue],
//   [list entity dog], [list property tag], [list item item1], [item1 value red], [list item item2], [item2 value blue]

function loadProperty<T>(
	db: Triplestore,
	id: string,
	property: string,
	schema: t.RuntimeDataType<T>
): T {
	// There's no reason we need to be married to the triplestore model. So long as we can build queries and build the
	// application. Here, for example, we can just call `db.storage.scan({prefix: ["eav", id, property]})`.

	// We can patch into this

	const result = db.query({
		filter: [[[{ value: id }, { value: property }, { var: "value" }]]],
	})

	const dataType = schema.dataType
	if (dataType.type === "object") {
	} else if (dataType.type === "array") {
	} else if (dataType.type === "string") {
	} else if (dataType.type === "number") {
	} else if (dataType.type === "boolean") {
	}

	return {} as any
}

function loadObject<T>(
	db: Triplestore,
	id: string,
	schema: t.RuntimeDataType<T>
): T {
	const dataType = schema.dataType
	if (dataType.type === "object") {
		dataType.required
		dataType.optional
	} else if (dataType.type === "array") {
	}
	return {} as any
}

// I like this idea -- of a declarative way to patch into an existing object.
// It also allows you to decouple components completely while keeping them in sync.
// At the end of the day, this is going to be a pretty general way of syncing / ingesting data.

// function getGame(gameId: string): t.Infer<typeof Game> {
// 	// const playersId = gameId + "/players"
// 	// const playerIds = list(playersId).slice(0)
// 	// playerIds.map(playerId => obj(playerId))
// 	return {} as any
// }

// function updateGame(prev: t.Infer<typeof Game>, next: t.Infer<typeof Game>) {
// 	// Diff games and update the model.
// }

// Game.schema
// Player.schema

// const obj2 = <T>(id: string, struct: s.Struct<T>): T & { id: string } => {
// 	if (struct.type === "object") {
// 	}

// 	if (struct.type === "array") {
// 	}
// }

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

function randomId() {
	return Math.random().toString().slice(4)
}

const list = (maybeId?: string) => {
	const id = maybeId === undefined ? randomId() : maybeId

	return new Proxy<Value[] & { id: string }>([] as any, {
		get(target, property) {
			if (typeof property === "symbol") throw new Error("No symbols.")
			if (property === "id") return id

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

const game = obj()
const playersList = list()

game.playersList = [playersList.id]

const player0 = obj()
player0.name = [""]
player0.score = [0]

const player1 = obj()
player1.name = [""]
player1.score = [0]

playersList.push(player0.id)
playersList.push(player1.id)

function addPlayer() {
	const newPlayer = obj()
	newPlayer.name = [""]
	newPlayer.score = [0]
	playersList.push(newPlayer.id)
}

function destroy(id: string) {
	const tx = db.transact()
	const propValue = tx.query({
		filter: [[[{ value: id }, { var: "prop" }, { var: "value" }]]],
	})
	for (const { prop, value } of propValue) {
		tx.remove([id, prop, value])
	}
	const relationProp = tx.query({
		filter: [[[{ var: "relation" }, { var: "prop" }, { value: id }]]],
	})
	for (const { relation, prop } of relationProp) {
		tx.remove([relation, prop, id])
	}
	tx.commit()
}

db.ensureIndex({
	name: "listItem",
	filter: [
		[
			[{ var: "listId" }, { value: "item" }, { var: "itemId" }],
			[{ var: "itemId" }, { value: "order" }, { var: "order" }],
			[{ var: "itemId" }, { value: "value" }, { var: "value" }],
		],
	],
	sort: [{ var: "listId" }, { var: "value" }, { var: "itemId" }],
})

function deletePlayer(id: string) {
	const [itemId] = db
		.scanIndex({
			index: "listItem",
			prefix: [playersList.id, id],
		})
		.map(([_listId, _value, itemId]) => itemId)

	destroy(id)
	destroy(itemId as string)
}

function editName(id: string, name: string) {
	obj(id).name = [name]
}

function incrementScore(id: string, delta: number) {
	const player = obj(id)
	const [score] = player.score
	player.score = [(score as number) + delta]
}

describe("Game Counter", () => {
	it("works", () => {
		assert.equal(playersList.length, 2)

		incrementScore(playersList[0] as string, 10)
		assert.equal(player0.score[0], 10)
		assert.equal(obj(playersList[0] as string).score[0], 10)

		addPlayer()
		assert.equal(playersList.length, 3)
	})
})
