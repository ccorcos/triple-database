## TODO


HERE
- finish tests for the basic example
- see if we can add nested objects?
- see if we can create custom list and object types with symbol toJSON methods and such.

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