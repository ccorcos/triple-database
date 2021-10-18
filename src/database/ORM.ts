import * as t from "data-type-ts"
import { Transaction } from "tuple-database/storage/types"
import {
	deleteObj,
	Obj,
	OrderedTriplestore,
	ProxyObj,
	proxyObj,
	readObj,
	writeObj,
} from "./OrderedTriplestore"
import { useObj } from "./useObj"

type AnySchema = { [schema: string]: Obj }

// type OrmProxy<T extends AnySchema> = {
// 	[K in keyof T]: (id: string) => ProxyObj<T[K]>
// }

// // https://www.typescriptlang.org/docs/handbook/2/mapped-types.html#key-remapping-via-as
// type OrmHook<T extends AnySchema> = {
// 	[K in keyof T as `use${Capitalize<string & K>}`]: (id: string) => T[K]
// }

// type OrmCreate<T extends AnySchema> = {
// 	[K in keyof T as `create${Capitalize<string & K>}`]: (obj: T[K]) => void
// }

// type OrmTx<T extends AnySchema> = OrmProxy<T> &
// 	OrmCreate<T> & { commit(): void }

// type Orm<T extends AnySchema> = OrmHook<T> & {
// 	transact(): OrmTx<T>
// }

export type OrmTx<T extends AnySchema> = {
	[K in keyof T]: {
		get(id: string): T[K]
		proxy(id: string): ProxyObj<T[K]>
		create(obj: T[K]): void
		delete(id: string): void
	}
} & {
	db: Transaction
	commit(): void
}

export type Orm<T extends AnySchema> = {
	[K in keyof T]: {
		get(id: string): T[K]
		use(id: string): T[K]
	}
} & {
	db: OrderedTriplestore
	transact(): OrmTx<T>
}

type RuntimeSchema<T extends AnySchema> = {
	[K in keyof T]: t.RuntimeDataType<T[K]>
}

export function createOrm<T extends AnySchema>(
	db: OrderedTriplestore,
	schema: RuntimeSchema<T>
): Orm<T> {
	const orm: any = { db }
	for (const key in schema) {
		orm[key] = {
			get: (id: string) => readObj(db, id, schema[key]),
			use: (id: string) => useObj(db, id, schema[key]),
		}
	}

	orm.transact = () => {
		const tx = db.transact()
		const ormTx: any = { db: tx }
		for (const key in schema) {
			ormTx[key] = {
				get: (id: string) => readObj(db, id, schema[key]),
				proxy: (id: string) => proxyObj(db, id, schema[key]),
				create: (obj: Obj) => writeObj(tx, obj, schema[key]),
				delete: (id: string) => deleteObj(tx, id, schema[key]),
			}
		}
		ormTx.commit = () => tx.commit()
		return ormTx
	}

	return orm
}
