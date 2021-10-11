import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { createContactsDb, createFamilyDb } from "../test/fixtures"
import { snapshotTest } from "../test/snapshotTest"
import { defineIndex, getDefineIndexPlan } from "./defineIndex"
import {
	getPopulateIndexPlan,
	populateIndex,
	prettyPopulateIndexPlan,
	prettyPopulateIndexReport,
} from "./populateIndex"
import { scanIndex } from "./scanIndex"

const id = { var: "id" }
const firstName = { var: "firstName" }
const lastName = { var: "lastName" }
const mom = { var: "mom" }
const dad = { var: "dad" }
const aunt = { var: "aunt" }

describe("populateIndex", () => {
	describe("ContactsDb", () => {
		snapshotTest("prettyPopulateIndexPlan", () => {
			const definePlan = getDefineIndexPlan({
				name: "person-last-first",
				filter: [
					[
						[id, { value: "type" }, { value: "person" }],
						[id, { value: "firstName" }, firstName],
						[id, { value: "lastName" }, lastName],
					],
				],
				sort: [lastName, firstName, id],
			})
			const plan = getPopulateIndexPlan(definePlan)
			return prettyPopulateIndexPlan(plan)
		})

		snapshotTest("prettyPopulateIndexReport", () => {
			const storage = createContactsDb()
			const transaction = storage.transact()
			const index = defineIndex(transaction, {
				name: "person-last-first",
				filter: [
					[
						[id, { value: "type" }, { value: "person" }],
						[id, { value: "firstName" }, firstName],
						[id, { value: "lastName" }, lastName],
					],
				],
				sort: [lastName, firstName, id],
			})
			const report = populateIndex(transaction, index)
			return prettyPopulateIndexReport(report)
		})

		it("scanIndex", () => {
			const storage = createContactsDb()
			const transaction = storage.transact()
			const index = defineIndex(transaction, {
				name: "person-last-first",
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

			const data = scanIndex(storage, { index: index.name })
			assert.deepEqual(data, [
				["Corcos", "Chet", "XXX1"],
				["Corcos", "Leon", "XXX3"],
				["Corcos", "Sam", "XXX2"],
				["Haas", "Wes", "XXX5"],
				["Langdon", "Andrew", "XXX4"],
				["Last", "Simon", "XXX6"],
			])
		})
	})

	describe("FamilyDb", () => {
		describe("aunts", () => {
			it("scanIndex", () => {
				const storage = createFamilyDb()
				const transaction = storage.transact()
				const index = defineIndex(transaction, {
					name: "aunts",
					filter: [
						[
							[id, { value: "mom" }, mom],
							[mom, { value: "sister" }, aunt],
						],
						[
							[id, { value: "dad" }, dad],
							[dad, { value: "sister" }, aunt],
						],
					],
					sort: [id, aunt],
				})
				populateIndex(transaction, index)
				transaction.commit()

				const data = scanIndex(storage, { index: index.name })
				assert.deepEqual(data, [
					["chet", "melanie"],
					["chet", "ruth"],
					["chet", "stephanie"],
					["chet", "sue"],
				])
			})
		})
	})
})
