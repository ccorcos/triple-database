import { describe } from "mocha"
import { snapshotTest } from "../test/snapshotTest"
import { getDefineIndexPlan, prettyDefineIndexPlan } from "./defineIndex"

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
						[id, { value: "type" }, { value: "person" }],
						[id, { value: "firstName" }, firstName],
						[id, { value: "lastName" }, lastName],
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
				return prettyDefineIndexPlan(plan)
			})
		})

		describe("cousins", () => {
			snapshotTest("prettyDefineIndexPlan", () => {
				const plan = getDefineIndexPlan({
					name: "cousins",
					filter: [
						[
							[id, { value: "mom" }, mom],
							[mom, { value: "sister" }, aunt],
							[cousin, { value: "mom" }, aunt],
						],
						[
							[id, { value: "mom" }, mom],
							[mom, { value: "brother" }, uncle],
							[cousin, { value: "dad" }, uncle],
						],
						[
							[id, { value: "dad" }, dad],
							[dad, { value: "sister" }, aunt],
							[cousin, { value: "mom" }, aunt],
						],
						[
							[id, { value: "dad" }, dad],
							[dad, { value: "brother" }, uncle],
							[cousin, { value: "dad" }, uncle],
						],
					],
					sort: [cousin, id],
				})
				return prettyDefineIndexPlan(plan)
			})
		})
	})
})
