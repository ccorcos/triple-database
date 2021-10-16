// Enforces that that the array is length 1 and that
export function single<T>(values: T[]): T {
	if (values.length > 1)
		throw new Error("Too many values: " + JSON.stringify(values))
	if (values.length === 0) throw new Error("Empty list.")
	return values[0]
}

// Returns the first value. Useful when we don't care about the value in the tuplestore.
export function first<T extends any[]>(tuple: T): T[0] {
	if (tuple.length === 0) throw new Error("Can't call first on empty.")
	return tuple[0]
}

export function last<T>(tuple: T[]): T {
	if (tuple.length === 0) throw new Error("Can't call last on empty.")
	return tuple[tuple.length - 1]
}
