import _ from "lodash"
import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"
import { Transaction, TupleStorage } from "tuple-database/storage/types"
import { defineIndex, DefineIndexArgs, DefineIndexPlan } from "./defineIndex"
import { populateIndex } from "./populateIndex"
import { query, QueryArgs, querySort, QuerySortArgs } from "./query"
import {
	IndexWrites,
	scanIndex,
	ScanIndexArgs,
	subscribeIndex,
} from "./scanIndex"
import { Fact, FactOperation, indexes } from "./types"
import { updateIndexes } from "./updateIndexes"

export type FactIndexer = (tx: Transaction, op: FactOperation) => void

export class Triplestore {
	private storage: ReactiveStorage

	constructor(
		storage: TupleStorage,
		private indexers: Array<FactIndexer> = []
	) {
		this.storage = new ReactiveStorage(storage)
		this.storage.index((tx, op) => {
			if (op.tuple[0] !== "eav") return
			const [_indexName, e, a, v] = op.tuple
			if (op.type === "set") {
				tx.set(["ave", a, v, e], null)
				tx.set(["vea", v, e, a], null)
				tx.set(["vae", v, a, e], null)
			} else {
				tx.remove(["ave", a, v, e])
				tx.remove(["vea", v, e, a])
				tx.remove(["vae", v, a, e])
			}
			const factOp: FactOperation = { type: op.type, fact: [e, a, v] }
			updateIndexes(tx, factOp)
			for (const indexer of this.indexers) {
				indexer(tx, factOp)
			}
		})
	}

	scanIndex = (args: ScanIndexArgs) => {
		return scanIndex(this.storage, args)
	}

	subscribeIndex = (
		args: ScanIndexArgs,
		callback: (writes: IndexWrites) => void
	) => {
		return subscribeIndex(this.storage, args, callback)
	}

	queryFacts(args: QuerySortArgs) {
		const { data } = querySort(this.storage, args)
		return data
	}

	query(args: QueryArgs) {
		const { bindings } = query(this.storage, args)
		return bindings
	}

	// subscribeFacts // This is just creating an index and subscribing to the result.

	ensureIndex(args: DefineIndexArgs) {
		const result = this.storage
			.scan({ prefix: [indexes.indexesByName, args.name] })
			.map(([tuple]) => tuple[tuple.length - 1] as DefineIndexPlan)
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
		this.transaction.set(["eav", ...fact], null)
		return this
	}

	remove(fact: Fact) {
		this.transaction.remove(["eav", ...fact])
		return this
	}

	scanIndex: ReactiveStorage["scan"] = (args) => {
		return this.transaction.scan(args)
	}

	commit() {
		this.transaction.commit()
	}
}
