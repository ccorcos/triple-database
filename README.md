# Tuple Indexer

Relational queries with reactivity and incremental cache update.

## TODO

- fix tests
- cleanup
	subscriptionHelpers?
	triplestore?
	factListenHelpers -- better name?
- syntax?
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