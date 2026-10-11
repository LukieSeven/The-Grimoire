import test from "node:test";
import assert from "node:assert/strict";
import { DURATION_TYPES, blankAbilityInput, blankResult, duplicateInput, inputFromAbility, validateAbilityInput } from "../src/lib/ability-input.ts";
import { resolveTrackerEffects, isEffectApplied } from "../src/lib/tracker.ts";
import { storage, importCharacterJSON } from "../src/lib/storage.ts";
import type { Ability } from "../src/lib/storage.ts";
import { mergeOptions, rangedDimensionKeys, rangedAreaSummary, normalizeAbilityInput } from "../src/lib/ability-input.ts";

test("ranged targeting retains custom definitions and only reads applicable dimensions", () => {
  const input = blankAbilityInput(); input.name = "Ranged test"; input.rangeType = "Ranged"; input.range = "80";
  input.rangedTargeting = "Point-Placed AoE"; input.areaShape = "Cylinder / Column";
  input.areaDimensions = { radius: "12", height: "20", targetCount: "4" };
  input.areaBehavior = { persistent: true, movable: true };
  input.options.areaShapes = ["Custom shape"]; input.options.rangedTargeting = ["Custom pattern"];
  assert.deepEqual(rangedDimensionKeys(input), ["radius", "height"]);
  assert.ok(rangedAreaSummary(input).includes("Persistent"));
  assert.ok(!rangedAreaSummary(input).includes("Targets:"));
  const restored = normalizeAbilityInput(JSON.parse(JSON.stringify(input)));
  assert.deepEqual(restored.areaDimensions, input.areaDimensions);
  assert.deepEqual(mergeOptions(restored.options).areaShapes, ["Custom shape"]);
  input.rangedTargeting = "Single Target";
  assert.equal(rangedAreaSummary(input), "Single Target");
  input.rangedTargeting = "Chain / Bounce"; input.areaDimensions.targetCount = "2.5";
  assert.ok(validateAbilityInput(input));
  input.areaDimensions.targetCount = "3";
  assert.equal(validateAbilityInput(input), undefined);
  input.rangeType = "Touch";
  assert.equal(rangedAreaSummary(input), "");
});

test("cones use Range without a duplicate Length field or readout", () => {
  const input = blankAbilityInput(); input.name = "Cone test";
  input.rangeType = "Ranged"; input.rangedTargeting = "Cone";
  input.range = "30"; input.areaDimensions = { length: "20" };
  assert.deepEqual(rangedDimensionKeys(input), []);
  assert.equal(rangedAreaSummary(input), "Cone");
  assert.equal(normalizeAbilityInput(input).range, "30");
  input.range = "";
  const recovered = normalizeAbilityInput(input);
  assert.equal(recovered.range, "20");
  assert.equal(recovered.areaDimensions?.length, "20");
});

test("older option files without new arrays still merge losslessly", () => {
  const old = { durationTypes: ["Saved duration"], rangeTypes: [], targets: [], rollPurposes: [], triggers: [], effects: [] };
  assert.deepEqual(mergeOptions(old).rangedTargeting, []);
  assert.deepEqual(mergeOptions(old).durationTypes, ["Saved duration"]);
});

// Synthetic test inputs, not shipped example characters or ability definitions.
function fixture() {
  const definition = blankAbilityInput(); definition.name = "Test ability";
  const ability = { id: 101, name: definition.name, definition, linkedStats: [], primaryStat: "", description: "Long reference must not enter tracker rules" } as unknown as Ability;
  return { ability, definition };
}
test("When Triggered activates and Until Triggered ends; activation checks work for every duration type", () => {
  assert.ok(DURATION_TYPES.includes("When Triggered"));
  assert.ok(DURATION_TYPES.includes("Until Triggered"));
  for (const durationType of ["Instant", "Time", "While Active", "When Triggered", "Until Triggered"]) {
    const { ability, definition } = fixture(); definition.durationType = durationType;
    definition.trigger.conditions = [{ id: "activate", kind: "resource", label: "", resource: "hp", operator: "below_percent", threshold: 50 }];
    definition.ending.conditions = [{ id: "end", kind: "resource", label: "", resource: "hp", operator: "below_percent", threshold: 25 }];
    const applications = [{ id: "activation", abilityId: ability.id, effectId: definition.id, targetId: "self", startedAt: "test" }];
    const entry = (confirmations: Record<string, boolean>) => resolveTrackerEffects([ability], "Iron", {}, { hp: confirmations.end ? 10 : confirmations.activate ? 40 : 60, maxHp: 100, mana: 0, maxMana: 0, dt: 0, maxDt: 0 })[0];
    assert.equal(isEffectApplied(entry({ activate: false, end: false }), "self", applications), false);
    assert.equal(isEffectApplied(entry({ activate: true, end: false }), "self", applications), true);
    assert.equal(isEffectApplied(entry({ activate: true, end: true }), "self", applications), false);
  }
});
test("free mana and optional results are valid; numeric costs cannot be negative", () => {
  const { definition } = fixture(); definition.targets = ["Enemy"];
  assert.equal(validateAbilityInput(definition), undefined);
  definition.manaPerTurn = -1; assert.match(validateAbilityInput(definition)!, /nonnegative/);
  definition.manaPerTurn = undefined; definition.timeCost = 18;
  assert.equal(validateAbilityInput(definition), undefined);
});
test("one always-on aura exposes ally and enemy results at one radius, with independent caster conditions", () => {
  const { ability, definition } = fixture(); definition.durationType = "Always On"; definition.rangeType = "Aura"; definition.range = "20";
  definition.targets = ["Self", "Ally", "Enemy"];
  definition.results = definition.targets.map(target => ({ ...blankResult(target), rules: `${target} rules` }));
  const caster = definition.results[0]; caster.trigger.conditions = [{ id: "resource", kind: "resource", label: "", resource: "hp", operator: "below_percent", threshold: 50 }];
  const entries = resolveTrackerEffects([ability], "Iron", {});
  assert.equal(entries.length, 4);
  assert.equal(isEffectApplied(entries[1], "self", []), false);
  assert.equal(isEffectApplied(entries[2], "self", []), true);
  assert.equal(isEffectApplied(entries[3], "self", []), true);
  assert.equal(isEffectApplied(entries[3], "enemy-one", []), false);
  assert.equal(entries[3].effect.tracking?.radius, 20);
  assert.equal(entries[3].effect.description, "Enemy rules");
  assert.ok(entries.every(entry => !entry.effect.description?.includes(ability.description)));
});
test("manual source activation governs its ongoing results; independent effects survive source ending", () => {
  const { ability, definition } = fixture(); definition.rangeType = "Aura"; definition.range = "10"; definition.durationType = "Time";
  definition.targets = ["Enemy"];
  const ongoing = blankResult("Enemy"); const independent = { ...blankResult("Enemy"), lifetime: "independent" as const };
  definition.results = [ongoing, independent];
  const entries = resolveTrackerEffects([ability], "Iron", {});
  const applications = [{ id: "activation", abilityId: ability.id, effectId: definition.id, targetId: "self", startedAt: "test" }, { id: "target", abilityId: ability.id, effectId: independent.id, targetId: "enemy", startedAt: "test" }];
  assert.equal(isEffectApplied(entries[1], "self", applications), true);
  assert.equal(isEffectApplied(entries[1], "self", applications.slice(1)), false);
  assert.equal(isEffectApplied(entries[2], "enemy", applications.slice(1)), true);
  definition.ending.conditions = [{ id: "end", kind: "resource", label: "", resource: "hp", operator: "full" }];
  const ended = resolveTrackerEffects([ability], "Iron", {}, { hp: 100, maxHp: 100, mana: 0, maxMana: 0, dt: 0, maxDt: 0 });
  assert.equal(isEffectApplied(ended[1], "self", applications), false);
  assert.equal(isEffectApplied(ended[2], "enemy", applications), true);
});
test("effect duration and ending conditions belong to the individual result", () => {
  const { ability, definition } = fixture(); definition.durationType = "Always On"; definition.targets = ["Self"];
  const first = { ...blankResult("Self"), durationType: "Time", duration: "12 seconds" }; const second = blankResult("Self");
  first.ending.conditions = [{ id: "end-one", kind: "resource", label: "", resource: "hp", operator: "full" }]; definition.results = [first, second];
  const entries = resolveTrackerEffects([ability], "Iron", {}, { hp: 100, maxHp: 100, mana: 0, maxMana: 0, dt: 0, maxDt: 0 });
  assert.equal(entries[1].effect.duration, "Time · 12 seconds");
  assert.equal(isEffectApplied(entries[1], "self", []), false);
  assert.equal(isEffectApplied(entries[2], "self", []), true);
});
test("Sub-Abilities have independent activation and duplicate all nested identifiers", () => {
  const { ability, definition } = fixture(); const sub = blankAbilityInput(); sub.name = "Alternate use"; sub.targets = ["Self"]; sub.results = [blankResult("Self")]; definition.subAbilities = [sub];
  const copied = duplicateInput(definition);
  assert.notEqual(copied.id, definition.id); assert.notEqual(copied.subAbilities[0].id, sub.id); assert.notEqual(copied.subAbilities[0].results[0].id, sub.results[0].id);
  const entries = resolveTrackerEffects([ability], "Iron", {});
  const applications = [{ id: "source", abilityId: ability.id, effectId: definition.id, targetId: "self", startedAt: "test" }];
  assert.equal(isEffectApplied(entries.find(entry => entry.effect.id === sub.results[0].id)!, "self", applications), false);
});
test("unchecking a target stops its results being exposed without deleting the saved input", () => {
  const { ability, definition } = fixture(); definition.results = [blankResult("Enemy")];
  assert.equal(resolveTrackerEffects([ability], "Iron", {}).length, 1);
  assert.equal(definition.results.length, 1);
});
test("legacy conversion preserves known costs, cooldowns, rolls, bonuses, descriptions and Sub-Abilities", () => {
  const legacy = { id: 55, name: "Old ability", description: "Full reference", cost: 8, cooldown: 90, range: "25ft", speed: "3 seconds", linkedStats: ["power"], rollFormula: "POW*2", bonusEndurance: "2", subAbilities: [{ id: "old-sub", name: "Old alternate", description: "Alternate reference", cost: 0, cooldown: 180, range: "Self", bonusSpirit: "SPI/2" }] } as Ability;
  const snapshot = structuredClone(legacy); const converted = inputFromAbility(legacy, "Existing source");
  assert.equal(converted.manaCost, 8); assert.equal(converted.cooldown, 90); assert.equal(converted.timeCost, 3); assert.equal(converted.range, "25");
  assert.equal(converted.description, legacy.description); assert.equal(converted.source, "Existing source");
  assert.ok(converted.results.some(result => result.formula === "POW*2")); assert.ok(converted.results.some(result => result.bonuses?.bonusEndurance === "2"));
  assert.equal(converted.subAbilities[0].id, "old-sub"); assert.equal(converted.subAbilities[0].cooldown, 180);
  assert.ok(converted.subAbilities[0].results.some(result => result.bonuses?.bonusSpirit === "SPI/2"));
  assert.deepEqual(legacy, snapshot);
});
test("component conversion retains all targets and independently created effects", () => {
  const legacy = { id: 56, name: "Old aura", description: "Long reference", cost: 0, range: "", linkedStats: [], components: [{ id: "old-part", name: "Aura", kinds: ["aura"], behaviors: ["always-on"], radius: 15, targets: ["allies", "enemies"], rules: "Shared actual rules", createdEffects: [{ id: "mark", name: "Mark", rules: "Own rules", targets: ["enemies"], delivery: "applied" }] }] } as Ability;
  const converted = inputFromAbility(legacy, "Existing source");
  assert.equal(converted.durationType, "Always On"); assert.equal(converted.range, "15");
  assert.deepEqual(converted.targets, ["Ally", "Enemy"]);
  assert.ok(converted.results.some(result => result.name === "Mark" && result.lifetime === "independent"));
});
test("file import preserves custom definitions, target results and Sub-Abilities", () => {
  const { ability, definition } = fixture(); definition.targets = ["Custom target"]; definition.results = [blankResult("Custom target")];
  definition.options.targets = ["Custom target"]; definition.options.durationTypes = ["Custom duration"];
  definition.subAbilities = [{ ...blankAbilityInput(), name: "Imported alternate" }];
  const loaded = importCharacterJSON(JSON.stringify({ character: { name: "Synthetic import", abilityOptions: definition.options, favorites: [{ type: "ability-result", targetId: ability.id, subId: definition.results[0].id, label: "Synthetic result" }] }, abilities: [ability] }));
  const imported = storage.getAbilities(loaded.id)[0];
  assert.deepEqual(imported.definition, definition); assert.deepEqual(loaded.abilityOptions, definition.options);
  assert.equal(loaded.favorites![0]!.targetId, imported.id);
});
test("Instant effect duration overrides a timed source without inheriting its time value", () => {
  const { ability, definition } = fixture(); definition.durationType = "Time"; definition.duration = "60 seconds"; definition.targets = ["Self"];
  definition.results = [{ ...blankResult("Self"), durationType: "Instant" }];
  assert.equal(resolveTrackerEffects([ability], "Iron", {})[1].effect.duration, "Instant");
});
test("uneditable legacy upgrades cannot override current form fields or inject text", () => {
  const { ability, definition } = fixture(); definition.linkedStats = ["power"]; definition.rangeType = "Aura"; definition.range = "10"; definition.targets = ["Self"];
  definition.results = [{ ...blankResult("Self"), formula: "POW" }];
  definition.upgrades = [{ id: "test-upgrade", rank: "Iron 2", rules: "Upgrade rules", range: "20", formula: "POW*2" }];
  const entries = resolveTrackerEffects([ability], "Bronze", { power: 12 });
  assert.equal(entries[1].effect.tracking?.radius, 10); assert.equal(entries[1].effect.rollFormula, "POW");
  assert.equal(entries[0].effect.description, "");
  assert.equal(definition.range, "10"); assert.equal(definition.results[0].formula, "POW");
});
