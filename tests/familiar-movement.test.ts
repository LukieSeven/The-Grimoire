import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFamiliarMovement, familiarAsCharacter, familiarMovementExpression, getFamiliarAdjusted, getFamiliarMovementSpeed } from "../src/lib/familiar-values.ts";
import type { Familiar } from "../src/lib/storage.ts";

const familiar: Familiar = {
  id: "movement-test", name: "Test familiar", className: "Bronze", race: "", level: 1,
  speed: 25, power: 6, vitality: 6, spirit: 6, agility: 8, endurance: 6, precision: 6, willpower: 6, charisma: 6,
  currentHp: 48, currentMana: 30, currentDt: 6, dtBonus: 0, abilities: [],
  hpFormula: "VIT * 8", manaFormula: "SPI * 5", dtFormula: "END",
};

test("familiar movement accepts flat values and rank-aware formulas", () => {
  const vars = { ...familiar, rank: familiar.className };
  assert.equal(evaluateFamiliarMovement("25", vars), 25);
  assert.equal(evaluateFamiliarMovement("AGI * 5 + AGIm", vars), 44);
  assert.equal(getFamiliarAdjusted({ ...familiar, speed: 25, speedFormula: "25" }).speed, 25);
  assert.equal(getFamiliarAdjusted({ ...familiar, speed: 44, speedFormula: "AGI * 5 + AGIm" }).speed, 44);
});

test("legacy movement retains the effective Agility formula without rewriting saved speed", () => {
  assert.equal(familiarMovementExpression(familiar), "Agility * 5");
  assert.equal(familiarAsCharacter(familiar).speed, 25);
  assert.equal(getFamiliarAdjusted(familiar).speed, 40);
  assert.equal(familiar.speed, 25);
  assert.equal(familiar.speedFormula, undefined);
});

test("new familiar movement distinguishes zero from invalid arithmetic and unknown attributes", () => {
  const vars = { ...familiar, rank: familiar.className };
  for (const expression of ["", "Aglity * 5", "Aglity - 5", "2 + (", "1 / 0"]) assert.equal(getFamiliarMovementSpeed(expression, vars), undefined, expression);
  assert.equal(getFamiliarMovementSpeed("0", vars), 0);
  assert.equal(getFamiliarMovementSpeed("AGI - Agility", vars), 0);
  assert.equal(getFamiliarMovementSpeed("Movement = AGIx5 + AGIm", vars), 44);
  assert.equal(evaluateFamiliarMovement("Movement - 25", vars), 25, "saved legacy dash labels retain their existing meaning");
});
