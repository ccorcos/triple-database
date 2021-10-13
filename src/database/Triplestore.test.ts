import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { Triplestore } from "./Triplestore"

describe("Triplestore", () => {
	it("Works", () => {
		const store = new Triplestore()

		store
			.transact()
			.set(["0001", "type", "Person"])
			.set(["0001", "firstName", "Chet"])
			.set(["0001", "lastName", "Corcos"])
			.set(["0002", "type", "Person"])
			.set(["0002", "firstName", "Meghan"])
			.set(["0002", "lastName", "Navarro"])
			.commit()

		const queryResult = store.querySort({
			filter: [
				[
					[{ var: "id" }, { value: "type" }, { value: "Person" }],
					[{ var: "id" }, { value: "firstName" }, { var: "firstName" }],
					[{ var: "id" }, { value: "lastName" }, { var: "lastName" }],
				],
			],
			sort: [{ var: "lastName" }, { var: "firstName" }, { var: "id" }],
		})

		assert.deepEqual(queryResult, [
			["Corcos", "Chet", "0001"],
			["Navarro", "Meghan", "0002"],
		])

		store.ensureIndex({
			name: "personByLastFirst",
			filter: [
				[
					[{ var: "id" }, { value: "type" }, { value: "Person" }],
					[{ var: "id" }, { value: "firstName" }, { var: "firstName" }],
					[{ var: "id" }, { value: "lastName" }, { var: "lastName" }],
				],
			],
			sort: [{ var: "lastName" }, { var: "firstName" }, { var: "id" }],
		})

		const scanResult = store.scanIndex({ index: "personByLastFirst" })
		assert.deepEqual(scanResult, [
			["Corcos", "Chet", "0001"],
			["Navarro", "Meghan", "0002"],
		])
	})

	it("Indexing will not remove if redundant value", () => {
		const store = new Triplestore()

		store
			.transact()
			.set(["a", "follows", "b"])
			.set(["b", "follows", "x"])
			.set(["a", "follows", "c"])
			.set(["c", "follows", "x"])
			.commit()

		store.ensureIndex({
			name: "fof", // follows of follows
			filter: [
				[
					[{ var: "a" }, { value: "follows" }, { var: "b" }],
					[{ var: "b" }, { value: "follows" }, { var: "c" }],
				],
			],
			sort: [{ var: "a" }, { var: "c" }],
		})

		assert.deepEqual(store.scanIndex({ index: "fof" }), [["a", "x"]])

		// Add an additional follow
		store.transact().set(["c", "follows", "y"]).commit()
		assert.deepEqual(store.scanIndex({ index: "fof" }), [
			["a", "x"],
			["a", "y"],
		])

		// Still follows x due to a -> b -> x relationship.
		store.transact().remove(["a", "follows", "c"]).commit()
		assert.deepEqual(store.scanIndex({ index: "fof" }), [["a", "x"]])

		store.transact().remove(["b", "follows", "x"]).commit()
		assert.deepEqual(store.scanIndex({ index: "fof" }), [])
	})

	it("Indexing will not remove if redundant value with fully defined sort", () => {
		const store = new Triplestore()

		store
			.transact()
			.set(["a", "follows", "b"])
			.set(["b", "follows", "x"])
			.set(["a", "follows", "c"])
			.set(["c", "follows", "x"])
			.commit()

		store.ensureIndex({
			name: "fof", // follows of follows
			filter: [
				[
					[{ var: "a" }, { value: "follows" }, { var: "b" }],
					[{ var: "b" }, { value: "follows" }, { var: "c" }],
				],
			],
			sort: [{ var: "a" }, { var: "c" }, { var: "b" }],
		})

		assert.deepEqual(store.scanIndex({ index: "fof" }), [
			["a", "x", "b"],
			["a", "x", "c"],
		])

		// Add an additional follow
		store.transact().set(["c", "follows", "y"]).commit()
		assert.deepEqual(store.scanIndex({ index: "fof" }), [
			["a", "x", "b"],
			["a", "x", "c"],
			["a", "y", "c"],
		])

		// Still follows x due to a -> b -> x relationship.
		store.transact().remove(["a", "follows", "c"]).commit()
		assert.deepEqual(store.scanIndex({ index: "fof" }), [["a", "x", "b"]])

		store.transact().remove(["b", "follows", "x"]).commit()
		assert.deepEqual(store.scanIndex({ index: "fof" }), [])
	})

	it("Handles arbitrary classes", () => {
		const store = new Triplestore()

		class AnyObject {}

		const obj = new AnyObject()
		store
			.transact()
			.set([1, "something", 2])
			.set([1, "something", obj])
			.commit()

		const queryResult = store.query({
			filter: [[[{ var: "id" }, { value: "something" }, { var: "something" }]]],
		})

		assert.deepEqual(queryResult, [
			{ id: 1, something: obj },
			{ id: 1, something: 2 },
		])
	})

	it("Index is updates after writes.", () => {
		const db = new Triplestore()

		db.transact()
			.set(["chet", "color", "blue"])
			.set(["sean", "color", "green"])
			.commit()

		assert.deepEqual(
			db.query({
				filter: [[[{ var: "person" }, { value: "color" }, { var: "color" }]]],
			}),
			[
				{ person: "chet", color: "blue" },
				{ person: "sean", color: "green" },
			]
		)

		assert.deepEqual(
			db.querySort({
				filter: [[[{ var: "person" }, { value: "color" }, { var: "color" }]]],
				sort: [{ var: "color" }, { var: "person" }],
			}),
			[
				["blue", "chet"],
				["green", "sean"],
			]
		)

		db.ensureIndex({
			name: "personByColor",
			filter: [[[{ var: "person" }, { value: "color" }, { var: "color" }]]],
			sort: [{ var: "color" }, { var: "person" }],
		})

		assert.deepEqual(db.scanIndex({ index: "personByColor" }), [
			["blue", "chet"],
			["green", "sean"],
		])

		db.transact().set(["meghan", "color", "yellow"]).commit()

		assert.deepEqual(db.scanIndex({ index: "personByColor" }), [
			["blue", "chet"],
			["green", "sean"],
			["yellow", "meghan"],
		])
	})
})
