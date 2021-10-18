import * as t from "data-type-ts"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Obj, OrderedTriplestore, subscribeObj } from "./OrderedTriplestore"

export function useObj<T extends Obj>(
	db: OrderedTriplestore,
	id: string,
	schema: t.RuntimeDataType<T>
) {
	const objRef = useRef<T>()
	const rerender = useRerender()

	const unsubscribe = useMemo(() => {
		const [initialObj, unsubscribe] = subscribeObj(db, id, schema, (newObj) => {
			objRef.current = newObj
			rerender()
		})
		objRef.current = initialObj
		return unsubscribe
	}, [db, id, schema])

	useEffect(() => unsubscribe, [unsubscribe])

	return objRef.current as T
}

function useRerender() {
	const [state, setState] = useState(0)
	const rerender = useCallback(() => setState((state) => state + 1), [])
	return rerender
}
