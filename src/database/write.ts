import { Transaction } from "tuple-database/storage/types"
import { Fact } from "./types"
import {
	prettyUpdateIndexesReport,
	updateIndexes,
	UpdateIndexesReport,
} from "./updateIndexes"

type WriteReport = Array<UpdateIndexesReport>

export type FactWrites = { set?: Array<Fact>; remove?: Array<Fact> }

export function write(transaction: Transaction, args: FactWrites): WriteReport {
	const writeReport: WriteReport = []

	if (args.set) {
		// e, a, v, ea, ve, av => eav, vea, ave
		for (const [e, a, v] of args.set) {
			transaction.set(["eav", e, a, v], null)
			transaction.set(["ave", a, v, e], null)
			transaction.set(["vea", v, e, a], null)
			writeReport.push(
				updateIndexes(transaction, { type: "set", fact: [e, a, v] })
			)
		}
	}

	if (args.remove) {
		for (const [e, a, v] of args.remove) {
			transaction.remove(["eav", e, a, v])
			transaction.remove(["ave", a, v, e])
			transaction.remove(["vea", v, e, a])
			writeReport.push(
				updateIndexes(transaction, { type: "remove", fact: [e, a, v] })
			)
		}
	}
	return writeReport
}

export function prettyWriteReport(writeReport: WriteReport) {
	return writeReport.map(prettyUpdateIndexesReport).join("\n")
}
