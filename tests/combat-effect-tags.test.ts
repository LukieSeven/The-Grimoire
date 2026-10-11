import test from "node:test";
import assert from "node:assert/strict";
import { combatEffectName } from "../src/lib/combat-effect-tags.ts";
import { blankAbilityInput, blankResult } from "../src/lib/ability-input.ts";
import { resolveTrackerEffects } from "../src/lib/tracker.ts";
import { importCharacterJSON, storage } from "../src/lib/storage.ts";
import type { Ability } from "../src/lib/storage.ts";
test("an aura origin or target description is not an assignable named effect", () => {
  const input = blankAbilityInput(); input.name = "Test aura"; input.rangeType = "Aura"; input.range = "10"; input.targets = ["Enemy"];
  input.results = [{ ...blankResult("Enemy"), name: input.name, rules: "Long descriptive text containing a status name is not parsed." }];
  const ability = { id: 1, name: input.name, definition: input } as Ability;
  assert.ok(resolveTrackerEffects([ability], "Iron", {}).every(entry => combatEffectName(entry) === undefined));
});
test("actual named effects retain status tags while roll and ability titles remain the ability name", () => {
  const input = blankAbilityInput(); input.name = "Test source"; input.targets = ["Enemy"];
  input.results = [{ ...blankResult("Enemy"), name: "Test applied status", lifetime: "independent", rules: "Actual status rules" }];
  const ability = { id: 1, name: input.name, definition: input } as Ability;
  const entry = resolveTrackerEffects([ability], "Iron", {})[1];
  assert.equal(combatEffectName(entry), "Test applied status"); assert.equal(entry.effect.name, input.name);
});
test("manual status links are remapped when character files are imported", () => {
  const loaded = importCharacterJSON(JSON.stringify({ character: { name: "Synthetic status import", manualTrackedEffects: [{ id: "status", targetId: "combatant", name: "Test applied status", rules: "", active: true, abilityId: 99 }] }, abilities: [{ id: 99, name: "Test source" }] }));
  assert.equal(loaded.manualTrackedEffects![0].abilityId, storage.getAbilities(loaded.id)[0].id);
});
