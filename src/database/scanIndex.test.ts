import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { MAX } from "tuple-database/storage/types"
import { createContactsDb } from "../test/fixtures"
import { defineIndex } from "./defineIndex"
import { populateIndex } from "./populateIndex"
import { scanIndex } from "./scanIndex"

const id = { var: "id" }
const firstName = { var: "firstName" }
const lastName = { var: "lastName" }
const mom = { var: "mom" }
const dad = { var: "dad" }
const aunt = { var: "aunt" }

describe("scanIndex", () => {
	it("Prefix composes properly", () => {
		const storage = createContactsDb()
		const transaction = storage.transact()

		const index = defineIndex(transaction, {
			name: "personLastFirst",
			filter: [
				[
					[id, { value: "type" }, { value: "person" }],
					[id, { value: "firstName" }, firstName],
					[id, { value: "lastName" }, lastName],
				],
			],
			sort: [lastName, firstName, id],
		})

		populateIndex(transaction, index)
		transaction.commit()

		const data = scanIndex(storage, { index: index.name, prefix: ["Corcos"] })
		assert.deepEqual(data, [
			["Corcos", "Chet", "XXX1"],
			["Corcos", "Leon", "XXX3"],
			["Corcos", "Sam", "XXX2"],
		])
	})

	it("Gt works properly", () => {
		const storage = createContactsDb()
		const transaction = storage.transact()

		const index = defineIndex(transaction, {
			name: "personLastFirst",
			filter: [
				[
					[id, { value: "type" }, { value: "person" }],
					[id, { value: "firstName" }, firstName],
					[id, { value: "lastName" }, lastName],
				],
			],
			sort: [lastName, firstName, id],
		})

		populateIndex(transaction, index)
		transaction.commit()

		const data = scanIndex(storage, { index: index.name, gt: ["Corcos", MAX] })
		assert.deepEqual(data, [
			["Haas", "Wes", "XXX5"],
			["Langdon", "Andrew", "XXX4"],
			["Last", "Simon", "XXX6"],
		])
	})
})
