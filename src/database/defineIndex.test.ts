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
			return prettyDefineIndexPlan(plan)
		})
	})

	describe("FamilyDb", () => {
		describe("aunts", () => {
			snapshotTest("prettyDefineIndexPlan", () => {
				const plan = getDefineIndexPlan({
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
				return prettyDefineIndexPlan(plan)
			})
		})

		describe("cousins", () => {
			snapshotTest("prettyDefineIndexPlan", () => {
				const plan = getDefineIndexPlan({
					name: "cousins",
					filter: [
						[
							[id, { lit: "mom" }, mom],
							[mom, { lit: "sister" }, aunt],
							[cousin, { lit: "mom" }, aunt],
						],
						[
							[id, { lit: "mom" }, mom],
							[mom, { lit: "brother" }, uncle],
							[cousin, { lit: "dad" }, uncle],
						],
						[
							[id, { lit: "dad" }, dad],
							[dad, { lit: "sister" }, aunt],
							[cousin, { lit: "mom" }, aunt],
						],
						[
							[id, { lit: "dad" }, dad],
							[dad, { lit: "brother" }, uncle],
							[cousin, { lit: "dad" }, uncle],
						],
					],
					sort: [cousin, id],
				})
				return prettyDefineIndexPlan(plan)
			})
		})
	})
})
