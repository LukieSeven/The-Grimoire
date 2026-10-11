import test from "node:test";
import assert from "node:assert/strict";
import { favoriteRollChoices } from "../src/lib/favorite-rolls.ts";
import { blankAbilityInput, blankResult } from "../src/lib/ability-input.ts";
import { resolveTrackerEffects } from "../src/lib/tracker.ts";
import type { Ability } from "../src/lib/storage.ts";
test("generic ability Favorites resolve the actual formula without falling through to navigation", () => {
  const input = blankAbilityInput(); input.name = "Test ability"; input.targets = ["Enemy"]; input.results = [{ ...blankResult("Enemy"), formula: "POW*2" }];
  const sub = blankAbilityInput(); sub.name = "Test alternate"; sub.targets = ["Self"]; sub.results = [{ ...blankResult("Self"), formula: "SPI" }]; input.subAbilities = [sub];
  const ability = { id: 1, name: input.name, definition: input } as Ability;
  const entries = resolveTrackerEffects([ability], "Iron", {});
  assert.deepEqual(favoriteRollChoices(entries, 1, input.id).map(entry => entry.effect.rollFormula), ["POW*2"]);
  assert.deepEqual(favoriteRollChoices(entries, 1, sub.id).map(entry => entry.effect.rollFormula), ["SPI"]);
  assert.deepEqual(favoriteRollChoices(entries, 2, input.id), []);
});
test("multiple target formulas remain separate choices and blank formulas are not rolled", () => {
  const input = blankAbilityInput(); input.name = "Test ability"; input.targets = ["Self", "Ally", "Enemy"];
  input.results = input.targets.map((target, index) => ({ ...blankResult(target), formula: index === 0 ? "" : index === 1 ? "SPI" : "POW" }));
  const ability = { id: 1, name: input.name, definition: input } as Ability;
  assert.deepEqual(favoriteRollChoices(resolveTrackerEffects([ability], "Iron", {}), 1, input.id).map(entry => entry.targetLabels?.[0]), ["Ally", "Enemy"]);
});
