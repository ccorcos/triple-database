// import { describe, it, assert } from "../test/mocha"
// import * as _ from "lodash"
// import { getDefineIndexPlan, defineIndex } from "./defineIndex"
// import { snapshotTest } from "../test/snapshotTest"
// import {
// 	getPopulateIndexPlan,
// 	prettyPopulateIndexPlan,
// 	populateIndex,
// 	prettyPopulateIndexReport,
// } from "./populateIndex"
// import { createContactsDb, createFamilyDb } from "../test/fixtures"

// const id = { var: "id" }
// const firstName = { var: "firstName" }
// const lastName = { var: "lastName" }
// const mom = { var: "mom" }
// const dad = { var: "dad" }
// const aunt = { var: "aunt" }

// describe("populateIndex", () => {
// 	describe("ContactsDb", () => {
// 		snapshotTest("prettyPopulateIndexPlan", () => {
// 			const { index } = getDefineIndexPlan({
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
// 			const plan = getPopulateIndexPlan(index)
// 			return prettyPopulateIndexPlan(plan)
// 		})

// 		snapshotTest("prettyPopulateIndexReport", () => {
// 			const storage = createContactsDb()
// 			const transaction = storage.transact()
// 			const index = defineIndex(transaction, {
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
// 			const report = populateIndex(transaction, index)
// 			return prettyPopulateIndexReport(report)
// 		})

// 		it("scanIndex", () => {
// 			const storage = createContactsDb()
// 			const transaction = storage.transact()
// 			const index = defineIndex(transaction, {
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

// 			populateIndex(transaction, index)
// 			transaction.commit()

// 			const data = storage.scan(index)
// 			assert.deepEqual(data, [
// 				["Corcos", "Chet", "XXX1"],
// 				["Corcos", "Leon", "XXX3"],
// 				["Corcos", "Sam", "XXX2"],
// 				["Haas", "Wes", "XXX5"],
// 				["Langdon", "Andrew", "XXX4"],
// 				["Last", "Simon", "XXX6"],
// 			])
// 		})
// 	})

// 	describe("FamilyDb", () => {
// 		describe("aunts", () => {
// 			it("scanIndex", () => {
// 				const storage = createFamilyDb()
// 				const transaction = storage.transact()
// 				const index = defineIndex(transaction, {
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
// 						[id, 1],
// 						[aunt, 1],
// 					],
// 				})
// 				populateIndex(transaction, index)
// 				transaction.commit()

// 				const data = storage.scan(index)
// 				assert.deepEqual(data, [
// 					["chet", "melanie"],
// 					["chet", "ruth"],
// 					["chet", "stephanie"],
// 					["chet", "sue"],
// 				])
// 			})
// 		})
// 	})
// })
