# Triple Database

A database for storing triples, also know as *facts* with tooling for querying and indexing.

```ts
import * as assert from "assert"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { Triplestore } from "triple-database"

const store = new Triplestore(new InMemoryStorage())

store
	.transact()
	.set(["0001", "type", "Person"])
	.set(["0001", "firstName", "Chet"])
	.set(["0001", "lastName", "Corcos"])
	.set(["0002", "type", "Person"])
	.set(["0002", "firstName", "Meghan"])
	.set(["0002", "lastName", "Navarro"])
	.commit()

const queryResult = store.queryFacts({
	filter: [
		[
			[{ var: "id" }, { lit: "type" }, { lit: "Person" }],
			[{ var: "id" }, { lit: "firstName" }, { var: "firstName" }],
			[{ var: "id" }, { lit: "lastName" }, { var: "lastName" }],
		],
	],
	sort: [{ var: "lastName" }, { var: "firstName" }, { var: "id" }],
})

assert.deepEqual(queryResult, [
	["Corcos", "Chet", "0001"],
	["Navarro", "Meghan", "0002"],
])

store.ensureIndex({
	name: "personByLastFirst",
	filter: [
		[
			[{ var: "id" }, { lit: "type" }, { lit: "Person" }],
			[{ var: "id" }, { lit: "firstName" }, { var: "firstName" }],
			[{ var: "id" }, { lit: "lastName" }, { var: "lastName" }],
		],
	],
	sort: [{ var: "lastName" }, { var: "firstName" }, { var: "id" }],
})

const scanResult = store.scanIndex("personByLastFirst")
assert.deepEqual(scanResult, [
	["Corcos", "Chet", "0001"],
	["Navarro", "Meghan", "0002"],
])
```

## TODO

- test that we can put arbitrary class objects in here.
- convenient `$()` syntax for defining variables.
- send tuples back and forth between a database in two different processes using traces and transactions.

- Reactivity for `triplestore.queryFacts` with seemless in-memory index.
- Reuse `ListenerStorage` from `tuple-database`?
- What to do about all the query plan stuff?

- cleanup
	subscriptionHelpers?
	write?
	- What aren't we using anymore?

- convenient syntax:
	// peopleByLastFirstName:
	// [?id, "type", "person"]
	// [?id, "firstName", ?firstName]
	// [?id, "lastName", ?lastName]
	// => [?lastName, ?firstName, ?id]

- delete index?
- {and: []}, {or: []}

## Later
- deterministic query name
	- query optimization
- .scan -> .range?