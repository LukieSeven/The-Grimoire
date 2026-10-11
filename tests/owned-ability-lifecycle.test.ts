import test from "node:test";
import assert from "node:assert/strict";
import { storage } from "../src/lib/storage.ts";
import type { Ability, Character, Familiar, InventoryItem } from "../src/lib/storage.ts";
import { blankAbilityInput, blankResult } from "../src/lib/ability-input.ts";
import { restedFamiliar, getFamiliarAdjusted } from "../src/lib/familiar-values.ts";

const actor = { rank: "Iron", name: "Test owner", power: 8, vitality: 8, spirit: 8, agility: 8, endurance: 8, precision: 8, willpower: 8, charisma: 8, currentHp: 30, currentMana: 30, currentDt: 8, hpFormula: "VIT*8", manaFormula: "SPI*5", dtFormula: "END", speedFormula: "AGI*5" } as Character;
function source() { const definition = blankAbilityInput(); definition.name = "Test ability"; return { name: definition.name, definition, cost: 0, linkedStats: [], description: "" } as Ability; }

test("new-definition item uses spend charges and reject empty uses without changing mana", () => {
  const owner = storage.createCharacter(actor);
  const ability = storage.addAbility({ ...source(), characterId: owner.id, usageType: "rechargeable", maxCharges: 1, currentCharges: 1 });
  storage.useAbility(owner.id, ability.id, { currentMana: 25 });
  assert.equal(storage.getAbilities(owner.id).find(entry => entry.id === ability.id)!.currentCharges, 0);
  assert.throws(() => storage.useAbility(owner.id, ability.id, { currentMana: 20 }), /no charges/);
  assert.equal(storage.getCharacter(owner.id)!.currentMana, 25);
});

test("new-definition consumables reduce quantity and remove only their sources on the last use", () => {
  const owner = storage.createCharacter(actor);
  const item = storage.addInventoryItem({ characterId: owner.id, name: "Test consumable", quantity: 2 } as InventoryItem);
  const ability = storage.addAbility({ ...source(), characterId: owner.id, inventoryItemId: item.id, usageType: "one-time" });
  const independent = storage.addAbility({ ...source(), characterId: owner.id });
  storage.useAbility(owner.id, ability.id, {});
  assert.equal(storage.getInventory(owner.id).find(entry => entry.id === item.id)!.quantity, 1);
  storage.useAbility(owner.id, ability.id, {});
  assert.ok(!storage.getInventory(owner.id).some(entry => entry.id === item.id));
  assert.ok(!storage.getAbilities(owner.id).some(entry => entry.id === ability.id));
  assert.ok(storage.getAbilities(owner.id).some(entry => entry.id === independent.id));
});

test("familiar rest ends sustained bonuses and resets timers before filling base resources", () => {
  const ability = source(); ability.id = 90;
  ability.definition!.durationType = "While Active"; ability.definition!.targets = ["Self"];
  ability.definition!.results = [{ ...blankResult("Self"), bonuses: { manaBuff: 10, dtBuff: 2 } }];
  const familiar = { ...actor, id: "fam-test", className: "Iron", abilities: [ability], effectApplications: [{ id: "active", abilityId: ability.id, effectId: ability.definition!.id, targetId: "self", startedAt: "test" }], triggerConfirmations: { test: true }, abilityTiming: { test: { spent: "2" } } } as unknown as Familiar;
  assert.equal(getFamiliarAdjusted(familiar).maxMana, 50);
  const rested = restedFamiliar(familiar);
  assert.equal(rested.currentMana, 40); assert.equal(rested.currentDt, 8); assert.equal(rested.currentHp, 64);
  assert.deepEqual(rested.effectApplications, []); assert.deepEqual(rested.triggerConfirmations, {}); assert.deepEqual(rested.abilityTiming, {});
  assert.equal(familiar.effectApplications!.length, 1);
});
