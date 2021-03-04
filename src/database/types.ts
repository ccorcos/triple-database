import { Value, Tuple } from "tuple-database/storage/types"

export { Value, Tuple }

export type Fact = [Value, Value, Value]

export type Operation =
	| { type: "set"; fact: Fact }
	| { type: "remove"; fact: Fact }

export const indexes = {
	indexesByName: "indexes",
	indexersByKey: "indexers",
}
