## TODO

- what to do about reactivity causing invalid schema? when deleting an object...

- we need to rebuild the game counter. let real development drive what I build next.
	- re-order players
	- muliple games?
	- contrived counters?
		- one player plays two games?
	-

test list.delete
better subspace types for vaeo

- what if indexes were strings, factionally indexes.
	- we could abstract away the proxy thing entirely.

- proxyObj and proxyList only accept flat objects.
- type helper and schema helper for flattening object schemas.
- It's still helpful for read and write to


- test with a nested object -> no nested objects.

- flat obj type.
- lets do the game counter sooner than later just to see how we're going to use this thing...

- test with duck-typed values such as { date: string }
- actually implement in the GameCounter app.

- add indexing to the ordered triplestore.

---

Game Plan:
- don't need to immutably update a deep json object. also don't need to diff necessarily either.
-

We have the following utility functions:
- readObj
- writeObj
	- objToTuples
- deleteObj

Next:
- `typed mutations using proxies.`
  - add/remove list
  - set property-value
- listen for changes to objects

- break up the objects so that game doesn't fetch player and its just an id.
- id => { id: string }



---

- readme
	- explain how it all works
	- install tuple-database as a peer dependency
	- triplestore-repl
	- EXPLAIN documentation


- check out the bottom of gameCounter2.test.ts



- data-type-ts / hyperstruct
	- shorthand.ts
	- gameCounter.test.ts

// What if lists were built in?
// - [e, a, o, v]
// - [e, a, v, o]
// - [a, v, e]
// - [v, a, e]
// - [e, v, a]


- Maybe we should try the GameCounter state without the triplestore the first time around...
	-


- send tuples back and forth between a database in two different processes using traces and transactions.
- shorthand queries `$()` syntax for defining variables.
	- or just jump straight ahead to proxies.


- Reactivity for `triplestore.queryFacts` with seemless in-memory index.

- convenient syntax:
- delete index?
- {and: []}, {or: []}

- deterministic query name
	- query optimization

- .scan -> .range?