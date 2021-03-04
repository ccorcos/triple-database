import { Storage, Transaction, Operation } from "tuple-database/storage/types"
import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"
import { querySort, QuerySortArgs } from "./query"
import { defineIndex, DefineIndexArgs, DefineIndexPlan } from "./defineIndex"
import { Fact, FactOperation, indexes } from "./types"
import _ from "lodash"
import { populateIndex } from "./populateIndex"
import { updateIndexes } from "./updateIndexes"

export type FactIndexer = (tx: Transaction, op: FactOperation) => void

export class Triplestore {
	private storage: ReactiveStorage

	constructor(storage: Storage, private indexers: Array<FactIndexer> = []) {
		this.storage = new ReactiveStorage(storage, [this.factIndexer])
	}

	private factIndexer = (tx: Transaction, op: Operation) => {
		if (op.index === "eav") {
			const [e, a, v] = op.tuple
			tx[op.type]("ave", [a, v, e])
			tx[op.type]("vea", [v, e, a])
			tx[op.type]("vae", [v, a, e])
			const factOp: FactOperation = { type: op.type, fact: [e, a, v] }
			updateIndexes(tx, factOp)
			for (const indexer of this.indexers) {
				indexer(tx, factOp)
			}
		}
	}

	scanIndex: ReactiveStorage["scan"] = (index, args = {}) => {
		return this.storage.scan(index, args)
	}

	subscribeIndex: ReactiveStorage["subscribe"] = (index, args, callback) => {
		return this.storage.subscribe(index, args, callback)
	}

	queryFacts(args: QuerySortArgs) {
		const { data } = querySort(this.storage, args)
		return data
	}
	// subscribeFacts // This is just creating an index and subscribing to the result.

	ensureIndex(args: DefineIndexArgs) {
		const result = this.storage
			.scan(indexes.indexesByName, {
				prefix: [args.name],
			})
			.map((tuple) => tuple[tuple.length - 1] as DefineIndexPlan)
			.map(({ filter, name, sort }) => ({ filter, name, sort }))

		if (result.length > 1) {
			throw new Error(
				"More than one index defined for the same name.\n" +
					JSON.stringify(result, null, 2)
			)
		}

		if (result.length === 1) {
			if (!_.isEqual(result[0], args)) {
				throw new Error(
					"Attempting to define a different index with the same name.\n" +
						JSON.stringify({ args, existing: result[0] }, null, 2)
				)
			}
			return
		}

		const tx = this.storage.transact()
		defineIndex(tx, args)
		populateIndex(tx, args)
		tx.commit()
	}

	transact() {
		return new TriplestoreTransaction(this.storage.transact())
	}
}

export class TriplestoreTransaction {
	constructor(private transaction: Transaction) {}

	set(fact: Fact) {
		this.transaction.set("eav", fact)
		return this
	}

	remove(fact: Fact) {
		this.transaction.remove("eav", fact)
		return this
	}

	commit() {
		this.transaction.commit()
	}
}
