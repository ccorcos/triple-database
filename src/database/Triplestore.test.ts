import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { Triplestore } from "./Triplestore"

describe("Triplestore", () => {
	it("Works1", () => {
		const store = new Triplestore(new InMemoryStorage())

		store
			.transact()
			.set(["0001", "type", "Person"])
			.set(["0001", "firstName", "Chet"])
			.set(["0001", "lastName", "Corcos"])
			.set(["0002", "type", "Person"])
			.set(["0002", "firstName", "Meghan"])
			.set(["0002", "lastName", "Navarro"])
			.commit()

		const queryResult = store.queryFacts({
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

		const scanResult = store.scanIndex({ prefix: ["personByLastFirst"] })
		assert.deepEqual(scanResult, [
			[["personByLastFirst", "Corcos", "Chet", "0001"], null],
			[["personByLastFirst", "Navarro", "Meghan", "0002"], null],
		])
	})

	it("Handles arbitrary classes", () => {
		const store = new Triplestore(new InMemoryStorage())

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
})
