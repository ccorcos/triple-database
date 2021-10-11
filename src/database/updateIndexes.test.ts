import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { createContactsDb, createFamilyDb } from "../test/fixtures"
import { snapshotTest } from "../test/snapshotTest"
import { defineIndex } from "./defineIndex"
import { populateIndex } from "./populateIndex"
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
	describe("ContactsDb", () => {
		snapshotTest("prettyUpdateIndexesPlan", () => {
			const storage = createContactsDb()
			const transaction = storage.transact()
			defineIndex(transaction, {
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
						[id, { lit: "type" }, { lit: "person" }],
						[id, { lit: "firstName" }, firstName],
						[id, { lit: "lastName" }, lastName],
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
							[id, { lit: "mom" }, mom],
							[mom, { lit: "sister" }, aunt],
						],
						[
							[id, { lit: "dad" }, dad],
							[dad, { lit: "sister" }, aunt],
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
								[id, { lit: "mom" }, mom],
								[mom, { lit: "sister" }, aunt],
							],
							[
								[id, { lit: "dad" }, dad],
								[dad, { lit: "sister" }, aunt],
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
								[id, { lit: "mom" }, mom],
								[mom, { lit: "sister" }, aunt],
							],
							[
								[id, { lit: "dad" }, dad],
								[dad, { lit: "sister" }, aunt],
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
			write(transaction, {
				set: [["sam", "mom", "deborah"]],
			})
			transaction.commit()

			const data = storage.scan({ prefix: [index.name] })
			assert.deepEqual(data, [
				[[index.name, "chet", "melanie"], null],
				[[index.name, "chet", "ruth"], null],
				[[index.name, "chet", "stephanie"], null],
				[[index.name, "chet", "sue"], null],
				[[index.name, "sam", "melanie"], null],
				[[index.name, "sam", "ruth"], null],
				[[index.name, "sam", "sue"], null],
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
			write(transaction, {
				remove: [["deborah", "sister", "melanie"]],
			})
			transaction.commit()

			const data = storage.scan({ prefix: [index.name] })
			assert.deepEqual(data, [
				[[index.name, "chet", "ruth"], null],
				[[index.name, "chet", "stephanie"], null],
				[[index.name, "chet", "sue"], null],
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
						[id, { lit: "mom" }, mom],
						[sibling, { lit: "mom" }, mom],
					],
					[
						[id, { lit: "dad" }, dad],
						[sibling, { lit: "dad" }, dad],
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

			assert.deepEqual(transaction.scan({ prefix: [index.name] }), [
				[[index.name, "chet", "chet"], null],
				[[index.name, "chet", "sam"], null],
				[[index.name, "sam", "chet"], null],
				[[index.name, "sam", "sam"], null],
			])

			// Removing sam's dad still makes him a sibling through my mom/
			write(transaction, {
				remove: [["sam", "dad", "leon"]],
			})

			assert.deepEqual(transaction.scan({ prefix: [index.name] }), [
				[[index.name, "chet", "chet"], null],
				[[index.name, "chet", "sam"], null],
				[[index.name, "sam", "chet"], null],
				[[index.name, "sam", "sam"], null],
			])

			write(transaction, {
				remove: [["sam", "mom", "deborah"]],
			})
			assert.deepEqual(transaction.scan({ prefix: [index.name] }), [
				[[index.name, "chet", "chet"], null],
				[[index.name, "sam", "sam"], null],
			])
		})
	})
})
