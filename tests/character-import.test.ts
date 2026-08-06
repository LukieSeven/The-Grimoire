import assert from "node:assert/strict";
import test from "node:test";
import { importChronicleBundles, type CharacterBundle, type GrimoireCollections } from "../src/lib/character-import.ts";

test("Chronicle import remaps ability relationships", () => {
  const current: GrimoireCollections = {
    characters: [{ id: 8, name: "Existing" }],
    equipment: [{ id: 20, characterId: 8 }],
    currencies: [], inventory: [], essences: [], abilities: [], skills: [],
  };
  const bundle: CharacterBundle = {
    character: { id: 1, name: "Imported" },
    equipment: [{ id: 2, characterId: 1, name: "Blade" }],
    inventory: [{ id: 3, characterId: 1, name: "Focus" }],
    essences: [{ id: 4, characterId: 1, name: "Flame" }],
    abilities: [{ id: 5, characterId: 1, equipmentId: 2, inventoryItemId: 3, essenceId: 4 }],
  };

  const imported = importChronicleBundles(current, [bundle]);
  assert.equal(imported.characters[1].id, 9);
  assert.deepEqual(imported.abilities[0], {
    id: 1, characterId: 9, equipmentId: 21, inventoryItemId: 1, essenceId: 1,
  });
  assert.equal(current.characters.length, 1, "input collections must not be mutated");
});

test("Chronicle import clears relationships whose target is absent", () => {
  const empty: GrimoireCollections = {
    characters: [], equipment: [], currencies: [], inventory: [], essences: [], abilities: [], skills: [],
  };
  const result = importChronicleBundles(empty, [{
    character: { id: 1, name: "Imported" },
    abilities: [{ id: 2, equipmentId: 999, inventoryItemId: 998, essenceId: 997 }],
  }]);
  assert.equal(result.abilities[0].equipmentId, null);
  assert.equal(result.abilities[0].inventoryItemId, null);
  assert.equal(result.abilities[0].essenceId, null);
});
