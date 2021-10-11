import { Tuple, Value } from "tuple-database/storage/types"

export { Value, Tuple }

export type Fact = [Value, Value, Value]

export type FactOperation =
	| { type: "set"; fact: Fact }
	| { type: "remove"; fact: Fact }

export const indexes = {
	indexesByName: "db/indexes",
	indexersByKey: "db/indexers",
}
