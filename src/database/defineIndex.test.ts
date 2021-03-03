import { describe } from "mocha"
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
				index: "person-last-first",
				filter: [
					[
						[id, "type", "person"],
						[id, "firstName", firstName],
						[id, "lastName", lastName],
					],
				],
				sort: [lastName, firstName, id],
			})
			return prettyDefineIndexPlan(plan)
		})
	})

	describe("FamilyDb", () => {
		describe("aunts", () => {
			snapshotTest("prettyDefineIndexPlan", () => {
				const plan = getDefineIndexPlan({
					index: "aunts",
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
					sort: [aunt, id],
				})
				return prettyDefineIndexPlan(plan)
			})
		})

		describe("cousins", () => {
			snapshotTest("prettyDefineIndexPlan", () => {
				const plan = getDefineIndexPlan({
					index: "cousins",
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
					sort: [cousin, id],
				})
				return prettyDefineIndexPlan(plan)
			})
		})
	})
})
