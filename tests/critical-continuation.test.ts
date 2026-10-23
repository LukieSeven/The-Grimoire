import test from "node:test";
import assert from "node:assert/strict";
import { getChainDie } from "../src/lib/critical-continuation.ts";

test("critical continuation ignores flat constants and non-rolled stat terms", () => {
  assert.equal(getChainDie("2d8 + 5"), "d8");
  assert.equal(getChainDie("2d8 + POW"), "d8");
  assert.equal(getChainDie("POWr + POW + 5"), "powr");
  assert.equal(getChainDie("d4 + d12 + SPI"), "d12");
});
test("critical continuation never invents a fallback die", () => {
  assert.equal(getChainDie("POW + 5"), "POW + 5");
});
