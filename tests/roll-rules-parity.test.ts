import test from "node:test";
import assert from "node:assert/strict";
import { customInitiativeFormula, legacyModifierNote, prepareRollFormula, rollFormula, rollStatDice, validateRollFormulaSyntax, weaponRollFormula } from "../src/lib/roll-rules.ts";

const lyth = { rank: "Bronze", stats: { willpower: 8, spirit: 10 } };
const squibs = { rank: "Iron", stats: { power: 5 } };

test("Lyth score, stat roll, and modifier-only examples use distinct meanings", () => {
  const neverRoll = () => { throw new Error("No roll expected"); };
  assert.equal(rollFormula("WILx2", lyth, neverRoll).result, 16);
  assert.equal(rollFormula("spir+8", lyth, () => 0.4).result, 18); // d10 rolled 5, Bronze modifier 5
  assert.equal(rollFormula("15 + (SPIm × 4)", lyth, neverRoll).result, 35);
  assert.equal(rollFormula("Wilr+1D6", lyth, () => 0).result, 6);
  assert.equal(rollFormula("WILr*2", lyth, () => 0).breakdown, "(1+4)*2");
});

test("Squibs rolls with familiar rank, and linked aliases use the selected stat", () => {
  assert.equal(rollFormula("1d6+POWr", squibs, () => 0).result, 3);
  assert.equal(rollFormula("StATr+STATm", { ...lyth, selectedStat: "SPI" }, () => 0).result, 11);
  assert.throws(() => prepareRollFormula("STATr", lyth), /Choose a linked attribute/);
  assert.throws(() => prepareRollFormula("POWr", lyth), /power stat/);
  assert.throws(() => prepareRollFormula("WIL/(SPI-SPI)", lyth), /finite number/);
  assert.doesNotThrow(() => validateRollFormulaSyntax("STATr+1D6"));
  assert.throws(() => validateRollFormulaSyntax("+3 to Stealth"));
  assert.deepEqual(legacyModifierNote("+3 to Stealth"), { amount: "+3", scope: "Stealth" });
});

test("the shared roller keeps every initial critical and its cap", () => {
  const combined = rollFormula("Wilr+3D6", lyth, () => 0.999);
  assert.deepEqual(combined.criticalDice, [{ sides: 8, target: 8 }, { sides: 6 }, { sides: 6 }, { sides: 6 }]);
  const pool = rollFormula("20D6", lyth, () => 0.999);
  assert.equal(pool.result, 120);
  assert.equal(pool.criticalDice.length, 20);
  const rolls = [0.999, 0.7];
  assert.deepEqual(rollStatDice(25, () => rolls.shift()!).criticalDice, [{ sides: 20, target: 20 }, { sides: 6, target: 5 }]);
});

test("weapon dice and modifiers compose as full expressions", () => {
  assert.equal(rollFormula(weaponRollFormula("1D6", "POWm+2"), squibs, () => 0).result, 4);
  assert.equal(rollFormula(weaponRollFormula("1D6", ""), squibs, () => 0).result, 3);
  assert.equal(rollFormula(weaponRollFormula("1D6", undefined), squibs, () => 0).result, 3);
  assert.equal(weaponRollFormula("1D6 + POWm", 0), "(1D6 + POWm)");
  assert.equal(rollFormula(weaponRollFormula("1D6 + POWm", 0), squibs, () => 0).result, 2);
  assert.equal(rollFormula(weaponRollFormula("1D6", "0"), squibs, () => 0).result, 1);
  assert.throws(() => weaponRollFormula(undefined, 2), /weapon's dice/);
});

test("only a non-default initiative formula replaces the standard Agility check", () => {
  assert.equal(customInitiativeFormula(undefined), undefined);
  assert.equal(customInitiativeFormula("AGI"), undefined);
  assert.equal(customInitiativeFormula("Agility"), undefined);
  assert.equal(customInitiativeFormula("AGIr + 2"), "AGIr + 2");
});
