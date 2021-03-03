import { describe } from "../test/mocha"
import * as _ from "lodash"
import { prettyDefineIndexPlan, getDefineIndexPlan } from "./defineIndex"
import { snapshotTest } from "../test/snapshotTest"

const id = { var: "id" }
const firstName = { var: "firstName" }
const lastName = { var: "lastName" }
const mom = { var: "mom" }
const dad = { var: "dad" }
const aunt = { var: "aunt" }
const uncle = { var: "uncle" }
const cousin = { var: "cousin" }

describe("defineIndex", () => {
	describe("ContactsDb", () => {
		snapshotTest("prettyDefineIndexPlan", () => {
			const plan = getDefineIndexPlan({
				filter: [
					[
						[id, "type", "person"],
						[id, "firstName", firstName],
						[id, "lastName", lastName],
					],
				],
				sort: [
					[lastName, 1],
					[firstName, 1],
					[id, 1],
				],
			})
			return prettyDefineIndexPlan(plan)
		})
	})

	describe("FamilyDb", () => {
		describe("aunts", () => {
			snapshotTest("prettyDefineIndexPlan", () => {
				const plan = getDefineIndexPlan({
					filter: [
						[
							[id, "mom", mom],
							[mom, "sister", aunt],
						],
						[
							[id, "dad", dad],
							[dad, "sister", aunt],
						],
					],
					sort: [
						[aunt, 1],
						[id, 1],
					],
				})
				return prettyDefineIndexPlan(plan)
			})
		})

		describe("cousins", () => {
			snapshotTest("prettyDefineIndexPlan", () => {
				const plan = getDefineIndexPlan({
					filter: [
						[
							[id, "mom", mom],
							[mom, "sister", aunt],
							[cousin, "mom", aunt],
						],
						[
							[id, "mom", mom],
							[mom, "brother", uncle],
							[cousin, "dad", uncle],
						],
						[
							[id, "dad", dad],
							[dad, "sister", aunt],
							[cousin, "mom", aunt],
						],
						[
							[id, "dad", dad],
							[dad, "brother", uncle],
							[cousin, "dad", uncle],
						],
					],
					sort: [
						[cousin, 1],
						[id, 1],
					],
				})
				return prettyDefineIndexPlan(plan)
			})
		})
	})
})
