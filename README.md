# Triple Database

A database for storing triples, also know as *facts* with tooling for querying and indexing.

```ts
import {strict as assert} from "assert"
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
