import test from "node:test";
import assert from "node:assert/strict";
import { blankAbilityInput, blankResult, TARGET_TYPES, DURATION_TYPES } from "../src/lib/ability-input.ts";
import { resolveTrackerEffects } from "../src/lib/tracker.ts";
import { getAdjustedStats, storage } from "../src/lib/storage.ts";
import type { Ability, Character } from "../src/lib/storage.ts";
import { applyTrackedEffect, expireEffectApplications } from "../src/lib/effect-stacking.ts";
import { spendTemporary } from "../src/lib/temporary-resources.ts";
import { activeEffectModifier } from "../src/lib/active-effect-modifiers.ts";

const actor = { id: 1, name: "Test-only actor", rank: "Iron", power: 8, vitality: 8, spirit: 8, agility: 8, endurance: 8, precision: 8, willpower: 8, charisma: 8, currentHp: 20, currentMana: 20, currentDt: 8, hpFormula: "VIT*8", manaFormula: "SPI*5", dtFormula: "END", speedFormula: "AGI*5" } as Character;
function ability(id = 1) { const definition = blankAbilityInput(); definition.name = "Test effect source"; definition.durationType = "Always On"; definition.targets = ["Self"]; definition.results = [blankResult("Self")]; return { id, name: definition.name, definition, cost: 0, linkedStats: [] } as Ability; }

test("temporary resources are spent before regular resources, including at zero", () => {
  const previous = { currentHp: 0, currentMana: 10, currentDt: 2, tempHp: 8, tempMana: 5, tempDt: 3 };
  const spent = spendTemporary(previous, { currentHp: -3, currentMana: 3, currentDt: 1 });
  assert.equal(spent.currentHp, 0); assert.equal(spent.tempHp, 5);
  assert.equal(spent.currentMana, 8); assert.equal(spent.tempMana, 0);
  assert.equal(spent.currentDt, 2); assert.equal(spent.tempDt, 2);
  assert.equal(previous.tempHp, 8);
});

test("temporary mana payments persist separately without changing maximums", () => {
  const owner = storage.createCharacter({ ...actor, tempMana: 6 });
  const saved = storage.addAbility({ ...ability(), characterId: owner.id });
  const paid = storage.useAbility(owner.id, saved.id, { currentMana: owner.currentMana - 4 });
  assert.equal(paid.currentMana, owner.currentMana); assert.equal(paid.tempMana, 2);
  assert.equal(getAdjustedStats(paid, [], [saved]).maxMana, 40);
  assert.equal(storage.longRestCharacter(owner.id).tempMana, 0);
});

test("structured custom Effects contribute actual bonuses and formulas", () => {
  const source = ability();
  const effect = blankAbilityInput(); effect.name = "Test custom Effect"; effect.targets = ["Self"];
  effect.results = [{ ...blankResult("Self"), bonuses: { dtBuff: 3, bonusMovement: 5 }, formula: "END+2" }];
  source.definition!.options.effects = [{ id: "custom", name: effect.name, kind: "Buff", rules: "", definition: effect }];
  source.definition!.results[0].templateId = "custom";
  assert.equal(getAdjustedStats(actor, [], [source]).maxDt, 11);
  assert.equal(getAdjustedStats(actor, [], [source]).speed, 45);
  assert.equal(resolveTrackerEffects([source], actor.rank, actor)[1].effect.rollFormula, "END+2");
});

test("stacked self bonuses respect Max Stacks and highest-only effects do not combine", () => {
  const source = ability(); const result = source.definition!.results[0]; result.bonuses = { dtBuff: 2 }; result.stacking = "Stack"; result.maxStacks = 3;
  const entry = resolveTrackerEffects([source], actor.rank, actor)[1];
  let applications = applyTrackedEffect([], entry, "self");
  applications = applyTrackedEffect(applications, entry, "self"); applications = applyTrackedEffect(applications, entry, "self");
  assert.equal(applications[0].stacks, 3);
  assert.equal(getAdjustedStats({ ...actor, effectApplications: applications }, [], [source]).maxDt, 14);
  const other = ability(2); result.templateId = "shared"; result.stacking = "Highest Only"; other.definition!.results[0].templateId = "shared"; other.definition!.results[0].bonuses = { dtBuff: 5 };
  assert.equal(getAdjustedStats(actor, [], [source, other]).maxDt, 13);
});

test("resistance roll bonuses respect attribute scope and disappear with their source", () => {
  const source = ability(); source.definition!.results[0].bonuses = { bonusResistanceRoll: 2, resistanceAttributes: ["endurance"] };
  assert.equal(activeEffectModifier(actor, [source], [], "bonusResistanceRoll", "endurance"), 2);
  assert.equal(activeEffectModifier(actor, [source], [], "bonusResistanceRoll", "willpower"), 0);
  assert.equal(activeEffectModifier(actor, [], [], "bonusResistanceRoll", "endurance"), 0);
});

test("approved targets and lifetimes are present and expiration leaves unrelated effects alone", () => {
  assert.ok(TARGET_TYPES.includes("Object")); assert.ok(TARGET_TYPES.includes("Location"));
  for (const duration of ["Until Next Turn", "Until Used", "Until Combat Ends", "Until Rest"]) assert.ok(DURATION_TYPES.includes(duration));
  const applications = ["Until Next Turn", "Until Combat Ends", "While Active"].map((duration, index) => ({ id: String(index), abilityId: 1, effectId: "effect", targetId: "self", startedAt: "test", duration }));
  assert.deepEqual(expireEffectApplications(applications, "turn").map(entry => entry.duration), ["Until Combat Ends", "While Active"]);
});

test("Replace Existing replaces a named combat effect without dropping unrelated effects", () => {
  const first = ability(20), second = ability(21);
  for (const source of [first, second]) { source.definition!.targets = ["Enemy"]; source.definition!.results[0].target = "Enemy"; source.definition!.results[0].lifetime = "independent"; source.definition!.results[0].templateId = "common:Slowed"; source.definition!.results[0].stacking = "Replace Existing"; }
  const firstEntry = resolveTrackerEffects([first], actor.rank, actor)[1], secondEntry = resolveTrackerEffects([second], actor.rank, actor)[1];
  const applied = applyTrackedEffect([], firstEntry, "target");
  const unrelated = { id: "other", abilityId: 99, effectId: "other", targetId: "target", startedAt: "test" };
  const replaced = applyTrackedEffect([...applied, unrelated], secondEntry, "target");
  assert.equal(replaced.length, 2);
  assert.ok(replaced.some(entry => entry.abilityId === second.id));
  assert.ok(!replaced.some(entry => entry.abilityId === first.id));
  assert.ok(replaced.some(entry => entry.id === "other"));
});
