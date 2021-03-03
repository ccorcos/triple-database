import * as assert from "assert"
export { assert }
export const describe: typeof import("mocha").describe = global["describe"]
export const suite: typeof import("mocha").suite = global["suite"]
export const it: typeof import("mocha").it = global["it"]
export const xit: typeof import("mocha").xit = global["xit"]
export const test: typeof import("mocha").test = global["test"]
export const run: typeof import("mocha").run = global["run"]
export const setup: typeof import("mocha").setup = global["setup"]
export const teardown: typeof import("mocha").teardown = global["teardown"]
export const suiteSetup: typeof import("mocha").suiteSetup =
	global["suiteSetup"]
export const suiteTeardown: typeof import("mocha").suiteTeardown =
	global["suiteTeardown"]
export const before: typeof import("mocha").before = global["before"]
export const after: typeof import("mocha").after = global["after"]
export const beforeEach: typeof import("mocha").beforeEach =
	global["beforeEach"]
export const afterEach: typeof import("mocha").afterEach = global["afterEach"]
export type Mocha = typeof import("mocha").Mocha
