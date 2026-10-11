import test from "node:test";
import assert from "node:assert/strict";
import { shouldEndAbilityOnUse } from "../src/lib/ability-use-action.ts";
import { normalizeBonuses } from "../src/lib/ability-bonuses.ts";
test("explicit rolls do not toggle off an active ability", () => {
  assert.equal(shouldEndAbilityOnUse(true, "While Active", false), false);
  assert.equal(shouldEndAbilityOnUse(true, "While Active", true), true);
  assert.equal(shouldEndAbilityOnUse(false, "While Active", true), false);
  assert.equal(shouldEndAbilityOnUse(true, "When Triggered", true), false);
});
test("Bonus aliases merge into Buff without losing formulas or stacking on repeated normalization", () => {
  const normalized = normalizeBonuses({ manaBuff: "SPI/2", bonusMana: "-3", bonusDt: 2 });
  assert.equal(normalized.manaBuff, "(SPI/2)+(-3)"); assert.equal(normalized.dtBuff, 2);
  assert.equal(normalized.bonusMana, undefined); assert.deepEqual(normalizeBonuses(normalized), normalized);
});
