# Architecture

Built on top of `tuple-database`, an order-key value store with lexicographical JSON tuple encoding. That means that you can do range (aka scan) queries with tuple prefixes store arbitrary data structures.

## Triplestore



There are 3 indexes: eav, ave, vea. (queryable with the following prefixes: e, a, v, ea, ve, av => eav, vea, ave)

A fact is an [e,a,v]. Operation is ["add" | "remove", fact]

[{var: "person"}, "type", "Person"] => ave, ["type", "Person"]
 => [{person: "1111"}, {person: "1112"}]

Compound queries:

[{var: "person"}, "type", "Person"]          => ave, ["type", "Person"] {person}
[{var: "person"}, "title", {var: "name"}]    => eav, [{person}, "title"]
	=> [{person: "1111", name: "Chet Corcos"},
			{person: "1112", name: "Meghan Navarro"}]

e
## Reactivity

We could use the underlying `tuple-database` reactivity mechanism, but that would mean we need to check 4 indexes * 4 prefix depths = 16. But if we simply hold out open list of patterns, we only need 2^3 = 8.
Is this optimization worth it though? We need to make sure that the EAV indexes are no reactive and then use the same old reactive mechanism for scanning through index results.


## Indexes

## Query Optimization

## Walk Through

write.ts
- writes to EAV
- updateIndexes (we'll get to this last, this whole thing is kind of meta-circular)


query.ts
- Variable, Literal, Solved
- getExpressionPlan
- getAndExpressionPlan
- evaluateExpressionPlan
- evaluateAndExpressionPlan
- querySort
- query

defineIndex.ts
- getDefineIndexPlan
- evaluateDefineIndexPlan

popuateIndex.ts
- getPopulateIndexPlan
- evaluatePopulateIndexPlan

updateIndexes.ts
- getUpdateIndexesPlan
	- generateFactListenKeys
- evaluateUpdateIndexesPlan