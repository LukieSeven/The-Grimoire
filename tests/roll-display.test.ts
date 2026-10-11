import test from "node:test";
import assert from "node:assert/strict";
import { formatRollBreakdown } from "../src/lib/roll-display.ts";

test("roll breakdowns space operators without splitting multi-digit values", () => {
  assert.equal(formatRollBreakdown("10+5 + 7"), "10 + 5 + 7");
  assert.equal(formatRollBreakdown("10 + 8+5+1"), "10 + 8 + 5 + 1");
  assert.equal(formatRollBreakdown("(12+3)*2-1"), "(12 + 3) * 2 - 1");
});

test("roll display spacing is stable when applied repeatedly", () => {
  const formatted = formatRollBreakdown("10+5 +7");
  assert.equal(formatRollBreakdown(formatted), formatted);
});
