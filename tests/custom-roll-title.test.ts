import test from "node:test";
import assert from "node:assert/strict";
import { customRollTitle } from "../src/lib/custom-roll-title.ts";

test("manual dice and formula rolls have the requested descriptive title", () => {
  assert.equal(customRollTitle("d6"), "Custom Roll (D6)");
  assert.equal(customRollTitle("d100"), "Custom Roll (D100)");
  assert.equal(customRollTitle(" 2d6 + POWr*3 "), "Custom Roll (2D6 + POWr*3)");
  assert.equal(customRollTitle("D8"), "Custom Roll (D8)");
});
