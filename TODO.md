## TODO

- data-type-ts / hyperstruct

- basic REPL demo for showing people how it works.
	add x y z, a b c
	remove x y z
	query ?x y z, a ?b ?x | sort ?a ?b | index name
	scan name >=a MAX prefix 12

	do this in a web app and show the data on the side.

- EXPLAIN documentation
- fix up the README


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