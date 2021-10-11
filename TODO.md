
## TODO

- defineIndex can use the value, not just the key


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