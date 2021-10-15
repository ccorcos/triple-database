export function unreachable(value: never): never {
	throw new Error(`Unreachable: ${JSON.stringify(value)}`)
}

export type Assert<A extends ShouldBe, ShouldBe> = A

// @ts-expect-error
type SubsetObj = Assert<{ id: string }, { id: string; name: string }>
type SameObj = Assert<
	{ id: string; name: string },
	{ id: string; name: string }
>
type ExceedsObj = Assert<{ id: string; name: string }, { id: string }>

type SubsetUnion = Assert<number, number | string>
type SameUnion = Assert<number | string, number | string>

// @ts-expect-error
type ExceedUnion = Assert<number | string, number>

// https://github.com/microsoft/TypeScript/issues/27024#issuecomment-421529650
export type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <
	T
>() => T extends Y ? 1 : 2
	? true
	: false

// https://stackoverflow.com/questions/69565822/how-to-type-level-assert-a-type-is-not-any/69567373#69567373
export type AssertTrue<A extends true> = A
