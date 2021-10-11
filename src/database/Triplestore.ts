import _ from "lodash"
import { InMemoryStorage } from "tuple-database/storage/InMemoryStorage"
import { ReactiveStorage } from "tuple-database/storage/ReactiveStorage"
import { Transaction } from "tuple-database/storage/types"
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
import { write } from "./write"

export type FactIndexer = (tx: Transaction, op: FactOperation) => void

export class Triplestore {
	public storage: ReactiveStorage

	constructor(storage?: ReactiveStorage) {
		if (storage) this.storage = storage
		else this.storage = new ReactiveStorage(new InMemoryStorage())
	}

	query(args: QueryArgs) {
		const { bindings } = query(this.storage, args)
		return bindings
	}

	querySort(args: QuerySortArgs) {
		const { data } = querySort(this.storage, args)
		return data
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
		write(this.transaction, { set: [fact] })
		return this
	}

	remove(fact: Fact) {
		write(this.transaction, { remove: [fact] })
		return this
	}

	scanIndex = (args: ScanIndexArgs) => {
		return scanIndex(this.transaction, args)
	}

	queryFacts(args: QuerySortArgs) {
		const { data } = querySort(this.transaction, args)
		return data
	}

	query(args: QueryArgs) {
		const { bindings } = query(this.transaction, args)
		return bindings
	}

	commit() {
		this.transaction.commit()
	}
}
