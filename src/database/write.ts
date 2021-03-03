import { Value, Transaction } from "tuple-database/storage/types"
import {
	updateIndexes,
	UpdateIndexesReport,
	prettyUpdateIndexesReport,
} from "./updateIndexes"

type WriteReport = Array<UpdateIndexesReport>

type Tuple3 = [Value, Value, Value]

export type WriteArgs = { set?: Array<Tuple3>; remove?: Array<Tuple3> }

export function write(
	transaction: Transaction,
	args: { set?: Array<Tuple3>; remove?: Array<Tuple3> }
): WriteReport {
	const writeReport: WriteReport = []

	if (args.set) {
		for (const [e, a, v] of args.set) {
			transaction.set("eav", [e, a, v])
			transaction.set("ave", [a, v, e])
			transaction.set("vae", [v, a, e])
			transaction.set("vea", [v, e, a])
			writeReport.push(updateIndexes(transaction, "set", [e, a, v]))
		}
	}

	if (args.remove) {
		for (const [e, a, v] of args.remove) {
			transaction.remove("eav", [e, a, v])
			transaction.remove("ave", [a, v, e])
			transaction.remove("vae", [v, a, e])
			transaction.remove("vea", [v, e, a])
			writeReport.push(updateIndexes(transaction, "remove", [e, a, v]))
		}
	}
	return writeReport
}

export function prettyWriteReport(writeReport: WriteReport) {
	return writeReport.map(prettyUpdateIndexesReport).join("\n")
}
