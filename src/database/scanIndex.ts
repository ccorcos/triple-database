import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"
import {
	ReadOnlyTupleStorage,
	ScanArgs,
	Tuple,
} from "tuple-database/storage/types"

export type ScanIndexArgs = ScanArgs & { index: string }

export function scanIndex(storage: ReadOnlyTupleStorage, args: ScanIndexArgs) {
	const { index, ...rest } = args
	const scanArgs: ScanArgs = {
		...rest,
		prefix: [index, ...(rest.prefix || [])],
	}

	const tuples = storage.scan(scanArgs).map(([tuple]) => tuple.slice(1))
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
		prefix: [index, ...(rest.prefix || [])],
	}
	return storage.subscribe(scanArgs, (writes) => {
		return callback({
			sets: writes.sets.map(([tuple]) => tuple.slice(1)),
			removes: writes.removes,
		})
	})
}
