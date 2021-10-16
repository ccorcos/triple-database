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

// ============================================================================
// Types
// ============================================================================

// This is the subset of JSON that we can represent.
type Prop = string | number | boolean | Obj

export type Obj = {
	id: string
	[key: string]: Prop | Prop[] // NOTE: no nested arrays.
}

const isProxyObjSymbol = Symbol("isProxyObjSymbol")
const isProxyListSymbol = Symbol("isProxyListSymbol")
const toJsonSymbol = Symbol("toJsonSymbol")

type ProxyProp<T extends Prop = Prop> = T extends Obj ? ProxyObj<T> : T

type ProxyObjProp<T extends Prop | Prop[] = Prop | Prop[]> = T extends Prop[]
	? ProxyList<ProxyProp<T[number]>>
	: T extends Obj
	? ProxyObj<T>
	: T

type ProxyObj<T extends Obj> = {
	[isProxyObjSymbol]: true
	[toJsonSymbol](): T
} & {
	[K in keyof T]: ProxyObjProp<T[K]>
}

type ProxyList<T extends Prop> = {
	[isProxyListSymbol]: true
	// [proxyCursorSymbol]: [string, string] // [id, prop]
	[toJsonSymbol](): T[]
	[index: number]: ProxyProp<T>
	length: number
} & ProxyListFns<T>

type ProxyListFns<T> = {
	[Symbol.iterator]: () => Generator<T, void, unknown>
	push(value: T): void
	delete(value: T, index?: number | null): void
	// if (property === "splice")
	// if (property === "insertAfter")
	// if (property === "insertBelow")
	// if (property === "remove...?")
}

// ============================================================================
// Basic Read/Write Helpers
// ============================================================================

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

// Delete obj doesn't require a schema because we also handle inverse relationships
// and its just extra safe to get all of the id references cleaned up.
export function hardDeleteObj(
	dbOrTx: TupleStorage | Transaction,
	id: string,
	backlinks = true
) {
	return composeTx(dbOrTx, (tx) => {
		const objectProperties = tx.scan({ prefix: ["eaov", id] }).map(first)
		tx.write({ remove: objectProperties })
		if (backlinks) deleteBacklinks(dbOrTx, id)
	})
}

export function deleteBacklinks(
	dbOrTx: TupleStorage | Transaction,
	id: string
) {
	return composeTx(dbOrTx, (tx) => {
		const backlinks = tx
			.scan({ prefix: ["vaeo", id] })
			.map(first)
			.map(([vaeo, v, a, e, o]) => ["eaov", e, a, o, v] as Tuple)
		tx.write({ remove: backlinks })
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

// ============================================================================
// Proxy Helpers
// ============================================================================

export function setObjProp<O extends Obj, T extends keyof O>(
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

	if (propType.type === "array")
		throw new Error("Call the array mutation methods instead.")

	if (propType.type === "object")
		// If we overwrite an object, do we delete the old one? It's better to make
		// developers be explicit.
		throw new Error("Flatten your schema so there are no nested objects.")

	const error = t.validateDataType(propType, value)
	if (error) throw new Error(t.formatError(error))

	return composeTx(dbOrTx, (tx) => {
		const existing = tx.scan({ prefix: ["eaov", id, prop] }).map(first)
		tx.write({ remove: existing })
		tx.set(["eaov", id, prop, null, value], null)
	})
}

export function getProxyObjProp<O extends Obj, T extends keyof O>(
	db: TupleStorage | Transaction,
	id: string,
	property: T,
	schema: t.RuntimeDataType<T> | t.DataType
): ProxyObjProp<O[T]> {
	const dataType = "dataType" in schema ? schema.dataType : schema
	if (dataType.type !== "object") throw new Error("Must be object schema.")

	if (property === isProxyObjSymbol) return true as any
	if (property === toJsonSymbol) throw new Error("Not implemented yet.")
	if (typeof property === "symbol") return undefined as any

	if (!(property in dataType.required)) return undefined as any

	const prop = property as string
	const propType = dataType.required[prop]

	if (propType.type === "object")
		throw new Error("Flatten your schema so there are no nested objects.")

	if (propType.type === "array")
		return proxyList(db, id, prop, propType.inner) as any

	return readProp(db, id, prop, propType) as any
}

// TODO: this inherently must be a flat object.
// Otherwise we have ambiguities.
// obj.key = otherObj or list[1] = otherObj
// Do we delete the old object? Or just unlink it?
// Also, what if we just want the id? Since objects have arbitrary keys,
// it's impossible to get both of these functionalities without having reserved words...
export function proxyObj<T extends Obj>(
	db: TupleStorage | Transaction,
	id: string,
	schema: t.RuntimeDataType<T> | t.DataType
): ProxyObj<T> {
	const dataType = "dataType" in schema ? schema.dataType : schema
	if (dataType.type !== "object") throw new Error("Must be object schema.")

	return new Proxy<ProxyObj<T>>({} as any, {
		// This allows deepEqual to work.
		ownKeys: function () {
			return Object.keys(dataType.required)
		},
		getOwnPropertyDescriptor: (target, prop) => {
			return {
				value: getProxyObjProp(db, id, prop as any, dataType),
				enumerable: true,
				configurable: true,
			}
		},
		get(target, prop) {
			return getProxyObjProp(db, id, prop as any, dataType)
		},
		set(target, prop, value) {
			if (typeof prop === "symbol") throw new Error("No symbols.")
			if (prop === "id") throw new Error("The id is reserved.")
			if (!(prop in dataType.required))
				throw new Error("Invalid property for schema.")

			setObjProp(db, id, prop, value, dataType)
			return true
		},
	})
}

export function appendProp<T extends Prop>(
	dbOrTx: TupleStorage | Transaction,
	id: string,
	listProp: string,
	value: T,
	schema: t.RuntimeDataType<T> | t.DataType
) {
	const dataType = "dataType" in schema ? schema.dataType : schema
	const error = t.validateDataType(dataType, value)
	if (error) throw new Error(t.formatError(error))

	const results = dbOrTx
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

	composeTx(dbOrTx, (tx) => {
		tx.set(["eaov", id, listProp, index, value], null)
	})
}

export function getProxyListItem<T extends Prop>(
	db: ReadOnlyTupleStorage,
	id: string,
	prop: string,
	index: number,
	schema: t.RuntimeDataType<T> | t.DataType
): T {
	const dataType = "dataType" in schema ? schema.dataType : schema
	if (dataType.type === "array") throw new Error("No arrays inside array.")
	if (dataType.type === "object")
		throw new Error("Flatten your schema. No nested objects inside lists.")

	const values = db
		.scan({ prefix: ["eaov", id, prop] })
		.map(first)
		.map(last)
	const value = values[index]

	const error = t.validateDataType(dataType, value)
	if (error) throw new Error(t.formatError(error))
	return value as any
}

export function getListItemIndexes(
	db: ReadOnlyTupleStorage,
	eav: [Value, Value, Value]
) {
	const [e, a, v] = eav
	const indexes = db
		.scan({ prefix: ["vaeo", v, a, e] })
		.map(first) // [key, value] => key
		.map(last) // ["vaeo", v, a, e, o] => o
		.filter(t.or(t.number, t.null_).is) // only numbers for now. fractional indexing later.
	return indexes
}

export function proxyList<T extends Prop>(
	db: TupleStorage | Transaction,
	id: string,
	listProp: string,
	schema: t.RuntimeDataType<T> | t.DataType
): ProxyList<T> {
	const dataType = "dataType" in schema ? schema.dataType : schema
	if (dataType.type === "object") throw new Error("No nested objects, yet.")
	if (dataType.type === "array") throw new Error("No nested array.")

	const getListProxyProp = (prop: string | symbol) => {
		if (prop === isProxyListSymbol) return true
		if (prop === toJsonSymbol) throw new Error("Not implemented yet.")

		if (prop === "length") {
			return db.scan({ prefix: ["eaov", id, listProp] }).length
		}

		const fns: ProxyListFns<T> = {
			*[Symbol.iterator]() {
				// TODO: validate the schema here.
				const values = db
					.scan({ prefix: ["eaov", id, listProp] })
					.map(first)
					.map(last)
				for (const value of values) {
					const error = t.validateDataType(dataType, value)
					if (error)
						throw new Error("Item does not match schema: " + dataType.type)
					yield value as T
				}
			},
			push(value: T) {
				appendProp(db, id, listProp, value, dataType)
			},
			/**
			 * Deletes value at index.
			 * Index is null for object properties... that shouldn't be relevant here.
			 * When undefined, we lookup and delete from all positions.
			 * Number should maybe fetch the whole list and delete the nth item.
			 * String should be fractionally indexed.
			 *
			 * this function is a WIP.
			 */
			delete(value, index) {
				let indexes: (number | null)[] = []
				if (index === undefined) {
					indexes = getListItemIndexes(db, [id, listProp, value])
				} else {
					indexes.push(index)
				}

				composeTx(db, (tx) => {
					for (const index of indexes) {
						tx.remove(["eaov", id, listProp, index, value])
					}
				})
			},
		}

		if (fns[prop]) {
			return fns[prop]
		}

		if (typeof prop === "symbol") return undefined

		const n = parseInt(prop)
		if (!isNaN(n)) return getProxyListItem(db, id, listProp, n, dataType)
	}

	// Putting this string in there means that it will print out when inspecting
	// from the console which is less confusing than an empty list.
	const obj = ["ProxyList<T>"] as any
	return new Proxy(obj as ProxyList<T>, {
		// This allows deepEqual to work.
		ownKeys: function () {
			return ["length"]
		},
		getOwnPropertyDescriptor: (target, key) => {
			return {
				writable: key === "length",
				value: getListProxyProp(key),
				enumerable: key !== "length",
				configurable: key !== "length",
			}
		},
		get(target, prop) {
			return getListProxyProp(prop)
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
		if (prop === "id") continue
		unsubscribes.add(
			db.subscribe({ prefix: ["eaov", id, prop] }, (writes) => {
				try {
					// TODO: only catch the error if its not valid for the schema.
					// This can error when we're deleting an object.
					const value = readProp(db, id, prop, new t.RuntimeDataType(propType))
					obj = { ...obj, [prop]: value }
					callback(obj)
				} catch (error) {
					// console.error(error)
				}
			})
		)
	}

	const unsubscribe = () => unsubscribes.forEach((fn) => fn())

	return [obj, unsubscribe] as const
}
