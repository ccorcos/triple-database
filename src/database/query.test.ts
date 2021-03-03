import { describe, it } from "mocha"
import * as assert from "assert"
import { createContactsDb, createFamilyDb } from "../test/fixtures"
import * as _ from "lodash"
import {
	querySort,
	prettyOrExpressionPlan,
	getOrExpressionPlan,
	evaluateOrExpressionPlan,
	prettyOrExpressionReport,
	query,
	Expression,
	Binding,
} from "./query"
import { snapshotTest } from "../test/snapshotTest"
import { write } from "./write"
import { bindingsEqual } from "../test/bindingsEqual"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"

const id = { var: "id" }
const firstName = { var: "firstName" }
const lastName = { var: "lastName" }
const person = { var: "person" }
const mom = { var: "mom" }
const dad = { var: "dad" }
const aunt = { var: "aunt" }

describe("query", () => {
	describe("ContactsDb", () => {
		it("querySort", () => {
			const storage = createContactsDb()
			const result = querySort(storage, {
				filter: [
					[
						[id, "type", "person"],
						[id, "firstName", firstName],
						[id, "lastName", lastName],
					],
				],
				sort: [lastName, firstName, id],
			})

			assert.deepEqual(result.data, [
				["Corcos", "Chet", "XXX1"],
				["Corcos", "Leon", "XXX3"],
				["Corcos", "Sam", "XXX2"],
				["Haas", "Wes", "XXX5"],
				["Langdon", "Andrew", "XXX4"],
				["Last", "Simon", "XXX6"],
			])
		})

		// it("querySort different directions", () => {
		// 	const storage = createContactsDb()
		// 	const result = querySort(storage, {
		// 		filter: [
		// 			[
		// 				[id, "type", "person"],
		// 				[id, "firstName", firstName],
		// 				[id, "lastName", "Corcos"],
		// 			],
		// 		],
		// 		sort: [
		// 			[firstName, -1],
		// 			[id, 1],
		// 		],
		// 	})

		// 	assert.deepEqual(result.data, [
		// 		["Sam", "XXX2"],
		// 		["Leon", "XXX3"],
		// 		["Chet", "XXX1"],
		// 	])
		// })

		it("querySort with scan", () => {
			const storage = createContactsDb()

			const result = querySort(storage, {
				filter: [
					[
						[id, "type", "person"],
						[id, "firstName", firstName],
						[id, "lastName", lastName],
					],
				],
				sort: [lastName, firstName, id],
				scan: {
					gt: ["Corcos", "Sam", "XXX2"],
					limit: 2,
				},
			})

			assert.deepEqual(result.data, [
				["Haas", "Wes", "XXX5"],
				["Langdon", "Andrew", "XXX4"],
			])
		})

		it("querySort with bind", () => {
			const storage = createContactsDb()
			const result = querySort(storage, {
				filter: [
					[
						[id, "type", "person"],
						[id, "firstName", firstName],
						[id, "lastName", lastName],
					],
				],
				sort: [lastName, firstName, id],
				bind: { lastName: "Corcos" },
			})

			assert.deepEqual(result.data, [
				["Corcos", "Chet", "XXX1"],
				["Corcos", "Leon", "XXX3"],
				["Corcos", "Sam", "XXX2"],
			])
		})

		snapshotTest("prettyOrExpressionPlan", () => {
			const plan = getOrExpressionPlan([
				[
					[id, "type", "person"],
					[id, "firstName", firstName],
					[id, "lastName", lastName],
				],
			])
			return prettyOrExpressionPlan(plan)
		})

		// snapshotTest("prettyOrExpressionReport", () => {
		// 	const storage = createContactsDb()
		// 	const { report } = evaluateOrExpressionPlan(
		// 		storage,
		// 		getOrExpressionPlan([
		// 			[
		// 				[id, "type", "person"],
		// 				[id, "firstName", firstName],
		// 				[id, "lastName", lastName],
		// 			],
		// 		])
		// 	)
		// 	return prettyOrExpressionReport(report)
		// })
	})

	describe("FamilyDb", () => {
		describe("aunts", () => {
			it("querySort", () => {
				const storage = createFamilyDb()
				const result = querySort(storage, {
					filter: [
						[
							[person, "mom", mom],
							[mom, "sister", aunt],
						],
						[
							[person, "dad", dad],
							[dad, "sister", aunt],
						],
					],
					sort: [person, aunt],
				})
				assert.deepEqual(result.data, [
					["chet", "melanie"],
					["chet", "ruth"],
					["chet", "stephanie"],
					["chet", "sue"],
				])
			})

			snapshotTest("prettyOrExpressionPlan", () => {
				const plan = getOrExpressionPlan([
					[
						[person, "mom", mom],
						[mom, "sister", aunt],
					],
					[
						[person, "dad", dad],
						[dad, "sister", aunt],
					],
				])
				return prettyOrExpressionPlan(plan)
			})

			// snapshotTest("prettyOrExpressionReport", () => {
			// 	const storage = createContactsDb()
			// 	const { report } = evaluateOrExpressionPlan(
			// 		storage,
			// 		getOrExpressionPlan([
			// 			[
			// 				[person, "mom", mom],
			// 				[mom, "sister", aunt],
			// 			],
			// 			[
			// 				[person, "dad", dad],
			// 				[dad, "sister", aunt],
			// 			],
			// 		])
			// 	)
			// 	return prettyOrExpressionReport(report)
			// })
		})

		// TODO: cousins
	})

	it("Single expression", () => {
		const storage = new InMemoryStorage()
		const transaction = storage.transact()
		write(transaction, { set: [["chet", "age", 28]] })
		transaction.commit()

		const test = (expression: Expression, bindings: Array<Binding>) => {
			bindingsEqual(
				query(storage, { filter: [[expression]] }).bindings,
				bindings
			)
		}

		test(["chet", { var: "A" }, { var: "V" }], [{ A: "age", V: 28 }])
		test(["chet", { var: "A" }, 28], [{ A: "age" }])
		test(["chet", "age", { var: "V" }], [{ V: 28 }])
		test([{ var: "E" }, "age", { var: "V" }], [{ E: "chet", V: 28 }])
		test([{ var: "E" }, "age", 28], [{ E: "chet" }])
		test([{ var: "E" }, { var: "A" }, 28], [{ E: "chet", A: "age" }])
		test(
			[{ var: "E" }, { var: "A" }, { var: "V" }],
			[{ E: "chet", A: "age", V: 28 }]
		)
		test(["chet", "age", 28], [{}])
		test(["chet", "age", 29], [])
	})

	it("Multi-value", () => {
		const storage = new InMemoryStorage()
		let transaction = storage.transact()
		write(transaction, {
			set: [
				["chet", "color", "blue"],
				["chet", "color", "red"],
			],
		})
		transaction.commit()

		const test = (expression: Expression, bindings: Array<Binding>) => {
			bindingsEqual(
				query(storage, { filter: [[expression]] }).bindings,
				bindings
			)
		}

		test(["chet", "color", { var: "C" }], [{ C: "blue" }, { C: "red" }])
		test([{ var: "E" }, "color", "red"], [{ E: "chet" }])

		transaction = storage.transact()
		write(transaction, {
			set: [["chet", "color", "green"]],
			remove: [["chet", "color", "red"]],
		})
		transaction.commit()

		test(["chet", "color", { var: "C" }], [{ C: "blue" }, { C: "green" }])
		test([{ var: "E" }, "color", "red"], [])
		test([{ var: "E" }, "color", "green"], [{ E: "chet" }])
		test(["chet", "color", "green"], [{}])
	})
})
