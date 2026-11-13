import test from "node:test";
import assert from "node:assert/strict";
import { buildFormulaVars, evaluateFormula, getAdjustedStats, parseFormulaOrNum } from "../src/lib/storage.ts";
import type { Ability, Character, Equipment } from "../src/lib/storage.ts";

const character = {
  id: 1, rank: "Bronze", power: 8, vitality: 8, spirit: 8, agility: 8,
  endurance: 8, precision: 8, willpower: 8, charisma: 8,
  currentHp: 20, currentMana: 20, currentDt: 8, dtBonus: 0,
  hpFormula: "VIT * 10", manaFormula: "SPI * 5", dtFormula: "END + dtBonus",
} as Character;

test("static formulas use the entire dice maximum and keep stat subtraction", () => {
  const vars = buildFormulaVars({ willpower: 8 });
  assert.equal(evaluateFormula("2d6 + d4", vars), 16);
  assert.equal(evaluateFormula("d6 - 2", vars), 4);
  assert.equal(evaluateFormula("WIL - 2", vars), 6);
  assert.equal(evaluateFormula("WILx2", vars), 16);
  assert.equal(evaluateFormula("Health - WIL - 2", vars), 6);
  assert.equal(evaluateFormula("Health = WIL - 2", vars), 6);
  assert.equal(evaluateFormula("1 / 0", vars), 0);
  assert.equal(parseFormulaOrNum(Infinity, vars), 0);
});

test("static r aliases remain scores and m aliases use the rank or an explicit modifier", () => {
  const vars = buildFormulaVars({ power: 10, rank: "Bronze", powr: 5, willpower: 8, WILm: 7 });
  assert.equal(evaluateFormula("POWr + 6", vars), 16);
  assert.equal(evaluateFormula("POWm + 6", vars), 11);
  assert.equal(evaluateFormula("PowerM + WillpowerM", vars), 12);
  assert.equal(parseFormulaOrNum("WILm - 2", vars), 5);
});

test("equipped formulas read base scores independently of the order of items", () => {
  const gear = (id: number, statModifiers: Equipment["statModifiers"], equipped = true) => ({ id, characterId: character.id, equipped, statModifiers }) as Equipment;
  const equipped = [gear(1, { vitality: 2 }), gear(2, { power: "VIT/2 + POWm" }), gear(3, { power: 100 }, false)];
  const adjusted = getAdjustedStats(character, equipped);
  assert.equal(adjusted.stats.power, 16);
  assert.equal(adjusted.stats.vitality, 10);
  assert.deepEqual(getAdjustedStats(character, [...equipped].reverse()).stats, adjusted.stats);
  assert.equal(character.power, 8);
});

test("legacy active attributes include sub-ability and matching trigger fields once", () => {
  const ability = {
    id: 1, active: true, bonusPower: 1, bonusInitiative: 2,
    subAbilities: [{ id: "sub", name: "Sub", bonusPower: 2 }],
    triggers: [{ id: "low", name: "Low HP", resource: "hp", operator: "below_percent", threshold: 50, bonusPower: "WILm", triggerAction: "trigger_attached" }],
  } as Ability;
  const adjusted = getAdjustedStats(character, [], [ability]);
  assert.equal(adjusted.stats.power, 15);
  assert.equal(adjusted.modifiers.power, 7);
  assert.equal(adjusted.diceLabels.power, "d20");
  assert.equal(adjusted.abilityInitiativeBonus, 2);
  assert.equal(getAdjustedStats({ ...character, currentHp: 60 }, [], [ability]).stats.power, 11);
  assert.equal(getAdjustedStats(character, [], [{ ...ability, active: false }]).stats.power, 8);
  const replacement = { ...ability, triggers: [{ ...ability.triggers![0], triggerAction: "update_attached" as const }] };
  assert.equal(getAdjustedStats(character, [], [replacement]).stats.power, 12);
});
