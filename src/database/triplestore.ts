import { Value, Index, Sort } from "./storage"

export type Tuple3 = [Value, Value, Value]

/**
 * Efficiently query anything about an entity. Similar to a primary key index
 * on a row in SQL.
 */
export const eav: Index = {
	name: "eav",
	sort: [1, 1, 1],
}

/**
 * Efficiently query attribute-value combinations. Useful for determining
 * unique constraints.
 */
export const ave: Index = {
	name: "ave",
	sort: [1, 1, 1],
}

/**
 * Efficiently find all relations to an entity.
 */
export const vae: Index = {
	name: "vae",
	sort: [1, 1, 1],
}

/**
 * Efficiently determine how one entity is related to another.
 */
export const vea: Index = {
	name: "vea",
	sort: [1, 1, 1],
}
