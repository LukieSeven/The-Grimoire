import test from "node:test";
import assert from "node:assert/strict";
import { blankAbilityInput, blankResult, targetResults, TARGET_TYPES } from "../src/lib/ability-input.ts";
import { resolveTrackerEffects } from "../src/lib/tracker.ts";
import type { Ability } from "../src/lib/storage.ts";

test("every target including Summon and custom targets gets empty description and roll inputs", () => {
  const input = blankAbilityInput();
  for (const target of [...TARGET_TYPES, "Custom target"]) {
    const [result] = targetResults(input, target);
    assert.equal(result.target, target); assert.equal(result.rules, ""); assert.equal(result.formula, "");
  }
  assert.deepEqual(input.results, []);
});
test("target input lookup preserves existing descriptions, formulas and saved metadata", () => {
  const input = blankAbilityInput(), result = { ...blankResult("Ally"), name: "Old effect name", rules: "Existing description", formula: "SPI", value: "Existing value" };
  input.results = [result];
  assert.equal(targetResults(input, "Ally")[0], result);
  assert.equal(result.rules, "Existing description"); assert.equal(result.formula, "SPI");
});
test("main and Sub-Ability names replace all custom effect and roll-purpose titles", () => {
  const input = blankAbilityInput(); input.name = "Test primary ability"; input.targets = ["Self", "Ally", "Enemy"];
  input.results = input.targets.map(target => ({ ...blankResult(target), name: "Old custom label", purpose: "Old roll purpose", rules: `${target} description`, formula: "POW" }));
  const sub = blankAbilityInput(); sub.name = "Test alternate use"; sub.targets = ["Enemy"]; sub.results = [{ ...blankResult("Enemy"), name: "Another old label", formula: "SPI" }]; input.subAbilities = [sub];
  const entries = resolveTrackerEffects([{ id: 1, name: input.name, definition: input } as Ability], "Iron", {});
  assert.ok(entries.filter(entry => entry.input?.id === input.id).every(entry => entry.effect.name === input.name));
  assert.ok(entries.filter(entry => entry.input?.id === sub.id).every(entry => entry.effect.name === sub.name));
});
