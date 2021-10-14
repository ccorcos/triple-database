import * as t from "data-type-ts"
import { composeTx } from "tuple-database/helpers/transactional"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"
import {
	ReadOnlyTupleStorage,
	Transaction,
	Tuple,
	TupleStorage,
	Value,
} from "tuple-database/storage/types"
import { first, last, single } from "../helpers/listHelpers"

export class OrderedTriplestore extends ReactiveStorage {
	constructor(storage?: TupleStorage) {
		super(storage || new InMemoryStorage())
		// What if ordered list functionality was built into a Triplestore?
		// I don't like all the indirection needed to reify lists and list items with Triplestores.
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

// This is the subset of JSON that we can represent.
type Prop = string | number | boolean | Obj

type Obj = {
	id: string
	[key: string]: Prop | Prop[] // NOTE: no nested arrays.
}

// Example of how objects serialize.
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
// You might think its inconvenient to require a schema definition here.
// While it seems unnecessary here, it is absolutely necessarty when calling readObj.
// And thus, it seems to make sense to validate data on its way into the database as well.
export function objToTuples<T extends Obj>(
	obj: T,
	schema: t.RuntimeDataType<T> | t.DataType
) {
	const dataType = "dataType" in schema ? schema.dataType : schema
	if (dataType.type !== "object") throw new Error("Not an object schema.")

	const tuples: Tuple[] = []

	for (const [key, keySchema] of Object.entries(dataType.required)) {
		if (key === "id") continue
		if (keySchema.type === "array") {
			const list = obj[key]
			if (!Array.isArray(list)) throw new Error("Schema != Obj.")

			for (let i = 0; i < list.length; i++) {
				const value = list[i]
				const valueSchema = keySchema.inner

				if (valueSchema.type === "object") {
					if (typeof value !== "object") throw new Error("Schema != Obj")
					tuples.push(["eaov", obj.id, key, i, value.id])
					tuples.push(...objToTuples(value, new t.RuntimeDataType(valueSchema)))
				} else if (
					valueSchema.type === "string" ||
					valueSchema.type === "number" ||
					valueSchema.type === "boolean"
				) {
					tuples.push(["eaov", obj.id, key, i, value])
				} else if (valueSchema.type === "array") {
					throw new Error("No nested arrays.")
				} else {
					throw new Error("Invalid schema type.")
				}
			}
		} else if (keySchema.type === "object") {
			const keyObj = obj[key]
			if (typeof keyObj !== "object" || Array.isArray(keyObj))
				throw new Error("Schema != Obj")

			tuples.push(["eaov", obj.id, key, null, keyObj.id])
			tuples.push(...objToTuples(keyObj, new t.RuntimeDataType(keySchema)))
		} else if (
			keySchema.type === "string" ||
			keySchema.type === "number" ||
			keySchema.type === "boolean"
		) {
			const value = obj[key]
			if (typeof value !== keySchema.type) throw new Error("Schema != Obj")
			tuples.push(["eaov", obj.id, key, null, value])
		} else {
			throw new Error("Invalid schema type.")
		}
	}
	return tuples
}

// Opposite of `objToTuples`.
// Read the database for a given object id and create the object defined by a schema.
export function readObj<T extends Obj>(
	db: ReadOnlyTupleStorage,
	id: string,
	schema: t.RuntimeDataType<T> | t.DataType
): T {
	const dataType = "dataType" in schema ? schema.dataType : schema
	if (dataType.type !== "object") throw new Error("Not an object schema.")

	const obj: any = { id }
	for (const [key, keySchema] of Object.entries(dataType.required)) {
		obj[key] = readProp(db, id, key, keySchema)
	}
	return obj
}

function readProp<T>(
	db: ReadOnlyTupleStorage,
	id: string,
	prop: string,
	schema: t.RuntimeDataType<T> | t.DataType
) {
	if (prop === "id") return id

	const values = db
		.scan({ prefix: ["eaov", id, prop] })
		.map(([tuple]) => tuple[tuple.length - 1])

	return readValue(db, values, schema)
}

function readValue<T>(
	db: ReadOnlyTupleStorage,
	values: Value[],
	schema: t.RuntimeDataType<T> | t.DataType
): T {
	const dataType = "dataType" in schema ? schema.dataType : schema
	if (dataType.type === "array") {
		// NOTE: a list of lists is not going to work!
		// Solution would be an "EAO*V" index.
		const inner = new t.RuntimeDataType(dataType.inner)
		return values.map((value) => readValue(db, [value], inner)) as any
	}

	const value = single(values)

	if (dataType.type === "object") {
		if (typeof value !== "string")
			throw new Error("Object reference should be a string.")
		return readObj(db, value, dataType) as any
	}

	if (
		dataType.type === "number" ||
		dataType.type === "string" ||
		dataType.type === "boolean"
	) {
		const error = t.validateDataType(dataType, value)
		if (error) throw new Error(t.formatError(error))
		return value as any
	}

	throw new Error("Unsupported schema: " + dataType.type)
}

export function writeObj<T extends { id: string }>(
	dbOrTx: TupleStorage | Transaction,
	obj: T,
	schema: t.RuntimeDataType<T> | t.DataType
) {
	return composeTx(dbOrTx, (tx) => {
		const facts = objToTuples(obj, schema)
		facts.forEach((tuple) => tx.set(tuple, null))
	})
}

// // Delete obj doesn't require a schema because we also handle inverse relationships
// // and it just extra save to get all of the id references cleaned up.
export function hardDeleteObj(
	dbOrTx: TupleStorage | Transaction,
	id: string,
	backlinks = false
) {
	return composeTx(dbOrTx, (tx) => {
		const objectProperties = tx.scan({ prefix: ["eaov", id] }).map(first)
		tx.write({ remove: objectProperties })

		if (backlinks) {
			const inverseRelationships = tx
				.scan({ prefix: ["vaeo", id] })
				.map(first)
				.map(([vaeo, v, a, e, o]) => ["eaov", e, a, o, v] as Tuple)
			tx.write({ remove: inverseRelationships })
		}
	})
}

export function deleteObj<T extends Obj>(
	dbOrTx: TupleStorage | Transaction,
	id: string,
	schema: t.RuntimeDataType<T> | t.DataType
) {
	return composeTx(dbOrTx, (tx) => {
		const obj = readObj(tx, id, schema)
		const tuples = objToTuples(obj, schema)
		tx.write({ remove: tuples })
	})
}

export function setProp<O extends Obj, T extends keyof O>(
	dbOrTx: TupleStorage | Transaction,
	id: string,
	property: T,
	value: O[T],
	schema: t.RuntimeDataType<O> | t.DataType
) {
	const dataType = "dataType" in schema ? schema.dataType : schema
	if (dataType.type !== "object")
		throw new Error("Set prop must be on an object schema.")

	const prop = property as number | string // just not symbol
	const propType = dataType.required[prop]

	if (propType.type === "object") throw new Error("No nested objects, yet.")
	if (propType.type === "array")
		throw new Error("Call the array mutation methods instead.")

	const error = t.validateDataType(propType, value)
	if (error) throw new Error(t.formatError(error))
	return composeTx(dbOrTx, (tx) => {
		const existing = tx.scan({ prefix: ["eaov", id, prop] }).map(first)
		tx.write({ remove: existing })
		tx.set(["eaov", id, prop, null, value], null)
	})
}

export function proxyObj<T extends { id: string }>(
	db: TupleStorage | Transaction,
	id: string,
	schema: t.RuntimeDataType<T> | t.DataType
): T {
	const dataType = "dataType" in schema ? schema.dataType : schema
	if (dataType.type !== "object") throw new Error("Must be object schema.")

	return new Proxy<T>({} as any, {
		get(target, prop) {
			if (typeof prop === "symbol") return undefined
			if (!(prop in dataType.required)) return undefined
			const propType = dataType.required[prop]

			if (propType.type === "object") {
				throw new Error("No nested objects, yet.")
				// const otherId = readProp(db, id, prop, t.string)
				// return proxyObj(db, otherId, propType)
			}

			if (propType.type === "array") {
				return proxyList(db, id, prop, propType.inner)
			}

			return readProp(db, id, prop, propType)
		},
		set(target, prop, value) {
			if (typeof prop === "symbol") throw new Error("No symbols.")
			if (prop === "id") throw new Error("The id is reserved.")
			if (!(prop in dataType.required))
				throw new Error("Invalid property for schema.")

			setProp(db, id, prop, value, dataType)
			return true
		},
	})
}

export function proxyList<T>(
	db: TupleStorage | Transaction,
	id: string,
	listProp: string,
	schema: t.RuntimeDataType<T> | t.DataType
): T[] {
	const dataType = "dataType" in schema ? schema.dataType : schema
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
					const error = t.validateDataType(dataType, value)
					if (error) throw new Error(t.formatError(error))

					const results = db
						.scan({ prefix: ["eaov", id, listProp], reverse: true, limit: 1 })
						.map(first)

					let index: number = 0
					if (results.length !== 0) {
						const order = single(results)[3]
						const error = t.number.validate(order)
						if (error) throw new Error(t.formatError(error))
						index = order as any
						index += 1
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
				const error = t.validateDataType(dataType, value)
				if (error) throw new Error(t.formatError(error))
				return value
			}
		},
	})
}

export function subscribeObj<T extends { id: string }>(
	db: ReactiveStorage,
	id: string,
	schema: t.RuntimeDataType<T>,
	callback: (obj: T) => void
) {
	if (schema.dataType.type !== "object")
		throw new Error("Schema should be an object.")

	let obj = readObj(db, id, schema)

	const unsubscribes = new Set<() => void>()
	for (const [prop, propType] of Object.entries(schema.dataType.required)) {
		unsubscribes.add(
			db.subscribe({ prefix: ["eaov", id, prop] }, (writes) => {
				const value = readProp(db, id, prop, new t.RuntimeDataType(propType))
				obj = { ...obj, [prop]: value }
				callback(obj)
			})
		)
	}

	const unsubscribe = () => unsubscribes.forEach((fn) => fn())

	return [obj, unsubscribe] as const
}
