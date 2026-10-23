import test from "node:test";
import assert from "node:assert/strict";
import { resourceDisplay } from "../src/lib/resource-display.ts";

test("temporary points are included in the displayed current amount even above maximum", () => {
  assert.deepEqual(resourceDisplay(101, 10), { total: 111, temporary: 10, hasTemporary: true });
  assert.deepEqual(resourceDisplay(70, 10), { total: 80, temporary: 10, hasTemporary: true });
  assert.deepEqual(resourceDisplay(91, 7), { total: 98, temporary: 7, hasTemporary: true });
});
test("no temporary pool keeps the normal value and appearance", () => {
  assert.deepEqual(resourceDisplay(70), { total: 70, temporary: 0, hasTemporary: false });
  assert.deepEqual(resourceDisplay(70, 0), { total: 70, temporary: 0, hasTemporary: false });
});
