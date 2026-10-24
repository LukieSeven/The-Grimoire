import test from "node:test";
import assert from "node:assert/strict";
import { upsertCharacterInitiative, moveInitiativeWithinTie } from "../src/lib/initiative-entry.ts";

test("manual tie movement swaps only adjacent equal initiatives without changing data", () => {
  const entries = [
    { id: "enemy", name: "Enemy", initiative: 20, statuses: [] },
    { id: "lucas", name: "Lucas", initiative: 17, statuses: ["Prone"] },
    { id: "pete", name: "Pete", initiative: 17, statuses: [] },
    { id: "lyth", name: "Lyth", initiative: 17, statuses: [] },
    { id: "last", name: "Last", initiative: 5, statuses: [] },
  ];
  const moved = moveInitiativeWithinTie(entries, "lyth", "up");
  assert.deepEqual(moved.map(entry => entry.id), ["enemy", "lucas", "lyth", "pete", "last"]);
  assert.deepEqual(entries.map(entry => entry.id), ["enemy", "lucas", "pete", "lyth", "last"]);
  assert.equal(moved[1], entries[1]);
  assert.deepEqual(moveInitiativeWithinTie(moved, "lyth", "down"), entries);
  assert.equal(moveInitiativeWithinTie(entries, "lucas", "up"), entries);
  assert.equal(moveInitiativeWithinTie(entries, "lyth", "down"), entries);
  assert.equal(moveInitiativeWithinTie(entries, "enemy", "up"), entries);
  assert.equal(moveInitiativeWithinTie(entries, "last", "down"), entries);
  assert.equal(moveInitiativeWithinTie(entries, "missing", "up"), entries);
});

test("same-score initiative updates preserve manually chosen tie order and current turn", () => {
  const entries = [
    { id: "lyth", name: "Lyth", initiative: 17, statuses: [] },
    { id: "character:2", name: "Lucas", initiative: 17, statuses: ["Prone"] },
    { id: "pete", name: "Pete", initiative: 17, statuses: [] },
  ];
  const result = upsertCharacterInitiative(entries, 2, 2, "Luke", 17);
  assert.deepEqual(result.combatants.map(entry => entry.id), entries.map(entry => entry.id));
  assert.equal(result.turn, 2);
  assert.deepEqual(result.combatants[1].statuses, ["Prone"]);
});
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
