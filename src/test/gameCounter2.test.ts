// e, a, v, ea, ve, av
// What if lists were built in?
// - [e, a, o, v] -- list in order
// - [e, a, v, o] --
// - [a, v, e]
// - [v, e, a] -- how are two objects related?
// -

import * as t from "data-type-ts"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"
import { ReadOnlyTupleStorage, Value } from "tuple-database/storage/types"
import { Tuple } from "../main"

const db = new ReactiveStorage(new InMemoryStorage())

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

db.index((tx, op) => {
	if (op.tuple[0] !== "eaov") return
	const [_, e, a, o, v] = op.tuple
	// tx[op.type](["eaov", e, a, o, v], null)
	tx[op.type](["vaeo", v, a, e, o], null)
	tx[op.type](["aev", a, e, v], null)
	tx[op.type](["eva", e, v, a], null)
})

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
		if (keySchema.type === "array") {
			const list: any[] = obj[key] as any

			for (let i = 0; i < list.length; i++) {
				const value = list[i]
				const valueSchema = keySchema.inner

				if (valueSchema.type === "array") throw new Error("No nested arrays.")
				if (valueSchema.type === "object") {
					facts.push([obj.id, key, i, value.id])
					facts.push(...serializeObj(value, new t.RuntimeDataType(valueSchema)))
				} else if (
					valueSchema.type === "string" ||
					valueSchema.type === "number" ||
					valueSchema.type === "boolean"
				) {
					facts.push([obj.id, key, i, value])
				} else {
					throw new Error("Invalid JSON schema type.")
				}
			}
		} else if (keySchema.type === "object") {
			const keyObj: { id: string } = obj[key] as any

			facts.push([obj.id, key, null, keyObj.id])
			facts.push(...serializeObj(keyObj, new t.RuntimeDataType(keySchema)))
		} else if (
			keySchema.type === "string" ||
			keySchema.type === "number" ||
			keySchema.type === "boolean"
		) {
			const value = obj[key] as any
			facts.push([obj.id, key, null, value])
		} else {
			throw new Error("Invalid JSON schema type.")
		}
	}
	return facts
}

function single<T>(values: T[]): T {
	if (values.length !== 1) throw new Error("Too many object ids.")
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
		if (key === "string") continue
		const values = db
			.scan({ prefix: ["eaov", id, key] })
			.map(([tuple]) => tuple[tuple.length - 1])
		obj[key] = parseValue(db, values, new t.RuntimeDataType(keySchema))
	}

	return obj
}

const game: typeof Game.value = {
	id: randomId(),
	players: [
		{ id: randomId(), name: "", score: 0 },
		{ id: randomId(), name: "", score: 0 },
	],
}

const tx = db.transact()
for (const tuple of serializeObj(game, Game)) {
	tx.set(["eaov", ...tuple], null)
}
tx.commit()

console.log(db.scan())

const game2 = parseObj(db, game.id, Game)

console.log(game2)
