import { strict as assert } from "assert"
import { describe, it } from "mocha"
import * as p from "parsimmon"
import {
	pAdd,
	pIndex,
	pNumber,
	pQuery,
	pRemove,
	pScan,
	pString,
	pValue,
	pVar,
} from "./repl"

describe("pString", () => {
	it("works", () => {
		const parsed = pString.parse("hello")
		assert.ok(parsed.status)
		assert.equal(parsed.value, "hello")
	})
	it("composes", () => {
		const parsed = pString.then(p.whitespace).then(pString).parse("hello world")
		assert.ok(parsed.status)
		assert.equal(parsed.value, "world")
	})

	it("allows quotes", () => {
		const parsed = pString.parse('"hello world"')
		assert.ok(parsed.status)
		assert.equal(parsed.value, "hello world")
	})

	it("allows excaped quotes", () => {
		const parsed = pString.parse('"hello \\"world"')
		assert.ok(parsed.status)
		assert.equal(parsed.value, 'hello "world')
	})
})

describe("pNumber", () => {
	it("works", () => {
		const parsed = pNumber.parse("12")
		assert.ok(parsed.status)
		assert.equal(parsed.value, 12)
	})
	it("negative", () => {
		const parsed = pNumber.parse("-12")
		assert.ok(parsed.status)
		assert.equal(parsed.value, -12)
	})
	it("decimal", () => {
		const parsed = pNumber.parse("-12.4")
		assert.ok(parsed.status)
		assert.equal(parsed.value, -12.4)
	})
	it("exponent", () => {
		const parsed = pNumber.parse("1e2")
		assert.ok(parsed.status)
		assert.equal(parsed.value, 100)
	})
})

describe("pValue", () => {
	it("prefers numbers", () => {
		const parsed = pValue.parse("12")
		assert.ok(parsed.status)
		assert.equal(parsed.value, 12)
	})
	it("strings too though", () => {
		const parsed = pValue.parse("a12")
		assert.ok(parsed.status)
		assert.equal(parsed.value, "a12")
	})
	it("fails appropriately", () => {
		const parsed = pValue.parse("12a")
		assert.ok(!parsed.status)
	})
})

describe("pVar", () => {
	it("works", () => {
		const parsed = pVar.parse("?apple")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value.name, "apple")
	})
})

describe("pAdd", () => {
	it("works", () => {
		const parsed = pAdd.parse("add 1 2 3")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, [[1, 2, 3]])
	})
	it("can do multiple facts", () => {
		const parsed = pAdd.parse("add 1 2 3, a b c")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, [
			[1, 2, 3],
			["a", "b", "c"],
		])
	})
})

describe("pRemove", () => {
	it("works", () => {
		const parsed = pRemove.parse("remove 1 2 3")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, [[1, 2, 3]])
	})
	it("can do multiple facts", () => {
		const parsed = pRemove.parse("remove 1 2 3, a b c")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, [
			[1, 2, 3],
			["a", "b", "c"],
		])
	})
})

describe("pQuery", () => {
	it("filter ?a b c", () => {
		const parsed = pQuery.parse("filter ?a b c")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, {
			filter: [[[{ var: "a" }, { value: "b" }, { value: "c" }]]],
		})
	})
	it("filter ?a b c, x y ?z", () => {
		const parsed = pQuery.parse("filter ?a b c, x y ?z")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, {
			filter: [
				[
					[{ var: "a" }, { value: "b" }, { value: "c" }],
					[{ value: "x" }, { value: "y" }, { var: "z" }],
				],
			],
		})
	})

	it("filter ?a b c | sort ?a", () => {
		const parsed = pQuery.parse("filter ?a b c | sort ?a")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, {
			filter: [[[{ var: "a" }, { value: "b" }, { value: "c" }]]],
			sort: [{ var: "a" }],
		})
	})

	it("pIndex", () => {
		const parsed = pIndex.parse("index thing ?a")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, { name: "thing", sort: [{ var: "a" }] })
	})

	it("filter ?a b c | index thing ?a", () => {
		const parsed = pQuery.parse("filter ?a b c | index thing ?a")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, {
			name: "thing",
			filter: [[[{ var: "a" }, { value: "b" }, { value: "c" }]]],
			sort: [{ var: "a" }],
		})
	})
})

describe("pScan", () => {
	it("scan people >=Chet - !10", () => {
		const parsed = pScan.parse("scan people >=Chet Corcos - !10")
		assert.ok(parsed.status)
		assert.deepEqual(parsed.value, {
			index: "people",
			reverse: true,
			limit: 10,
			gte: ["Chet", "Corcos"],
		})
	})
})
