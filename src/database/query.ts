// import * as _ from "lodash"
// import {
// 	Value,
// 	Direction,
// 	Index,
// 	isValue,
// 	Tuple,
// 	ReadOnlyStorage,
// 	ScanArgs,
// } from "./storage"
// import { compareTuple } from "./compareTuple"
// import { eav, ave, vea, vae, Tuple3 } from "./triplestore"
// import { scan } from "./indexHelpers"
// import { indentCascade, indentText } from "../helpers/printHelpers"

// export type Variable = { var: string }

// export function isVariable(x: any): x is Variable | Solved {
// 	return x && x.var
// }

// export function isUnsolvedVariable(x: any): x is Variable {
// 	return x && x.var && !x.solved
// }

// /**
//  * A mapping of variable names to values.
//  */
// export type Binding = { [name: string]: Value }

// export type Expression = [Value | Variable, Value | Variable, Value | Variable]

// export type AndExpression = Array<Expression>

// export type OrExpression = Array<AndExpression>

// /**
//  * When creating a plan, this represents an unkown variable that will is solved
//  * by previous expressions.
//  */
// export type Solved = { var: string; solved: true }

// export function isSolved(x: any): x is Solved {
// 	return x && x.var && x.solved
// }

// /**
//  * Intermediate state when generating the plan some unknowns are solved.
//  */
// export type PartiallySolvedExpression = [
// 	Variable | Value | Solved,
// 	Variable | Value | Solved,
// 	Variable | Value | Solved
// ]

// export type PartiallySolvedAndExpression = Array<PartiallySolvedExpression>

// export type SolvedExpression = [Value | Solved, Value | Solved, Value | Solved]

// export type ExpressionPlan = {
// 	index: Index
// 	prefix: Array<Value | Solved>
// 	unknowns: Array<Variable>
// 	// Data is saved in the database as:
// 	// [index.name, ...prefix, ...unknowns]
// }

// export function getExpressionPlan(
// 	expression: PartiallySolvedExpression
// ): ExpressionPlan {
// 	const [entity, attribute, value] = expression

// 	if (isValue(entity) || isSolved(entity)) {
// 		if (isValue(attribute) || isSolved(attribute)) {
// 			if (isValue(value) || isSolved(value)) {
// 				// EAV.
// 				// Everything in is known, but we still scan to see if it exists or not.
// 				return {
// 					index: eav,
// 					prefix: [entity, attribute, value],
// 					unknowns: [],
// 					// select * from fact
// 					// where entity = $entity
// 					// and attribute = $attribute
// 					// and value = $value
// 				}
// 			} else {
// 				// EA_
// 				return {
// 					index: eav,
// 					prefix: [entity, attribute],
// 					unknowns: [value],
// 				}
// 				// select * from fact
// 				// where entity = $entity
// 				// and attribute = $attribute
// 			}
// 		} else {
// 			if (isValue(value) || isSolved(value)) {
// 				// E_V
// 				return {
// 					index: vea,
// 					prefix: [value, entity],
// 					unknowns: [attribute],
// 				}
// 				// select * from fact
// 				// where entity = $entity
// 				// and value = $value
// 			} else {
// 				// E__
// 				// Warning: this is expensive.
// 				return {
// 					index: eav,
// 					prefix: [entity],
// 					unknowns: [attribute, value],
// 				}
// 				// select * from fact
// 				// where entity = $entity
// 				// and value = $value
// 			}
// 		}
// 	} else {
// 		if (isValue(attribute) || isSolved(attribute)) {
// 			if (isValue(value) || isSolved(value)) {
// 				// _AV
// 				return {
// 					index: ave,
// 					prefix: [attribute, value],
// 					unknowns: [entity],
// 				}
// 			} else {
// 				// _A_
// 				// Warning: this is expensive.
// 				return {
// 					index: ave,
// 					prefix: [attribute],
// 					unknowns: [value, entity],
// 				}
// 			}
// 		} else {
// 			if (isValue(value) || isSolved(value)) {
// 				// __V
// 				// Warning: this is expensive.
// 				return {
// 					index: vae,
// 					prefix: [value],
// 					unknowns: [attribute, entity],
// 				}
// 			} else {
// 				// ___
// 				// Warning: this is *very* expensive.
// 				return {
// 					index: eav,
// 					prefix: [],
// 					unknowns: [entity, attribute, value],
// 				}
// 			}
// 		}
// 	}
// }

// /**
//  * Evaluating a series of expressions, substituting intermediate bindings
//  * for solved variables.
//  */
// export type AndExpressionPlan = {
// 	bind: Binding
// 	expressionPlans: Array<ExpressionPlan>
// }

// export function getAndExpressionPlan(
// 	andExpression: PartiallySolvedAndExpression,
// 	bind: Binding = {}
// ): AndExpressionPlan {
// 	if (andExpression.length === 0) {
// 		return { bind, expressionPlans: [] }
// 	}

// 	const resolvedAndExpression = resolveUnknownsInAndExpression(
// 		andExpression,
// 		getUnknownsForBinding(bind)
// 	)

// 	const plans = resolvedAndExpression.map(expression => {
// 		const plan = getExpressionPlan(expression)
// 		const score = getExpressionPlanScore(plan)
// 		return { plan, score, expression }
// 	})

// 	const compare = compareTuple([1, 1, 1, 1])
// 	const orderedPlans = plans.sort((a, b) => compare(a.score, b.score))

// 	const [first, ...rest] = orderedPlans

// 	// Otherwise substitute the unknowns
// 	const expressions = resolveUnknownsInAndExpression(
// 		rest.map(({ expression }) => expression),
// 		first.plan.unknowns
// 	)

// 	const { expressionPlans: restPlans } = getAndExpressionPlan(expressions)

// 	return {
// 		bind,
// 		expressionPlans: [first.plan, ...restPlans],
// 	}
// }

// function getExpressionPlanScore(plan: ExpressionPlan): Tuple {
// 	// Fewer unknowns tends to mean less results.
// 	const unknowns = plan.unknowns.length

// 	// Following the flow of information feels like an intuitive heuristic.
// 	const solved = plan.prefix.reduce<number>(
// 		(sum, elm) => sum + (isSolved(elm) ? 1 : 0),
// 		0
// 	)

// 	// A deterministic ordering for the remaining known values.
// 	const prefix = plan.prefix.map(elm => (isValue(elm) ? elm : "_"))

// 	// Compose everything together into a sort.
// 	return [unknowns, solved, plan.index.name, JSON.stringify(prefix)]
// }

// export function resolveUnknownsInAndExpression(
// 	andExpression: PartiallySolvedAndExpression,
// 	unknowns: Array<Variable>
// ) {
// 	return andExpression.map(expression =>
// 		resolveUnknownsInExpression(expression, unknowns)
// 	)
// }

// export function resolveUnknownsInExpression(
// 	expression: PartiallySolvedExpression,
// 	unknowns: Array<Variable>
// ): PartiallySolvedExpression {
// 	const tuple = expression.map(value => {
// 		for (const unknown of unknowns) {
// 			if (isVariable(value) && value.var === unknown.var) {
// 				const solved: Solved = {
// 					...unknown,
// 					solved: true,
// 				}
// 				return solved
// 			}
// 		}
// 		return value
// 	})

// 	const newExpression = tuple as PartiallySolvedExpression
// 	return newExpression
// }

// export type OrExpressionPlan = Array<AndExpressionPlan>

// export function getOrExpressionPlan(
// 	orExpression: OrExpression,
// 	bind: Binding = {}
// ): OrExpressionPlan {
// 	return orExpression.map(andExpression =>
// 		getAndExpressionPlan(andExpression, bind)
// 	)
// }

// function evaluateExpressionPlan(
// 	storage: ReadOnlyStorage,
// 	plan: ExpressionPlan
// ): Array<Binding> {
// 	const prefix = plan.prefix.map(elm => {
// 		if (isValue(elm)) {
// 			return elm
// 		} else {
// 			throw new Error("Unresolved plan.\n" + JSON.stringify(plan, null, 2))
// 		}
// 	})

// 	const results = storage.scan(plan.index, { start: prefix, end: prefix })

// 	const bindings = results.map(key => {
// 		const binding: Binding = {}
// 		for (let i = 0; i < plan.unknowns.length; i++) {
// 			binding[plan.unknowns[i].var] = key[prefix.length + i]
// 		}
// 		return binding
// 	})

// 	return bindings
// }

// export type ExpressionReport = {
// 	plan: ExpressionPlan
// 	evaluationCount: number
// 	resultCount: number
// }

// export type AndExpressionReport = {
// 	bind: Binding
// 	expressionReports: Array<ExpressionReport>
// }

// export function evaluateAndExpressionPlan(
// 	storage: ReadOnlyStorage,
// 	andExpressionPlan: AndExpressionPlan
// ): { bindings: Array<Binding>; report: AndExpressionReport } {
// 	const { bind, expressionPlans } = andExpressionPlan

// 	if (expressionPlans.length === 0) {
// 		return {
// 			bindings: [],
// 			report: {
// 				bind,
// 				expressionReports: [],
// 			},
// 		}
// 	}

// 	const resolvedExpressionPlans = resolveBindingInExpressionPlans(
// 		expressionPlans,
// 		bind
// 	)

// 	let bindings: Array<Binding> = []
// 	const report: AndExpressionReport = {
// 		bind: bind,
// 		expressionReports: expressionPlans.map(plan => ({
// 			plan,
// 			evaluationCount: 0,
// 			resultCount: 0,
// 		})),
// 	}

// 	const plan = resolvedExpressionPlans[0]

// 	// Evaluate the first plan.
// 	bindings = evaluateExpressionPlan(storage, plan).map(binding => ({
// 		...binding,
// 		...bind,
// 	}))
// 	report.expressionReports[0].evaluationCount += 1
// 	report.expressionReports[0].resultCount += bindings.length

// 	for (let j = 1; j < expressionPlans.length; j++) {
// 		// Evaluate these bindings for the rest of the expressions.
// 		const nextPlan = expressionPlans[j]

// 		bindings = _.flatten(
// 			bindings.map(binding => {
// 				const resolvedPlan = resolveBindingInExpressionPlan(nextPlan, binding)
// 				const moreBindings = evaluateExpressionPlan(storage, resolvedPlan)
// 				report.expressionReports[j].evaluationCount += 1
// 				report.expressionReports[j].resultCount += moreBindings.length

// 				// Combine the bindings.
// 				return moreBindings.map(newBinding => ({ ...binding, ...newBinding }))
// 			})
// 		)
// 	}

// 	return { bindings, report }
// }

// export function resolveBindingInExpressionPlan(
// 	expressionPlan: ExpressionPlan,
// 	binding: Binding
// ): ExpressionPlan {
// 	const { prefix, ...rest } = expressionPlan
// 	return {
// 		...rest,
// 		prefix: prefix.map(elm => {
// 			if (isSolved(elm) && elm.var in binding) {
// 				return binding[elm.var]
// 			} else {
// 				return elm
// 			}
// 		}),
// 	}
// }

// export function resolveBindingInExpressionPlans(
// 	expressionPlans: Array<ExpressionPlan>,
// 	binding: Binding
// ): Array<ExpressionPlan> {
// 	return expressionPlans.map(expressionPlan =>
// 		resolveBindingInExpressionPlan(expressionPlan, binding)
// 	)
// }

// export type OrExpressionReport = Array<AndExpressionReport>

// export function evaluateOrExpressionPlan(
// 	storage: ReadOnlyStorage,
// 	plan: OrExpressionPlan
// ) {
// 	const result = plan.map(andExpressionPlan => {
// 		return evaluateAndExpressionPlan(storage, andExpressionPlan)
// 	})

// 	const report: OrExpressionReport = result.map(({ report }) => report)
// 	const bindings = _.flatten(result.map(({ bindings }) => bindings))

// 	return { report, bindings }
// }

// export type VariableSort = Array<[Variable, Direction]>

// export type QuerySortArgs = {
// 	filter: OrExpression
// 	sort: VariableSort
// 	scan?: ScanArgs
// 	bind?: Binding
// }

// export function querySort(storage: ReadOnlyStorage, args: QuerySortArgs) {
// 	const { filter: orExpression, sort, scan: scanArgs, bind } = args

// 	const { report, bindings } = evaluateOrExpressionPlan(
// 		storage,
// 		getOrExpressionPlan(orExpression, bind || {})
// 	)

// 	// Sorted tuples in memory.
// 	const tuples = bindings.map(binding => {
// 		return sort.map(item => binding[item[0].var])
// 	})
// 	const directions = sort.map(item => item[1])
// 	tuples.sort(compareTuple(directions))

// 	const data = scan(directions, tuples, scanArgs)

// 	return { data, report }
// }

// export function query(
// 	storage: ReadOnlyStorage,
// 	args: { filter: OrExpression; bind?: Binding }
// ) {
// 	return evaluateOrExpressionPlan(
// 		storage,
// 		getOrExpressionPlan(args.filter, args.bind || {})
// 	)
// }

// export function prettyOrExpressionPlan(plan: OrExpressionPlan): string {
// 	return plan.map(prettyAndExpressionPlan).join("\n")
// }

// export function prettyAndExpressionPlan(plan: AndExpressionPlan): string {
// 	const { bind, expressionPlans } = plan
// 	const andPlan = indentCascade(expressionPlans.map(prettyExpressionPlan))
// 	if (Object.keys(bind).length) {
// 		return [`BIND ${prettyBinding(bind)}`, indentText(andPlan)].join("\n")
// 	}
// 	return andPlan
// }

// function prettyExpressionPlan(plan: ExpressionPlan): string {
// 	return [
// 		`SCAN ${plan.index.name} `,
// 		prettyExpression([...plan.prefix, ...plan.unknowns]),
// 		` - ${plan.unknowns.length} unknown`,
// 	].join("")
// }

// export function prettyExpression(tuple: Array<Value | Variable>) {
// 	return [
// 		`[`,
// 		tuple
// 			.map(elm => (isValue(elm) ? JSON.stringify(elm) : `{var: "${elm.var}"}`))
// 			.join(", "),
// 		`]`,
// 	].join("")
// }

// export function prettyBinding(binding: Binding) {
// 	return [
// 		`{`,
// 		Object.entries(binding)
// 			.map(([key, value]) => {
// 				return `${key}: ${JSON.stringify(value)}`
// 			})
// 			.join(", "),
// 		`}`,
// 	].join("")
// }

// export function prettyOrExpressionReport(report: OrExpressionReport): string {
// 	return report.map(prettyAndExpressionReport).join("\n")
// }

// export function prettyAndExpressionReport(report: AndExpressionReport): string {
// 	const { bind, expressionReports } = report
// 	const andReport = indentCascade(expressionReports.map(prettyExpressionReport))
// 	if (Object.keys(bind).length) {
// 		return [`BIND ${prettyBinding(bind)}`, indentText(andReport)].join("\n")
// 	}
// 	return andReport
// }

// function prettyExpressionReport(report: ExpressionReport): string {
// 	return [
// 		prettyExpressionPlan(report.plan),
// 		`, ${report.evaluationCount} evaluations`,
// 		`, ${report.resultCount} results`,
// 	].join("")
// }

// export function getUnknownsForBinding(binding: Binding): Array<Variable> {
// 	return Object.keys(binding).map(varName => ({ var: varName }))
// }

// export function resolveBindingInAndExpression(
// 	andExpression: AndExpression,
// 	binding: Binding
// ): AndExpression {
// 	return andExpression.map(expression =>
// 		resolveBindingInExpression(expression, binding)
// 	)
// }

// function expresionToTuple3(expression: Expression): Tuple3 {
// 	for (const item of expression) {
// 		if (isValue(item)) {
// 			throw new Error(
// 				"Could not resolve expression: " + JSON.stringify({ expression, item })
// 			)
// 		}
// 	}
// 	return expression as Tuple3
// }

// export function resolveFactsFromAndExpression(
// 	andExpression: AndExpression,
// 	binding: Binding
// ): Array<Tuple3> {
// 	const maybeFacts = resolveBindingInAndExpression(andExpression, binding)
// 	return maybeFacts.map(expresionToTuple3)
// }

// export function resolveBindingInExpression(
// 	expression: Expression,
// 	binding: Binding
// ) {
// 	const tuple = expression.map(elm => {
// 		if (isValue(elm)) {
// 			return elm
// 		}
// 		if (elm.var in binding) {
// 			return binding[elm.var]
// 		}
// 		return elm
// 	})
// 	return tuple as Expression
// }
