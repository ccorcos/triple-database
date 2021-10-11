import { flatten } from "lodash"
import { compareTuple } from "tuple-database/helpers/compareTuple"
import { scan } from "tuple-database/helpers/sortedTupleArray"
import { ReadOnlyTupleStorage, ScanArgs } from "tuple-database/storage/types"
import { indentCascade, indentText } from "../helpers/printHelpers"
import { Fact, Tuple, Value } from "./types"

export type Variable = { var: string }
export type Literal = { lit: Value }

export function isVariable(x: any): x is Variable {
	return Boolean(x && typeof x === "object" && "var" in x)
}

export function isLiteral(x: any): x is Literal {
	return Boolean(x && typeof x === "object" && "lit" in x)
}

/**
 * When creating a plan, this represents an unkown variable that will is solved
 * by previous expressions.
 */
export type Solved = { solved: string }

export function isSolved(x: any): x is Solved {
	return Boolean(x && typeof x === "object" && "solved" in x)
}

/**
 * A mapping of variable names to values.
 */
export type Binding = { [name: string]: Value }

export type Expression = [
	Literal | Variable,
	Literal | Variable,
	Literal | Variable
]

// TODO: {and: Array<Expression>}
export type AndExpression = Array<Expression>

// TODO: {or: AndExpression}
export type OrExpression = Array<AndExpression>

/**
 * Intermediate state when generating the plan some unknowns are solved.
 */
export type PartiallySolvedExpression = [
	Variable | Literal | Solved,
	Variable | Literal | Solved,
	Variable | Literal | Solved
]

export type PartiallySolvedAndExpression = Array<PartiallySolvedExpression>
export type PartiallySolvedOrExpression = Array<PartiallySolvedAndExpression>

export type ExpressionPlan = {
	index: string
	prefix: Array<Literal | Solved>
	unknowns: Array<Variable>
}

export function getExpressionPlan(
	expression: PartiallySolvedExpression
): ExpressionPlan {
	const [entity, attribute, value] = expression

	if (isLiteral(entity) || isSolved(entity)) {
		if (isLiteral(attribute) || isSolved(attribute)) {
			if (isLiteral(value) || isSolved(value)) {
				// EAV.
				// Everything in is known, but we still scan to see if it exists or not.
				return {
					index: "eav",
					prefix: [entity, attribute, value],
					unknowns: [],
					// select * from fact
					// where entity = $entity
					// and attribute = $attribute
					// and value = $value
				}
			} else {
				value
				// EA_
				return {
					index: "eav",
					prefix: [entity, attribute],
					unknowns: [value],
				}
				// select * from fact
				// where entity = $entity
				// and attribute = $attribute
			}
		} else {
			if (isLiteral(value) || isSolved(value)) {
				// E_V
				return {
					index: "vea",
					prefix: [value, entity],
					unknowns: [attribute],
				}
				// select * from fact
				// where entity = $entity
				// and value = $value
			} else {
				// E__
				// Warning: this is expensive.
				return {
					index: "eav",
					prefix: [entity],
					unknowns: [attribute, value],
				}
				// select * from fact
				// where entity = $entity
				// and value = $value
			}
		}
	} else {
		if (isLiteral(attribute) || isSolved(attribute)) {
			if (isLiteral(value) || isSolved(value)) {
				// _AV
				return {
					index: "ave",
					prefix: [attribute, value],
					unknowns: [entity],
				}
			} else {
				// _A_
				// Warning: this is expensive.
				return {
					index: "ave",
					prefix: [attribute],
					unknowns: [value, entity],
				}
			}
		} else {
			if (isLiteral(value) || isSolved(value)) {
				// __V
				// Warning: this is expensive.
				return {
					index: "vae",
					prefix: [value],
					unknowns: [attribute, entity],
				}
			} else {
				// ___
				// Warning: this is *very* expensive.
				return {
					index: "eav",
					prefix: [],
					unknowns: [entity, attribute, value],
				}
			}
		}
	}
}

/**
 * Evaluating a series of expressions, substituting intermediate bindings
 * for solved variables.
 */
export type AndExpressionPlan = {
	bind: Binding
	expressionPlans: Array<ExpressionPlan>
}

export function getAndExpressionPlan(
	andExpression: PartiallySolvedAndExpression,
	bind: Binding = {}
): AndExpressionPlan {
	if (andExpression.length === 0) {
		return { bind, expressionPlans: [] }
	}

	const resolvedAndExpression = resolveUnknownsInAndExpression(
		andExpression,
		getUnknownsForBinding(bind)
	)

	const plans = resolvedAndExpression.map((expression) => {
		const plan = getExpressionPlan(expression)
		const score = getExpressionPlanScore(plan)
		return { plan, score, expression }
	})

	const orderedPlans = plans.sort((a, b) => compareTuple(a.score, b.score))

	const [first, ...rest] = orderedPlans

	// Otherwise substitute the unknowns
	const expressions = resolveUnknownsInAndExpression(
		rest.map(({ expression }) => expression),
		first.plan.unknowns
	)

	const { expressionPlans: restPlans } = getAndExpressionPlan(expressions)

	return {
		bind,
		expressionPlans: [first.plan, ...restPlans],
	}
}

function getExpressionPlanScore(plan: ExpressionPlan): Tuple {
	// Fewer unknowns tends to mean less results.
	const unknowns = plan.unknowns.length

	// Following the flow of information feels like an intuitive heuristic.
	const solved = plan.prefix.reduce<number>(
		(sum, elm) => sum + (isSolved(elm) ? 1 : 0),
		0
	)

	// Compose everything together into a sort.
	return [unknowns, solved]
}

export function resolveUnknownsInAndExpression(
	andExpression: PartiallySolvedAndExpression,
	unknowns: Array<Variable>
) {
	return andExpression.map((expression) =>
		resolveUnknownsInExpression(expression, unknowns)
	)
}

export function resolveUnknownsInExpression(
	expression: PartiallySolvedExpression,
	unknowns: Array<Variable>
): PartiallySolvedExpression {
	const tuple = expression.map((value) => {
		for (const unknown of unknowns) {
			if (isVariable(value) && value.var === unknown.var) {
				const solved: Solved = { solved: unknown.var }
				return solved
			}
		}
		return value
	})

	const newExpression = tuple as PartiallySolvedExpression
	return newExpression
}

export type OrExpressionPlan = Array<AndExpressionPlan>

export function getOrExpressionPlan(
	orExpression: OrExpression,
	bind: Binding = {}
): OrExpressionPlan {
	return orExpression.map((andExpression) =>
		getAndExpressionPlan(andExpression, bind)
	)
}

function evaluateExpressionPlan(
	storage: ReadOnlyTupleStorage,
	plan: ExpressionPlan
): Array<Binding> {
	const prefix: Tuple = plan.prefix.map((elm) => {
		if (isLiteral(elm)) {
			return elm.lit
		} else {
			throw new Error("Unresolved plan.\n" + JSON.stringify(plan, null, 2))
		}
	})

	const results = storage.scan({ prefix: [plan.index, ...prefix] })

	const bindings = results.map(([key]) => {
		const binding: Binding = {}
		for (let i = 0; i < plan.unknowns.length; i++) {
			binding[plan.unknowns[i].var] = key[1 + prefix.length + i]
		}
		return binding
	})

	return bindings
}

export type ExpressionReport = {
	plan: ExpressionPlan
	// How many times this expression was run?
	// If this expresion is not evaluated first, it will be recursively evaluating.
	evaluationCount: number
	// How many results were there from this expression?
	resultCount: number
}

export type AndExpressionReport = {
	bind: Binding
	expressionReports: Array<ExpressionReport>
}

export function evaluateAndExpressionPlan(
	storage: ReadOnlyTupleStorage,
	andExpressionPlan: AndExpressionPlan
): { bindings: Array<Binding>; report: AndExpressionReport } {
	const { bind, expressionPlans } = andExpressionPlan

	if (expressionPlans.length === 0) {
		return {
			bindings: [],
			report: {
				bind,
				expressionReports: [],
			},
		}
	}

	const resolvedExpressionPlans = resolveBindingInExpressionPlans(
		expressionPlans,
		bind
	)

	let bindings: Array<Binding> = []
	const report: AndExpressionReport = {
		bind: bind,
		expressionReports: expressionPlans.map((plan) => ({
			plan,
			evaluationCount: 0,
			resultCount: 0,
		})),
	}

	const plan = resolvedExpressionPlans[0]

	// Evaluate the first plan.
	bindings = evaluateExpressionPlan(storage, plan).map((binding) => ({
		...binding,
		...bind,
	}))
	report.expressionReports[0].evaluationCount += 1
	report.expressionReports[0].resultCount += bindings.length

	for (let j = 1; j < expressionPlans.length; j++) {
		// Evaluate these bindings for the rest of the expressions.
		const nextPlan = expressionPlans[j]

		bindings = flatten(
			bindings.map((binding) => {
				const resolvedPlan = resolveBindingInExpressionPlan(nextPlan, binding)
				const moreBindings = evaluateExpressionPlan(storage, resolvedPlan)
				report.expressionReports[j].evaluationCount += 1
				report.expressionReports[j].resultCount += moreBindings.length

				// Combine the bindings.
				return moreBindings.map((newBinding) => ({ ...binding, ...newBinding }))
			})
		)
	}

	return { bindings, report }
}

export function resolveBindingInExpressionPlan(
	expressionPlan: ExpressionPlan,
	binding: Binding
): ExpressionPlan {
	const { prefix, ...rest } = expressionPlan
	return {
		...rest,
		prefix: prefix.map((elm) => {
			if (isSolved(elm) && elm.solved in binding) {
				return { lit: binding[elm.solved] }
			} else {
				return elm
			}
		}),
	}
}

export function resolveBindingInExpressionPlans(
	expressionPlans: Array<ExpressionPlan>,
	binding: Binding
): Array<ExpressionPlan> {
	return expressionPlans.map((expressionPlan) =>
		resolveBindingInExpressionPlan(expressionPlan, binding)
	)
}

export type OrExpressionReport = Array<AndExpressionReport>

export function evaluateOrExpressionPlan(
	storage: ReadOnlyTupleStorage,
	plan: OrExpressionPlan
) {
	const result = plan.map((andExpressionPlan) => {
		return evaluateAndExpressionPlan(storage, andExpressionPlan)
	})

	const report: OrExpressionReport = result.map(({ report }) => report)
	const bindings = flatten(result.map(({ bindings }) => bindings))

	return { report, bindings }
}

export type Sort = Array<Variable>

export type QuerySortArgs = {
	// Bind(Expression): Expression
	bind?: Binding
	// Filter(Expression): Bindings
	filter: OrExpression
	// Sort(Binding): Tuple
	sort: Sort
	// Scan(Tuple): Tuple
	scan?: ScanArgs
}

export function querySort(storage: ReadOnlyTupleStorage, args: QuerySortArgs) {
	const { filter: orExpression, sort, scan: scanArgs, bind } = args

	const { report, bindings } = evaluateOrExpressionPlan(
		storage,
		getOrExpressionPlan(orExpression, bind || {})
	)

	// Sorted tuples in memory.
	const tuples = bindings.map((binding) => {
		return sort.map((item) => binding[item.var])
	})
	tuples.sort(compareTuple)

	const data = scan(tuples, scanArgs)

	return { data, report }
}

export type QueryArgs = {
	// Bind(Expression): Expression
	bind?: Binding
	// Filter(Expression): Bindings
	filter: OrExpression
}

export function query(storage: ReadOnlyTupleStorage, args: QueryArgs) {
	return evaluateOrExpressionPlan(
		storage,
		getOrExpressionPlan(args.filter, args.bind || {})
	)
}

export function prettyOrExpressionPlan(plan: OrExpressionPlan): string {
	return plan.map(prettyAndExpressionPlan).join("\n")
}

export function prettyAndExpressionPlan(plan: AndExpressionPlan): string {
	const { bind, expressionPlans } = plan
	const andPlan = indentCascade(expressionPlans.map(prettyExpressionPlan))
	if (Object.keys(bind).length) {
		return [`BIND ${prettyBinding(bind)}`, indentText(andPlan)].join("\n")
	}
	return andPlan
}

function prettyExpressionPlan(plan: ExpressionPlan): string {
	return [
		`SCAN ${plan.index} `,
		prettyExpression([...plan.prefix, ...plan.unknowns]),
		` - ${plan.unknowns.length} unknown`,
	].join("")
}

export function prettyFact(tuple: Array<Value>) {
	return prettyExpression(tuple.map((value) => ({ lit: value })))
}

export function prettyExpression(tuple: Array<Literal | Variable | Solved>) {
	return [
		`[`,
		tuple
			.map((elm) =>
				isLiteral(elm)
					? JSON.stringify(elm.lit)
					: isVariable(elm)
					? `{var: "${elm.var}"}`
					: `{solved: "${elm.solved}"}`
			)
			.join(", "),
		`]`,
	].join("")
}

export function prettyBinding(binding: Binding) {
	return [
		`{`,
		Object.entries(binding)
			.map(([key, value]) => {
				return `${key}: ${JSON.stringify(value)}`
			})
			.join(", "),
		`}`,
	].join("")
}

export function prettyOrExpressionReport(report: OrExpressionReport): string {
	return report.map(prettyAndExpressionReport).join("\n")
}

export function prettyAndExpressionReport(report: AndExpressionReport): string {
	const { bind, expressionReports } = report
	const andReport = indentCascade(expressionReports.map(prettyExpressionReport))
	if (Object.keys(bind).length) {
		return [`BIND ${prettyBinding(bind)}`, indentText(andReport)].join("\n")
	}
	return andReport
}

function prettyExpressionReport(report: ExpressionReport): string {
	return [
		prettyExpressionPlan(report.plan),
		`, ${report.evaluationCount} evaluations`,
		`, ${report.resultCount} results`,
	].join("")
}

export function getUnknownsForBinding(binding: Binding): Array<Variable> {
	return Object.keys(binding).map((varName) => ({ var: varName }))
}

export function resolveBindingInAndExpression(
	andExpression: AndExpression,
	binding: Binding
): AndExpression {
	return andExpression.map((expression) =>
		resolveBindingInExpression(expression, binding)
	)
}

function expresionToFact(expression: Expression): Fact {
	for (const item of expression) {
		if (!isLiteral(item)) {
			throw new Error(
				"Could not resolve expression: " + JSON.stringify({ expression, item })
			)
		}
	}

	const values = expression.map((item) => {
		if (isLiteral(item)) {
			return item.lit
		} else {
			throw new Error(
				"Could not resolve expression: " + JSON.stringify({ expression, item })
			)
		}
	})

	return values as Fact
}

export function resolveFactsFromAndExpression(
	andExpression: AndExpression,
	binding: Binding
): Array<Fact> {
	const maybeFacts = resolveBindingInAndExpression(andExpression, binding)
	return maybeFacts.map(expresionToFact)
}

export function resolveBindingInExpression(
	expression: Expression,
	binding: Binding
) {
	const tuple: Array<Literal | Variable> = expression.map((elm) => {
		if (isLiteral(elm)) {
			return elm
		}
		if (elm.var in binding) {
			return { lit: binding[elm.var] }
		}
		return elm
	})
	return tuple as Expression
}
