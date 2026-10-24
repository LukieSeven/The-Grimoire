import test from "node:test";
import assert from "node:assert/strict";
import { getChainDie, advanceCriticalQueue, rollCriticalDie } from "../src/lib/critical-continuation.ts";

test("three initial criticals finish independently and reset only the active tier", () => {
  let progress = { criticalIndex: 0, chainCount: 0, maxChainCount: 0 };
  const states: number[][] = [];
  for (const repeats of [true, false, false, true, true, false]) {
    const next = advanceCriticalQueue(progress, 3, repeats);
    states.push([next.criticalIndex, next.chainCount, next.maxChainCount, Number(next.complete)]);
    progress = next;
  }
  assert.deepEqual(states, [[0, 1, 1, 0], [1, 0, 1, 0], [2, 0, 1, 0], [2, 1, 1, 0], [2, 2, 2, 0], [3, 0, 2, 1]]);
});

test("each continuation keeps its own sides and existing stat critical target", () => {
  assert.deepEqual(rollCriticalDie({ sides: 6 }, sides => sides).criticalDice, [{ sides: 6 }]);
  assert.equal(rollCriticalDie({ sides: 12 }, () => 4).isCrit, false);
  const stat = rollCriticalDie({ sides: 6, target: 5 }, () => 5);
  assert.equal(stat.isCrit, true);
  assert.deepEqual(stat.criticalDice, [{ sides: 6, target: 5 }]);
  const capped = rollCriticalDie({ sides: 6, target: 5 }, () => 6);
  assert.equal(capped.result, 5);
  assert.equal(capped.breakdown, "6(5)");
  assert.equal(capped.isCrit, false);
  assert.throws(() => rollCriticalDie({ sides: 0 }, () => 0));
});

test("critical continuation ignores flat constants and non-rolled stat terms", () => {
  assert.equal(getChainDie("2d8 + 5"), "d8");
  assert.equal(getChainDie("2d8 + POW"), "d8");
  assert.equal(getChainDie("POWr + POW + 5"), "powr");
  assert.equal(getChainDie("d4 + d12 + SPI"), "d12");
});
test("critical continuation never invents a fallback die", () => {
  assert.equal(getChainDie("POW + 5"), "POW + 5");
});
