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
