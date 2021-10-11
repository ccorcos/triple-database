import { ReadOnlyTupleStorage, ScanArgs } from "tuple-database/storage/types"

export function scanIndex(
	storage: ReadOnlyTupleStorage,
	args: ScanArgs & { index: string }
) {
	const { index, ...rest } = args

	const scanArgs: ScanArgs = {
		...rest,
		prefix: [index, ...(rest.prefix || [])],
	}
	console.log("scanArgs", scanArgs)
	const tuples = storage.scan(scanArgs).map(([tuple]) => tuple.slice(1))

	return tuples
}
