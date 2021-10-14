import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"
import {
	ReadOnlyTupleStorage,
	ScanArgs,
	Tuple,
} from "tuple-database/storage/types"
import { indexes } from "./types"

export type ScanIndexArgs = ScanArgs & { index: string }

export function scanIndex(storage: ReadOnlyTupleStorage, args: ScanIndexArgs) {
	const { index, ...rest } = args
	const scanArgs: ScanArgs = {
		...rest,
		prefix: [indexes.indexesByName, index, "data", ...(rest.prefix || [])],
	}

	const tuples = storage.scan(scanArgs).map(([tuple]) => tuple.slice(3))
	return tuples
}

export type IndexWrites = {
	sets?: Tuple[]
	removes?: Tuple[]
}

export function subscribeIndex(
	storage: ReactiveStorage,
	args: ScanIndexArgs,
	callback: (writes: IndexWrites) => void
) {
	const { index, ...rest } = args
	const scanArgs: ScanArgs = {
		...rest,
		prefix: [indexes.indexesByName, index, "data", ...(rest.prefix || [])],
	}
	return storage.subscribe(scanArgs, (writes) => {
		// indexes.indexesByName, index.name, "data"
		return callback({
			sets: (writes.set || []).map(([tuple]) => tuple.slice(3)),
			removes: (writes.remove || []).map((tuple) => tuple.slice(3)),
		})
	})
}
