import { strict as assert } from "assert"
import { describe, it } from "mocha"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { bindingsEqual } from "../test/bindingsEqual"
import { createContactsDb, createFamilyDb } from "../test/fixtures"
import { snapshotTest } from "../test/snapshotTest"
import {
	Binding,
	Expression,
	getOrExpressionPlan,
	prettyOrExpressionPlan,
	query,
	querySort,
} from "./query"
import { write } from "./write"

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
						[id, { lit: "type" }, { lit: "person" }],
						[id, { lit: "firstName" }, firstName],
						[id, { lit: "lastName" }, lastName],
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
		// 				[id, {lit: "type"}, {lit: "person"}],
		// 				[id, {lit: "firstName"}, firstName],
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
						[id, { lit: "type" }, { lit: "person" }],
						[id, { lit: "firstName" }, firstName],
						[id, { lit: "lastName" }, lastName],
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
						[id, { lit: "type" }, { lit: "person" }],
						[id, { lit: "firstName" }, firstName],
						[id, { lit: "lastName" }, lastName],
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
					[id, { lit: "type" }, { lit: "person" }],
					[id, { lit: "firstName" }, firstName],
					[id, { lit: "lastName" }, lastName],
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
		// 				[id, {lit: "type"}, {lit: "person"}],
		// 				[id, {lit: "firstName"}, firstName],
		// 				[id, {lit:"lastName"}, lastName],
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
							[person, { lit: "mom" }, mom],
							[mom, { lit: "sister" }, aunt],
						],
						[
							[person, { lit: "dad" }, dad],
							[dad, { lit: "sister" }, aunt],
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
						[person, { lit: "mom" }, mom],
						[mom, { lit: "sister" }, aunt],
					],
					[
						[person, { lit: "dad" }, dad],
						[dad, { lit: "sister" }, aunt],
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
			// 				[person, {lit: "mom"}, mom],
			// 				[mom, {lit: "sister"}, aunt],
			// 			],
			// 			[
			// 				[person, {lit: "dad"}, dad],
			// 				[dad, {lit: "sister"}, aunt],
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

		test([{ lit: "chet" }, { var: "A" }, { var: "V" }], [{ A: "age", V: 28 }])
		test([{ lit: "chet" }, { var: "A" }, { lit: 28 }], [{ A: "age" }])
		test([{ lit: "chet" }, { lit: "age" }, { var: "V" }], [{ V: 28 }])
		test([{ var: "E" }, { lit: "age" }, { var: "V" }], [{ E: "chet", V: 28 }])
		test([{ var: "E" }, { lit: "age" }, { lit: 28 }], [{ E: "chet" }])
		test([{ var: "E" }, { var: "A" }, { lit: 28 }], [{ E: "chet", A: "age" }])
		test(
			[{ var: "E" }, { var: "A" }, { var: "V" }],
			[{ E: "chet", A: "age", V: 28 }]
		)
		test([{ lit: "chet" }, { lit: "age" }, { lit: 28 }], [{}])
		test([{ lit: "chet" }, { lit: "age" }, { lit: 29 }], [])
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

		test(
			[{ lit: "chet" }, { lit: "color" }, { var: "C" }],
			[{ C: "blue" }, { C: "red" }]
		)
		test([{ var: "E" }, { lit: "color" }, { lit: "red" }], [{ E: "chet" }])

		transaction = storage.transact()
		write(transaction, {
			set: [["chet", "color", "green"]],
			remove: [["chet", "color", "red"]],
		})
		transaction.commit()

		test(
			[{ lit: "chet" }, { lit: "color" }, { var: "C" }],
			[{ C: "blue" }, { C: "green" }]
		)
		test([{ var: "E" }, { lit: "color" }, { lit: "red" }], [])
		test([{ var: "E" }, { lit: "color" }, { lit: "green" }], [{ E: "chet" }])
		test([{ lit: "chet" }, { lit: "color" }, { lit: "green" }], [{}])
	})
})
