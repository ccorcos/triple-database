// import { describe, assert } from "../test/mocha"
// import * as _ from "lodash"
// import { snapshotTest } from "../test/snapshotTest"
// import { createContactsDb, createFamilyDb } from "../test/fixtures"
// import {
// 	getUpdateIndexesPlan,
// 	prettyUpdateIndexesPlan,
// 	updateIndexes,
// 	prettyUpdateIndexesReport,
// } from "./updateIndexes"
// import { defineIndex } from "./defineIndex"
// import { write } from "./write"
// import { it } from "mocha"
// import { populateIndex } from "./populateIndex"

// const id = { var: "id" }
// const firstName = { var: "firstName" }
// const lastName = { var: "lastName" }
// const mom = { var: "mom" }
// const dad = { var: "dad" }
// const aunt = { var: "aunt" }
// const sibling = { var: "sibling" }

// describe("updateIndexes", () => {
// 	describe("ContactsDb", () => {
// 		snapshotTest("prettyUpdateIndexesPlan", () => {
// 			const storage = createContactsDb()
// 			const transaction = storage.transact()
// 			defineIndex(transaction, {
// 				filter: [
// 					[
// 						[id, "type", "person"],
// 						[id, "firstName", firstName],
// 						[id, "lastName", lastName],
// 					],
// 				],
// 				sort: [
// 					[lastName, 1],
// 					[firstName, 1],
// 					[id, 1],
// 				],
// 			})
// 			transaction.commit()

// 			const plan = getUpdateIndexesPlan(storage, "set", [
// 				"XXXX",
// 				"firstName",
// 				"Joe",
// 			])

// 			return prettyUpdateIndexesPlan(plan)
// 		})

// 		snapshotTest("prettyUpdateIndexesReport", () => {
// 			const storage = createContactsDb()
// 			const transaction = storage.transact()
// 			defineIndex(transaction, {
// 				filter: [
// 					[
// 						[id, "type", "person"],
// 						[id, "firstName", firstName],
// 						[id, "lastName", lastName],
// 					],
// 				],
// 				sort: [
// 					[lastName, 1],
// 					[firstName, 1],
// 					[id, 1],
// 				],
// 			})

// 			const report = updateIndexes(transaction, "set", [
// 				"XXXX",
// 				"firstName",
// 				"Joe",
// 			])

// 			return prettyUpdateIndexesReport(report)
// 		})
// 	})

// 	describe("FamilyDb", () => {
// 		describe("aunts", () => {
// 			snapshotTest("prettyUpdateIndexes", () => {
// 				const storage = createFamilyDb()
// 				const transaction = storage.transact()
// 				defineIndex(transaction, {
// 					filter: [
// 						[
// 							[id, "mom", mom],
// 							[mom, "sister", aunt],
// 						],
// 						[
// 							[id, "dad", dad],
// 							[dad, "sister", aunt],
// 						],
// 					],
// 					sort: [
// 						[aunt, 1],
// 						[id, 1],
// 					],
// 				})
// 				transaction.commit()

// 				const plan = getUpdateIndexesPlan(storage, "remove", [
// 					"deborah",
// 					"sister",
// 					"melanie",
// 				])

// 				return prettyUpdateIndexesPlan(plan)
// 			})

// 			describe("prettyUpdateIndexesReport", () => {
// 				snapshotTest("set", () => {
// 					const storage = createFamilyDb()
// 					const transaction = storage.transact()
// 					defineIndex(transaction, {
// 						filter: [
// 							[
// 								[id, "mom", mom],
// 								[mom, "sister", aunt],
// 							],
// 							[
// 								[id, "dad", dad],
// 								[dad, "sister", aunt],
// 							],
// 						],
// 						sort: [
// 							[aunt, 1],
// 							[id, 1],
// 						],
// 					})
// 					transaction.commit()

// 					const report = updateIndexes(transaction, "set", [
// 						"deborah",
// 						"sister",
// 						"anne",
// 					])

// 					return prettyUpdateIndexesReport(report)
// 				})

// 				snapshotTest("remove", () => {
// 					const storage = createFamilyDb()
// 					const transaction = storage.transact()
// 					defineIndex(transaction, {
// 						filter: [
// 							[
// 								[id, "mom", mom],
// 								[mom, "sister", aunt],
// 							],
// 							[
// 								[id, "dad", dad],
// 								[dad, "sister", aunt],
// 							],
// 						],
// 						sort: [
// 							[aunt, 1],
// 							[id, 1],
// 						],
// 					})
// 					// Add sam into the mix so the update indexes needs to check for both
// 					// sam and chet. This testing out that the reports correctly collapse.
// 					write(transaction, {
// 						set: [["sam", "mom", "deborah"]],
// 					})
// 					transaction.commit()

// 					const report = updateIndexes(transaction, "remove", [
// 						"deborah",
// 						"sister",
// 						"melanie",
// 					])

// 					return prettyUpdateIndexesReport(report)
// 				})
// 			})
// 		})

// 		it("Adding sam updates aunts", () => {
// 			const storage = createFamilyDb()
// 			const transaction = storage.transact()
// 			const index = defineIndex(transaction, {
// 				filter: [
// 					[
// 						[id, "mom", mom],
// 						[mom, "sister", aunt],
// 					],
// 					[
// 						[id, "dad", dad],
// 						[dad, "sister", aunt],
// 					],
// 				],
// 				sort: [
// 					[id, 1],
// 					[aunt, 1],
// 				],
// 			})
// 			populateIndex(transaction, index)
// 			write(transaction, {
// 				set: [["sam", "mom", "deborah"]],
// 			})
// 			transaction.commit()

// 			const data = storage.scan(index)
// 			assert.deepEqual(data, [
// 				["chet", "melanie"],
// 				["chet", "ruth"],
// 				["chet", "stephanie"],
// 				["chet", "sue"],
// 				["sam", "melanie"],
// 				["sam", "ruth"],
// 				["sam", "sue"],
// 				// No stephanie because I didnt set sam's dad.
// 			])
// 		})

// 		it("Removing melanie updates aunts", () => {
// 			const storage = createFamilyDb()
// 			const transaction = storage.transact()
// 			const index = defineIndex(transaction, {
// 				filter: [
// 					[
// 						[id, "mom", mom],
// 						[mom, "sister", aunt],
// 					],
// 					[
// 						[id, "dad", dad],
// 						[dad, "sister", aunt],
// 					],
// 				],
// 				sort: [
// 					[id, 1],
// 					[aunt, 1],
// 				],
// 			})
// 			populateIndex(transaction, index)
// 			write(transaction, {
// 				remove: [["deborah", "sister", "melanie"]],
// 			})
// 			transaction.commit()

// 			const data = storage.scan(index)
// 			assert.deepEqual(data, [
// 				["chet", "ruth"],
// 				["chet", "stephanie"],
// 				["chet", "sue"],
// 			])
// 		})

// 		it("Redundant sibling index.", () => {
// 			const storage = createFamilyDb()
// 			const transaction = storage.transact()
// 			// Sibling index.
// 			const index = defineIndex(transaction, {
// 				filter: [
// 					[
// 						[id, "mom", mom],
// 						[sibling, "mom", mom],
// 					],
// 					[
// 						[id, "dad", dad],
// 						[sibling, "dad", dad],
// 					],
// 				],
// 				sort: [
// 					[id, 1],
// 					[sibling, 1],
// 				],
// 			})
// 			populateIndex(transaction, index)

// 			// Sam is my brother.
// 			write(transaction, {
// 				set: [
// 					["sam", "mom", "deborah"],
// 					["sam", "dad", "leon"],
// 				],
// 			})

// 			assert.deepEqual(transaction.scan(index), [
// 				["chet", "chet"],
// 				["chet", "sam"],
// 				["sam", "chet"],
// 				["sam", "sam"],
// 			])

// 			// Removing sam's dad still makes him a sibling through my mom/
// 			write(transaction, {
// 				remove: [["sam", "dad", "leon"]],
// 			})

// 			assert.deepEqual(transaction.scan(index), [
// 				["chet", "chet"],
// 				["chet", "sam"],
// 				["sam", "chet"],
// 				["sam", "sam"],
// 			])

// 			write(transaction, {
// 				remove: [["sam", "mom", "deborah"]],
// 			})
// 			assert.deepEqual(transaction.scan(index), [
// 				["chet", "chet"],
// 				["sam", "sam"],
// 			])
// 		})
// 	})
// })
