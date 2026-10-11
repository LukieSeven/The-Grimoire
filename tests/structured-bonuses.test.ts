import test from "node:test";
import assert from "node:assert/strict";
import { blankAbilityInput, blankResult, normalizeAbilityInput } from "../src/lib/ability-input.ts";
import { getAdjustedStats, storage, exportCharacterJSON, importCharacterJSON } from "../src/lib/storage.ts";
import type { Ability, Character } from "../src/lib/storage.ts";
import { resolveTrackerEffects, isEffectApplied } from "../src/lib/tracker.ts";
import { emptyRequirements } from "../src/lib/ability-input.ts";

// Test-only fixtures; no application example data.
const character = { id: 1, rank: "Iron", power: 10, vitality: 10, spirit: 10, agility: 10, endurance: 10, precision: 10, willpower: 10, charisma: 10, currentHp: 40, currentMana: 40, currentDt: 10, hpFormula: "Vitality*8", manaFormula: "Spirit*5", dtFormula: "Endurance", initiativeFormula: "Agility", dtBonus: 0 } as Character;
function fixture() {
  const definition = blankAbilityInput(); definition.name = "Test"; definition.durationType = "Always On"; definition.targets = ["Self", "Ally", "Enemy"];
  definition.results = [blankResult("Self"), blankResult("Ally"), blankResult("Enemy")];
  return { definition, ability: { id: 1, name: "Test", definition, linkedStats: [], description: "", cost: 0 } as Ability };
}
test("structured Self bonuses affect live stats, resources and initiative without stacking other targets", () => {
  const { definition, ability } = fixture();
  definition.results[0].bonuses = { bonusPower: "-2", manaBuff: "SPI/2", dtBuff: -3, bonusInitiative: "-1" };
  definition.results[1].bonuses = { bonusPower: 100, manaBuff: 100 };
  definition.results[2].bonuses = { manaBuff: -100 };
  const adjusted = getAdjustedStats(character, [], [ability]);
  assert.equal(adjusted.stats.power, 8); assert.equal(adjusted.abilityManaBonus, 5); assert.equal(adjusted.abilityDtBonus, -3); assert.equal(adjusted.abilityInitiativeBonus, -1);
});
test("every target retains signed formulas and gets an evaluated readout", () => {
  const { definition, ability } = fixture();
  for (const result of definition.results) result.bonuses = { bonusEndurance: "-END/2", immunities: "Test condition" };
  const entries = resolveTrackerEffects([ability], "Iron", { endurance: 10 });
  for (const target of definition.targets) assert.ok(entries.find(entry => entry.result?.target === target)?.effect.description?.includes("Endurance: -5"));
  assert.equal(definition.results[2].bonuses?.bonusEndurance, "-END/2");
});
test("generated legacy summaries restore editable fields without treating prose as mechanics", () => {
  const { definition } = fixture();
  definition.results[0].rules = "bonusMana: 10\nbonusDt: -4\nimmunities: Test condition";
  definition.results[1].rules = "Gain a bonusMana: 10 when permitted.";
  const restored = normalizeAbilityInput(definition);
  assert.equal(restored.results[0].bonuses?.manaBuff, "10"); assert.equal(restored.results[0].bonuses?.dtBuff, "-4"); assert.equal(restored.results[0].rules, "");
  assert.equal(restored.results[1].bonuses, undefined); assert.equal(definition.results[0].bonuses, undefined);
});
test("removing or editing a stored ability source reconciles its resource contribution", () => {
  const owner = storage.createCharacter({ ...character, name: "Test-only source owner" });
  const { ability, definition } = fixture();
  definition.results[0].bonuses = { manaBuff: 10, dtBuff: -3 };
  const saved = storage.addAbility({ ...ability, characterId: owner.id });
  storage.updateCharacter(owner.id, { currentMana: 50, currentDt: 7 });
  storage.updateAbility(saved.id, { definition: { ...definition, results: definition.results.map(result => ({ ...result, bonuses: {} })) } });
  assert.equal(storage.getCharacter(owner.id)!.currentMana, 40);
  assert.equal(storage.getCharacter(owner.id)!.currentDt, 10);
  storage.updateAbility(saved.id, { definition });
  assert.equal(storage.getCharacter(owner.id)!.currentMana, 50);
  storage.deleteAbility(saved.id);
  assert.equal(storage.getCharacter(owner.id)!.currentMana, 40);
  assert.equal(storage.getCharacter(owner.id)!.currentDt, 10);
});
test("When Triggered automatically applies only while its parent is active and its condition matches", () => {
  const { definition, ability } = fixture(); definition.durationType = "While Active";
  const child = blankAbilityInput(); child.name = "Conditional bonus"; child.durationType = "When Triggered"; child.targets = ["Self"];
  child.durationTrigger = { ...emptyRequirements(), conditions: [{ id: "low-hp", kind: "resource", label: "", resource: "hp", operator: "below_percent", threshold: 50 }] };
  child.results = [{ ...blankResult("Self"), bonuses: { dtBuff: 2 } }]; definition.subAbilities = [child];
  const applications = [{ id: "parent-on", abilityId: ability.id, effectId: definition.id, targetId: "self", startedAt: "test" }];
  const context = { hp: 20, maxHp: 80, mana: 40, maxMana: 50, dt: 10, maxDt: 10 };
  const resolve = (hp: number) => resolveTrackerEffects([ability], "Iron", { endurance: 10 }, { ...context, hp }).find(entry => entry.result?.id === child.results[0].id)!;
  assert.equal(isEffectApplied(resolve(20), "self", []), false);
  assert.equal(isEffectApplied(resolve(20), "self", applications), true);
  assert.equal(isEffectApplied(resolve(60), "self", applications), false);
});
test("activate, damage, trigger, recover, deactivate and rest keep resource state consistent", () => {
  const owner = storage.createCharacter({ ...character, name: "Test-only lifecycle", currentHp: 80, currentMana: 50 });
  const { definition, ability } = fixture(); definition.durationType = "While Active";
  definition.results[0].bonuses = { hpBuff: 20, manaBuff: 10 };
  const child = blankAbilityInput(); child.name = "Conditional DT"; child.durationType = "When Triggered"; child.targets = ["Self"];
  child.durationTrigger = { ...emptyRequirements(), conditions: [{ id: "half-health", kind: "resource", label: "", resource: "hp", operator: "below_percent", threshold: 50 }] };
  child.results = [{ ...blankResult("Self"), bonuses: { dtBuff: 2 } }]; definition.subAbilities = [child];
  const saved = storage.addAbility({ ...ability, characterId: owner.id });
  const applications = [{ id: "on", abilityId: saved.id, effectId: definition.id, targetId: "self", startedAt: "test" }];
  let state = storage.updateCharacter(owner.id, { effectApplications: applications, currentMana: 50 });
  assert.equal(state.currentHp, 100); assert.equal(state.currentMana, 60);
  state = storage.updateCharacter(owner.id, { currentHp: 45 }); // Below half of adjusted 100, but not base 80.
  let adjusted = getAdjustedStats(state, [], [saved]);
  assert.equal(adjusted.totalMaxHp, 100); assert.equal(adjusted.totalMaxDt, 12); assert.equal(state.currentDt, 12);
  const result = resolveTrackerEffects([saved], state.rank, adjusted.stats, { hp: state.currentHp, maxHp: adjusted.totalMaxHp, mana: state.currentMana, maxMana: adjusted.totalMaxMana, dt: state.currentDt, maxDt: adjusted.totalMaxDt }).find(entry => entry.result?.id === child.results[0].id)!;
  assert.equal(isEffectApplied(result, "self", applications), true);
  state = storage.updateCharacter(owner.id, { currentHp: 75, currentMana: 52 });
  assert.equal(state.currentDt, 10); assert.equal(state.currentMana, 52);
  state = storage.updateCharacter(owner.id, { effectApplications: [] });
  assert.equal(state.currentHp, 55); assert.equal(state.currentMana, 42);
  adjusted = getAdjustedStats(state, [], [saved]);
  state = storage.updateCharacter(owner.id, { effectApplications: [], triggerConfirmations: {}, currentHp: adjusted.totalMaxHp, currentMana: adjusted.totalMaxMana, currentDt: adjusted.totalMaxDt }, "exact");
  assert.equal(state.currentHp, 80); assert.equal(state.currentMana, 50); assert.equal(state.currentDt, 10);
});
test("Long Rest atomically resets ability records, activation state and resources with history", () => {
  const owner = storage.createCharacter({ ...character, name: "Test-only rest", currentHp: 5, currentMana: 3, currentDt: 1, abilityTiming: { test: { spent: "5" } }, triggerConfirmations: { test: true } });
  const { definition, ability } = fixture(); definition.durationType = "While Active"; definition.results[0].bonuses = { manaBuff: 10 };
  const saved = storage.addAbility({ ...ability, characterId: owner.id, active: true, usageType: "rechargeable", maxCharges: 3, currentCharges: 0 });
  storage.updateCharacter(owner.id, { effectApplications: [{ id: "on", abilityId: saved.id, effectId: definition.id, targetId: "self", startedAt: "test" }] });
  const rested = storage.longRestCharacter(owner.id);
  assert.deepEqual(rested.effectApplications, []); assert.deepEqual(rested.triggerConfirmations, {}); assert.deepEqual(rested.abilityTiming, {});
  assert.equal(rested.currentHp, 80); assert.equal(rested.currentMana, 50); assert.equal(rested.currentDt, 10);
  assert.equal(storage.getAbilities(owner.id)[0].active, false); assert.equal(storage.getAbilities(owner.id)[0].currentCharges, 3);
  assert.equal(storage.getRolls(owner.id).filter(roll => roll.label?.startsWith("Long Rest")).length, 4);
});
test("circular resource thresholds produce an explicit warning", () => {
  const { definition, ability } = fixture(); definition.durationType = "While Active";
  const child = blankAbilityInput(); child.name = "Circular test"; child.durationType = "When Triggered"; child.targets = ["Self"];
  child.durationTrigger = { ...emptyRequirements(), conditions: [{ id: "circle", kind: "resource", label: "", resource: "hp", operator: "below_percent", threshold: 50 }] };
  child.results = [{ ...blankResult("Self"), bonuses: { hpBuff: -20 } }]; definition.subAbilities = [child];
  const adjusted = getAdjustedStats({ ...character, currentHp: 35, effectApplications: [{ id: "on", abilityId: ability.id, effectId: definition.id, targetId: "self", startedAt: "test" }] }, [], [ability]);
  assert.match(adjusted.warnings[0], /circular threshold/);
});
test("the actual character export and import retain structured fields and activation links", async () => {
  const owner = storage.createCharacter({ ...character, name: "Test-only roundtrip" });
  const { definition, ability } = fixture(); definition.durationType = "While Active";
  definition.results[0].bonuses = { manaBuff: "SPI/2", bonusEndurance: -2, immunities: "Test condition" };
  const saved = storage.addAbility({ ...ability, characterId: owner.id });
  storage.updateCharacter(owner.id, { effectApplications: [{ id: "on", abilityId: saved.id, effectId: definition.id, targetId: "self", startedAt: "test" }] });
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const createURL = URL.createObjectURL; const revokeURL = URL.revokeObjectURL; let blob: Blob | undefined;
  try {
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } } });
    URL.createObjectURL = value => { blob = value as Blob; return "blob:test-only"; }; URL.revokeObjectURL = () => {};
    exportCharacterJSON(owner.id);
    assert.ok(blob);
    const imported = importCharacterJSON(await blob.text());
    const importedAbility = storage.getAbilities(imported.id)[0];
    assert.deepEqual(importedAbility.definition?.results[0].bonuses, definition.results[0].bonuses);
    assert.equal(imported.effectApplications?.[0].abilityId, importedAbility.id);
    assert.equal(imported.effectApplications?.[0].effectId, definition.id);
  } finally {
    URL.createObjectURL = createURL; URL.revokeObjectURL = revokeURL;
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument); else Reflect.deleteProperty(globalThis, "document");
  }
});
