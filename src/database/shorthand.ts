import { AndExpression, Expression, Sort } from "./query"
import { Value } from "./types"

class Variable {
	constructor(public name: string) {}
}

export type $Expression = [Value | Variable, Value | Variable, Value | Variable]
export type $AndExpression = $Expression[]
export type $OrExpression = $AndExpression[]

export function $(name: string) {
	return new Variable(name)
}

export function and(andExpression: $AndExpression): AndExpression {
	return andExpression.map(
		(expression) =>
			expression.map((item) =>
				item instanceof Variable ? { var: item.name } : { value: item }
			) as Expression
	)
}

export function sorted(sort: Variable[]): Sort {
	return sort.map((item) => ({ var: item.name }))
}

// store.ensureIndex({
// 	name: "personByLastFirst",
// 	filter: and([
// 		[$("id"), "type", "Person"],
// 		[$("id"), "firstName", $("firstName")],
// 		[$("id"), "lastName", $("lastName")],
// 	]),
// 	sort: sorted([$("lastName"), $("firstName"), $("id")]),
// })
