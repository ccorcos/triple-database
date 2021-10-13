import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { createContactsDb, createFamilyDb } from "../test/fixtures"
import { snapshotTest } from "../test/snapshotTest"
import { defineIndex } from "./defineIndex"
import { populateIndex } from "./populateIndex"
import { scanIndex } from "./scanIndex"
import {
	getUpdateIndexesPlan,
	prettyUpdateIndexesPlan,
	prettyUpdateIndexesReport,
	updateIndexes,
} from "./updateIndexes"
import { write } from "./write"

const id = { var: "id" }
const firstName = { var: "firstName" }
const lastName = { var: "lastName" }
const mom = { var: "mom" }
const dad = { var: "dad" }
const aunt = { var: "aunt" }
const sibling = { var: "sibling" }

describe("updateIndexes", () => {
	it("works2", () => {
		const storage = new InMemoryStorage()
		let tx = storage.transact()
		write(tx, {
			set: [
				["chet", "color", "blue"],
				["sean", "color", "green"],
			],
		})
		tx.commit()

		tx = storage.transact()
		defineIndex(tx, {
			name: "personByColor",
			filter: [[[{ var: "person" }, { value: "color" }, { var: "color" }]]],
			sort: [{ var: "color" }, { var: "person" }],
		})
		populateIndex(tx, {
			name: "personByColor",
			filter: [[[{ var: "person" }, { value: "color" }, { var: "color" }]]],
			sort: [{ var: "color" }, { var: "person" }],
		})
		tx.commit()

		assert.deepEqual(scanIndex(storage, { index: "personByColor" }), [
			["blue", "chet"],
			["green", "sean"],
		])

		tx = storage.transact()
		const report = write(tx, {
			set: [
				["chet", "color", "blue"],
				["meghan", "color", "yellow"],
			],
			remove: [["sean", "color", "green"]],
		})
		tx.commit()

		assert.deepEqual(scanIndex(storage, { index: "personByColor" }), [
			["blue", "chet"],
			["yellow", "meghan"],
		])
	})

	describe("ContactsDb", () => {
		snapshotTest("prettyUpdateIndexesPlan", () => {
			const storage = createContactsDb()
			const transaction = storage.transact()
			defineIndex(transaction, {
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
			transaction.commit()

			const plan = getUpdateIndexesPlan(storage, {
				type: "set",
				fact: ["XXXX", "firstName", "Joe"],
			})

			return prettyUpdateIndexesPlan(plan)
		})

		snapshotTest("prettyUpdateIndexesReport", () => {
			const storage = createContactsDb()
			const transaction = storage.transact()
			defineIndex(transaction, {
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

			const report = updateIndexes(transaction, {
				type: "set",
				fact: ["XXXX", "firstName", "Joe"],
			})

			return prettyUpdateIndexesReport(report)
		})
	})

	describe("FamilyDb", () => {
		describe("aunts", () => {
			snapshotTest("prettyUpdateIndexes", () => {
				const storage = createFamilyDb()
				const transaction = storage.transact()
				defineIndex(transaction, {
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
					sort: [aunt, id],
				})
				transaction.commit()

				const plan = getUpdateIndexesPlan(storage, {
					type: "remove",
					fact: ["deborah", "sister", "melanie"],
				})

				return prettyUpdateIndexesPlan(plan)
			})

			describe("prettyUpdateIndexesReport", () => {
				snapshotTest("set", () => {
					const storage = createFamilyDb()
					const transaction = storage.transact()
					defineIndex(transaction, {
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
						sort: [aunt, id],
					})
					transaction.commit()

					const report = updateIndexes(transaction, {
						type: "set",
						fact: ["deborah", "sister", "anne"],
					})

					return prettyUpdateIndexesReport(report)
				})

				snapshotTest("remove", () => {
					const storage = createFamilyDb()
					const transaction = storage.transact()
					defineIndex(transaction, {
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
						sort: [aunt, id],
					})
					// Add sam into the mix so the update indexes needs to check for both
					// sam and chet. This testing out that the reports correctly collapse.
					write(transaction, {
						set: [["sam", "mom", "deborah"]],
					})
					transaction.commit()

					const report = updateIndexes(transaction, {
						type: "remove",
						fact: ["deborah", "sister", "melanie"],
					})

					return prettyUpdateIndexesReport(report)
				})
			})
		})

		it("Adding sam updates aunts", () => {
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
			write(transaction, {
				set: [["sam", "mom", "deborah"]],
			})
			transaction.commit()

			const data = scanIndex(storage, { index: index.name })
			assert.deepEqual(data, [
				["chet", "melanie"],
				["chet", "ruth"],
				["chet", "stephanie"],
				["chet", "sue"],
				["sam", "melanie"],
				["sam", "ruth"],
				["sam", "sue"],
				// No stephanie because I didnt set sam's dad.
			])
		})

		it("Removing melanie updates aunts", () => {
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
			write(transaction, {
				remove: [["deborah", "sister", "melanie"]],
			})
			transaction.commit()

			const data = scanIndex(storage, { index: index.name })
			assert.deepEqual(data, [
				["chet", "ruth"],
				["chet", "stephanie"],
				["chet", "sue"],
			])
		})

		it("Redundant sibling index.", () => {
			const storage = createFamilyDb()
			const transaction = storage.transact()
			// Sibling index.
			const index = defineIndex(transaction, {
				name: "aunts",
				filter: [
					[
						[id, { value: "mom" }, mom],
						[sibling, { value: "mom" }, mom],
					],
					[
						[id, { value: "dad" }, dad],
						[sibling, { value: "dad" }, dad],
					],
				],
				sort: [id, sibling],
			})
			populateIndex(transaction, index)

			// Sam is my brother.
			write(transaction, {
				set: [
					["sam", "mom", "deborah"],
					["sam", "dad", "leon"],
				],
			})

			assert.deepEqual(scanIndex(transaction, { index: index.name }), [
				["chet", "chet"],
				["chet", "sam"],
				["sam", "chet"],
				["sam", "sam"],
			])

			// Removing sam's dad still makes him a sibling through my mom/
			write(transaction, {
				remove: [["sam", "dad", "leon"]],
			})

			assert.deepEqual(scanIndex(transaction, { index: index.name }), [
				["chet", "chet"],
				["chet", "sam"],
				["sam", "chet"],
				["sam", "sam"],
			])

			write(transaction, {
				remove: [["sam", "mom", "deborah"]],
			})
			assert.deepEqual(scanIndex(transaction, { index: index.name }), [
				["chet", "chet"],
				["sam", "sam"],
			])
		})
	})
})
