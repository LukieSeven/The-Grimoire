import test from "node:test";
import assert from "node:assert/strict";
import { blankAbilityInput, blankResult, normalizeAbilityInput } from "../src/lib/ability-input.ts";
import { attachedEffects, saveReference } from "../src/lib/effect-details.ts";
import { resolveTrackerEffects, isEffectApplied } from "../src/lib/tracker.ts";
import { getAdjustedStats } from "../src/lib/storage.ts";
import type { Ability, Character } from "../src/lib/storage.ts";
import { groupAbilityTriggers } from "../src/lib/trigger-groups.ts";
import { applyPresetEffect, presetEffect } from "../src/lib/preset-effect.ts";

test("attached bonuses remain additive and independent of selection order", () => {
  const actor = { rank: "Iron", power: 8, vitality: 8, spirit: 8, agility: 8, endurance: 8, precision: 8, willpower: 8, charisma: 8, currentHp: 20, currentMana: 20, currentDt: 8, hpFormula: "VIT*8", manaFormula: "SPI*5", dtFormula: "END", speedFormula: "AGI*5" } as Character;
  const definition = blankAbilityInput(); definition.durationType = "Always On"; definition.targets = ["Self"];
  definition.results = [{ ...blankResult("Self"), bonuses: { dtBuff: 2 }, effects: [{ templateId: "a", outcome: "always" }, { templateId: "b", outcome: "always" }] }];
  definition.options.effects = [3, 4].map((bonus, index) => { const effect = blankAbilityInput(); effect.targets = ["Self"]; effect.results = [{ ...blankResult("Self"), bonuses: { dtBuff: bonus } }]; return { id: index ? "b" : "a", name: "Effect", kind: "Buff" as const, rules: "", definition: effect }; });
  const source = { id: 1, definition, linkedStats: [] } as Ability;
  assert.equal(getAdjustedStats(actor, [], [source]).maxDt, 17);
  definition.results[0].effects!.reverse();
  assert.equal(getAdjustedStats(actor, [], [source]).maxDt, 17);
});

test("direct combat effects refresh without duplicates and respect max stacks", () => {
  const definition = blankAbilityInput(); definition.targets = ["Enemy"]; definition.durationType = "Until Combat Ends";
  definition.results = [{ ...blankResult("Enemy"), stacking: "Stack", maxStacks: 2 }];
  definition.options.effects = [{ id: "a", name: "Effect", kind: "Debuff", rules: "", definition }];
  // Keep the saved template acyclic, as it would be in the editor.
  const options = { ...definition.options }; definition.options = blankAbilityInput().options;
  const incoming = presetEffect("a", "enemy", options)!;
  let applied = applyPresetEffect([], incoming);
  applied = applyPresetEffect(applied, incoming); applied = applyPresetEffect(applied, incoming);
  assert.equal(applied.length, 1); assert.equal(applied[0].stacks, 2);
  assert.equal(applied[0].duration, "Until Combat Ends");
});

test("legacy single effects remain attached and retain their original result ID", () => {
  const definition = blankAbilityInput(); definition.name = "Test"; definition.targets = ["Enemy"];
  const result = blankResult("Enemy"); result.templateId = "common:Prone"; definition.results = [result];
  assert.deepEqual(attachedEffects(result), [{ templateId: "common:Prone", outcome: "always" }]);
  const entries = resolveTrackerEffects([{ id: 1, definition } as Ability], "Iron", {});
  assert.equal(entries[1].effect.id, result.id); assert.equal(entries[1].result?.templateId, "common:Prone");
});

test("multiple effects retain individual outcomes without duplicating the ability formula", () => {
  const definition = blankAbilityInput(); definition.name = "Test"; definition.targets = ["Enemy"];
  const result = blankResult("Enemy"); result.formula = "POW*2";
  result.effects = [{ templateId: "common:Prone", outcome: "always" }, { templateId: "common:Stunned", outcome: "failed-save" }, { templateId: "common:Slowed", outcome: "success" }];
  result.enemySavingThrow = "Endurance"; result.saveFormula = "WIL + POWr"; definition.results = [result];
  const source = { id: 1, definition } as Ability;
  const entries = resolveTrackerEffects([source], "Iron", { power: 8 });
  assert.equal(entries.filter(entry => entry.result).length, 4);
  assert.equal(entries.filter(entry => entry.effect.rollFormula).length, 1);
  assert.equal(entries[1].effect.id, result.id);
  assert.ok(entries.some(entry => entry.result?.effectOutcome === "failed-save"));
  assert.ok(saveReference(entries[2].result!).includes("WIL + POWr"));
  const restored = normalizeAbilityInput(JSON.parse(JSON.stringify(definition)));
  assert.deepEqual(restored.results[0].effects, result.effects);
  assert.equal(restored.results[0].saveFormula, result.saveFormula);
  assert.ok(groupAbilityTriggers(entries, [source]).some(group => group.name === "Failing a Resistance Roll"));
});

test("save reference text is never evaluated and conditional Self bonuses do not activate automatically", () => {
  const actor = { id: 1, rank: "Iron", power: 8, vitality: 8, spirit: 8, agility: 8, endurance: 8, precision: 8, willpower: 8, charisma: 8, currentHp: 20, currentMana: 20, currentDt: 8, hpFormula: "VIT*8", manaFormula: "SPI*5", dtFormula: "END", speedFormula: "AGI*5" } as Character;
  const definition = blankAbilityInput(); definition.name = "Test"; definition.durationType = "Always On"; definition.targets = ["Self"];
  const custom = blankAbilityInput(); custom.name = "Conditional"; custom.targets = ["Self"]; custom.results = [{ ...blankResult("Self"), bonuses: { dtBuff: 9 } }];
  definition.options.effects = [{ id: "conditional", name: custom.name, kind: "Buff", rules: "", definition: custom }];
  definition.results = [{ ...blankResult("Self"), effects: [{ templateId: "conditional", outcome: "failed-save" }], enemySavingThrow: "Endurance", saveFormula: "reference text, not an executable formula" }];
  definition.results[0].trigger = { mode: "automatic", match: "all", conditions: [{ id: "low-hp", kind: "resource", resource: "hp", operator: "below_percent", threshold: 50 }] };
  const source = { id: 1, definition, linkedStats: [] } as Ability;
  const entries = resolveTrackerEffects([source], "Iron", actor);
  assert.equal(isEffectApplied(entries.find(entry => entry.result?.attachedEffectOnly)!, "self", []), false);
  assert.equal(getAdjustedStats(actor, [], [source]).maxDt, 8);
});
