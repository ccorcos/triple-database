# Triple Database

Relational queries with reactivity and incremental cache update.

## TODO

useSubscribe -> useScan
useQuery(triplestore)

- use raw index listeners rather than listen key
- how to share code for reactive queries with defineIndex


```ts
import sqlite from "better-sqlite3"
import { SQLiteStorage } from "tuple-database/storage/SQLiteStorage"
import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"

const triplestore = new Triplestore(
	new ReactiveStorage(new SQLiteStorage(sqlite("./app.db")))
)

triplestore.transact()
	.set(["0001", "type", "Person"])
	.set(["0001", "firstName", "Chet"])
	.set(["0001", "lastName", "Corcos"])
	.set(["0002", "type", "Person"])
	.set(["0002", "firstName", "Meghan"])
	.set(["0002", "lastName", "Navarro"])
	.commit()

triplestore.query({
	filter: [
		[{var: "id"}, { lit: "type" }, { lit: "person" }],
		[{var: "id"}, { lit: "firstName" }, {var: "firstName"}],
		[{var: "id"}, { lit: "lastName" }, {var: "lastName"}],
	],
})
// [{lastName: "Corcos", firstName: "Chet", id: "0001"},
//  {lastName: "Navarro", firstName: "Meghan", id: "0002"}]

triplestore.createIndex({
	name: "personByLastFirst",
	filter: [
		[
			[{var: "id"}, { lit: "type" }, { lit: "person" }],
			[{var: "id"}, { lit: "firstName" }, {var: "firstName"}],
			[{var: "id"}, { lit: "lastName" }, {var: "lastName"}],
		],
	],
	sort: [{var: "lastName"}, {var: "firstName"}, {var: "id"}]
})

triplestore.scan("personByLastFirst")
// [["Corcos",  "Chet", "0001"],
//  ["Navarro", "Meghan", "0002"]]


triplestore.scan()
triplestore.subscribe()
```






- cleanup
	subscriptionHelpers?

- convenient syntax:
	// peopleByLastFirstName:
	// [?id, "type", "person"]
	// [?id, "firstName", ?firstName]
	// [?id, "lastName", ?lastName]
	// => [?lastName, ?firstName, ?id]

- delete index?

- should query ids be deterministic?
	- yes: with some additional optimization, we could break apart every piece of a query. then there's an ontology kind of problem. The order we evaluate changes the optimizations we can make. These optimizations are like neuron connections - those that fire together wire together.

- what is the lifecycle of an index?
	- can I query without generating an index?
	- devs

	defineIndex and scan are the way to do things.
	query just uses defineIndex and scan under the hood in memory.

- {var:string} is a valid Value.
- {and: []}, {or: []}
- {solved: string}

- use `tuple-database`
- query

This is really a triplestore... You cannot index arbitrary tuple index scans without having all permutations of those indexes to be able to back out reactive updates...


## Later
- or expressions

- .scan -> .range?