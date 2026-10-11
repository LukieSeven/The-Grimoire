import test from "node:test";
import assert from "node:assert/strict";
import { upsertCharacterInitiative } from "../src/lib/initiative-entry.ts";
test("initiative adds one character and preserves the current turn after sorting", () => {
  const result = upsertCharacterInitiative([{ id: "enemy", name: "Enemy", initiative: 10, statuses: [] }], 0, 2, "Lucas", 15);
  assert.equal(result.combatants[0].id, "character:2"); assert.equal(result.turn, 1);
});
test("rerolls replace existing initiative without losing statuses or duplicating the character", () => {
  const entries = [{ id: "manual", name: "Lucas", initiative: 10, statuses: ["Prone"] }];
  const result = upsertCharacterInitiative(entries, 0, 2, "Lucas", 12);
  assert.equal(result.combatants.length, 1); assert.equal(result.combatants[0].initiative, 12);
  assert.deepEqual(result.combatants[0].statuses, ["Prone"]); assert.equal(entries[0].initiative, 10);
});
test("tracked character identity survives a rename and invalid totals are rejected", () => {
  const entries = [{ id: "character:2", name: "Luke", initiative: 10, statuses: [] }];
  assert.equal(upsertCharacterInitiative(entries, 0, 2, "Lucas", 16).combatants.length, 1);
  assert.throws(() => upsertCharacterInitiative(entries, 0, 2, "Lucas", NaN));
});
