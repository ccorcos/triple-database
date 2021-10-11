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
						[id, { lit: "type" }, { lit: "person" }],
						[id, { lit: "firstName" }, firstName],
						[id, { lit: "lastName" }, lastName],
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
						[id, { lit: "type" }, { lit: "person" }],
						[id, { lit: "firstName" }, firstName],
						[id, { lit: "lastName" }, lastName],
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
						[id, { lit: "type" }, { lit: "person" }],
						[id, { lit: "firstName" }, firstName],
						[id, { lit: "lastName" }, lastName],
					],
				],
				sort: [lastName, firstName, id],
			})

			populateIndex(transaction, index)
			transaction.commit()

			const data = storage.scan({ prefix: [index.name] })
			assert.deepEqual(data, [
				[[index.name, "Corcos", "Chet", "XXX1"], null],
				[[index.name, "Corcos", "Leon", "XXX3"], null],
				[[index.name, "Corcos", "Sam", "XXX2"], null],
				[[index.name, "Haas", "Wes", "XXX5"], null],
				[[index.name, "Langdon", "Andrew", "XXX4"], null],
				[[index.name, "Last", "Simon", "XXX6"], null],
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
							[id, { lit: "mom" }, mom],
							[mom, { lit: "sister" }, aunt],
						],
						[
							[id, { lit: "dad" }, dad],
							[dad, { lit: "sister" }, aunt],
						],
					],
					sort: [id, aunt],
				})
				populateIndex(transaction, index)
				transaction.commit()

				const data = storage.scan({ prefix: [index.name] })
				assert.deepEqual(data, [
					[[index.name, "chet", "melanie"], null],
					[[index.name, "chet", "ruth"], null],
					[[index.name, "chet", "stephanie"], null],
					[[index.name, "chet", "sue"], null],
				])
			})
		})
	})
})
