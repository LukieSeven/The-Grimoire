import test from "node:test";
import assert from "node:assert/strict";
import { TARGET_TYPES, DURATION_TYPES, blankAbilityInput, blankResult, selectSummon, activeInputEntries, flattenInputs, duplicateInput, inputFromAbility, normalizeAbilityInput, validateAbilityInput, mergeOptions } from "../src/lib/ability-input.ts";
import { resolveTrackerEffects } from "../src/lib/tracker.ts";
import { importCharacterJSON, storage } from "../src/lib/storage.ts";
import type { Ability, Familiar } from "../src/lib/storage.ts";

// Synthetic regression data only; no minion or character examples are seeded into the app.
function minion(id: string): Familiar {
  return { id, name: `Test minion ${id}`, className: "", race: "", level: 1, speed: 20,
    power: 6, vitality: 8, spirit: 7, agility: 4, endurance: 5, precision: 9, willpower: 3, charisma: 2,
    currentHp: 12, currentMana: 14, currentDt: 5, dtBonus: 0,
    hpFormula: "VIT*3", manaFormula: "SPI*4", dtFormula: "END", speedFormula: "AGI*5",
    abilities: [{ id: 10, name: "Test minion attack", description: "Full minion reference", cost: 2, cooldown: 12, range: "10ft", speed: "3 seconds", rollFormula: "POW*2", linkedStats: ["power"], assignedToQuickRolls: false,
      subAbilities: [{ id: "nested-source", name: "Nested minion use", cost: 1, rollFormula: "SPI" }] }] };
}
function summoningAbility(familiar = minion("one")) {
  const input = blankAbilityInput(); input.name = "Test summoning ability"; input.targets = ["Self", "Summon"]; input.results = [blankResult("Self")];
  return selectSummon(input, familiar);
}
test("Summon is a built-in target and While Active replaces Concentration", () => {
  assert.deepEqual(TARGET_TYPES, ["Self", "Ally", "Enemy", "Summon", "Object", "Location"]);
  assert.ok(DURATION_TYPES.includes("While Active")); assert.ok(!DURATION_TYPES.includes("Concentration"));
});
test("selecting a recorded minion imports its existing abilities without modifying the source", () => {
  const source = minion("one"), before = structuredClone(source), input = summoningAbility(source);
  assert.equal(input.summon!.familiar.id, source.id);
  const imported = input.summon!.abilities[0];
  assert.equal(imported.name, source.abilities[0].name); assert.equal(imported.manaCost, 2); assert.equal(imported.cooldown, 12);
  assert.equal(imported.description, source.abilities[0].description);
  assert.equal(imported.results[0].formula, "POW*2");
  assert.equal(imported.subAbilities[0].name, "Nested minion use"); assert.notEqual(imported.subAbilities[0].id, "nested-source");
  imported.results[0].formula = "Modified copy";
  assert.deepEqual(source, before);
});
test("switching or clearing a summon preserves manually entered Sub-Abilities and other target results", () => {
  const input = summoningAbility(); const manual = blankAbilityInput(); manual.name = "Manual alternate"; input.subAbilities = [manual];
  const replaced = selectSummon(input, minion("two"));
  assert.equal(replaced.summon!.familiar.id, "two"); assert.equal(replaced.subAbilities[0], manual); assert.equal(replaced.results[0], input.results[0]);
  const cleared = selectSummon(replaced);
  assert.equal(cleared.summon, undefined); assert.equal(cleared.subAbilities[0], manual); assert.equal(cleared.results[0], input.results[0]);
});
test("unchecking Summon disables imported references without deleting their saved inputs", () => {
  const input = summoningAbility();
  input.targets = ["Self"];
  assert.equal(activeInputEntries(input).length, 1);
  assert.equal(flattenInputs(input).length, 3);
  assert.equal(input.summon!.abilities.length, 1);
});
test("summon duplication creates fresh identifiers for all imported nodes and retains the minion link", () => {
  const input = summoningAbility(), copy = duplicateInput(input);
  assert.equal(copy.summon!.familiar.id, input.summon!.familiar.id);
  const originals = new Set(flattenInputs(input).flatMap(node => [node.id, ...node.results.map(result => result.id)]));
  assert.ok(flattenInputs(copy).every(node => !originals.has(node.id) && node.results.every(result => !originals.has(result.id))));
});
test("imported minion requirements use its live resources rather than the caster or stale snapshot", () => {
  const source = minion("one"), input = summoningAbility(source);
  const attack = input.summon!.abilities[0];
  attack.trigger.conditions = [{ id: "minion-mana", kind: "resource", label: "", resource: "mana", operator: "below_value", threshold: 5 }];
  const ability = { id: 100, name: input.name, definition: input, linkedStats: [] } as unknown as Ability;
  const caster = { hp: 1, maxHp: 100, mana: 1, maxMana: 100, dt: 1, maxDt: 100 };
  const snapshot = resolveTrackerEffects([ability], "Iron", { power: 99 }, caster).find(entry => entry.effect.id === attack.id)!;
  assert.equal(snapshot.requirements, "unmet"); assert.equal(snapshot.familiar!.power, 6);
  const live = { ...source, currentMana: 3, power: 8 };
  const current = resolveTrackerEffects([ability], "Iron", { power: 99 }, caster, {}, [live]).find(entry => entry.effect.id === attack.id)!;
  assert.equal(current.requirements, "met"); assert.equal(current.familiar!.power, 8);
});
test("duration migration updates ability, effect and nested summon inputs without mutating saved data", () => {
  const input = summoningAbility(); input.durationType = "Concentration"; input.results[0].durationType = "Concentration";
  input.summon!.abilities[0].durationType = "Concentration"; input.options.durationTypes = ["Concentration", "Custom duration"];
  const normalized = normalizeAbilityInput(input);
  assert.equal(normalized.durationType, "While Active"); assert.equal(normalized.results[0].durationType, "While Active");
  assert.equal(normalized.summon!.abilities[0].durationType, "While Active");
  assert.deepEqual(normalized.options.durationTypes, ["While Active", "Custom duration"]);
  assert.equal(input.durationType, "Concentration");
  const ability = { id: 100, definition: input } as Ability;
  assert.equal(inputFromAbility(ability, "").durationType, "While Active");
  assert.deepEqual(mergeOptions(input.options).durationTypes, ["While Active", "Custom duration"]);
});
test("Summon requires a selected minion, but an existing minion with no abilities is valid", () => {
  const input = blankAbilityInput(); input.name = "Test summon"; input.targets = ["Summon"];
  assert.match(validateAbilityInput(input)!, /Choose a recorded minion/);
  const source = minion("empty"); source.abilities = [];
  assert.equal(validateAbilityInput(selectSummon(input, source)), undefined);
});
test("character files retain the minion link and imported abilities after reload", () => {
  const source = minion("one"), input = summoningAbility(source);
  const imported = importCharacterJSON(JSON.stringify({ character: { name: "Synthetic summoner", familiars: [source] }, abilities: [{ id: 100, name: input.name, definition: input }] }));
  const ability = storage.getAbilities(imported.id)[0];
  assert.deepEqual(ability.definition!.summon, JSON.parse(JSON.stringify(input.summon)));
  assert.equal(activeInputEntries(ability.definition!, imported.familiars)[1].familiar!.id, source.id);
});
