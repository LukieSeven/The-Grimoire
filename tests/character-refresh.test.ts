import assert from "node:assert/strict";
import test from "node:test";
import { refreshExistingCharacter, type RefreshCollections } from "../src/lib/character-refresh.ts";

const snapshot = (): RefreshCollections => ({
  characters: [
    { id: 2, name: "Old values", createdAt: "original-date", power: 3, unknownLegacy: "keep", uiPreferences: { layout: { columns: 4 }, layoutPresets: [{ name: "OG Layout" }, { name: "New Layout" }], autoScrollRolls: false } },
    { id: 7, name: "Unrelated", power: 17 },
  ],
  equipment: [{ id: 4, characterId: 2, name: "Old blade" }, { id: 5, characterId: 7, name: "Other blade" }],
  currencies: [{ id: 1, characterId: 2, amount: 29 }],
  inventory: [{ id: 6, characterId: 7, name: "Other item" }],
  essences: [{ id: 3, characterId: 7, name: "Other essence" }],
  abilities: [{ id: 9, characterId: 7, name: "Other ability" }],
  skills: [{ id: 8, characterId: 7, name: "Other skill" }],
  notes: [{ id: 1, characterId: 2, text: "Existing note" }, { id: 4, characterId: 7, text: "Other note" }],
});

test("legacy character refresh updates values without resetting local layouts or omitted data", () => {
  const current = snapshot();
  const before = structuredClone(current);
  const result = refreshExistingCharacter(current, 2, { character: { id: 999, name: "Latest character", power: 10, createdAt: "export-date", legacyPayload: { nested: true } } });
  assert.equal(result.characters[0].id, 2);
  assert.equal(result.characters[0].createdAt, "original-date");
  assert.equal(result.characters[0].power, 10);
  assert.equal(result.characters[0].unknownLegacy, "keep");
  assert.deepEqual(result.characters[0].legacyPayload, { nested: true });
  assert.deepEqual(result.characters[0].uiPreferences, current.characters[0].uiPreferences);
  for (const key of ["equipment", "currencies", "inventory", "essences", "abilities", "skills", "notes"] as const) assert.deepEqual(result[key], current[key]);
  assert.deepEqual(result.characters[1], current.characters[1]);
  assert.deepEqual(current, before, "must not mutate source storage");
});

test("incoming preferences cannot overwrite existing saved layouts or auto-scroll preference", () => {
  const current = snapshot();
  const result = refreshExistingCharacter(current, 2, { character: { id: 2, name: "Updated", uiPreferences: { layout: { columns: 12 }, layoutPresets: [], autoScrollRolls: true, importedLegacyPreference: "retained" } } });
  assert.deepEqual(result.characters[0].uiPreferences, { ...(current.characters[0].uiPreferences as object), importedLegacyPreference: "retained" });
});

test("refresh remaps foreign ID collisions and reconnects favorites, sources and applications", () => {
  const current = snapshot();
  const result = refreshExistingCharacter(current, 2, {
    character: { id: 100, name: "Latest", favorites: [
      { type: "weapon", targetId: 5 }, { type: "item", targetId: 6 },
      { type: "ability-result", targetId: 9, subId: "result-uuid" }, { type: "skill", targetId: 8 },
      { type: "familiar-ability", familiarId: "pet-uuid", targetId: 9 },
    ], effectApplications: [{ id: "application-uuid", abilityId: 9, effectId: "result-uuid" }, { id: "pet-effect", abilityId: 9, familiarId: "pet-uuid" }],
    manualTrackedEffects: [{ id: "manual-uuid", abilityId: 9 }],
    familiars: [{ id: "pet-uuid", abilities: [{ id: 9, equipmentId: 5, definition: { id: "familiar-definition-uuid" } }], effectApplications: [{ abilityId: 9 }] }] },
    equipment: [{ id: 5, name: "Fresh blade", legacyWeaponField: "preserve" }],
    inventory: [{ id: 6, name: "Fresh item" }],
    essences: [{ id: 3, name: "Fresh essence" }],
    abilities: [{ id: 9, name: "Fresh ability", equipmentId: 5, inventoryItemId: 6, essenceId: 3, definition: { id: "definition-uuid", results: [{ id: "result-uuid", templateId: "template-uuid" }] } }],
    skills: [{ id: 8, name: "Fresh skill" }],
    notes: [{ id: 4, text: "Fresh note" }],
  });
  for (const key of ["equipment", "inventory", "essences", "abilities", "skills", "notes"] as const) {
    assert.deepEqual(result[key]?.filter(item => item.characterId === 7), current[key]?.filter(item => item.characterId === 7));
  }
  const own = (key: "equipment" | "inventory" | "essences" | "abilities" | "skills") => result[key].find(item => item.characterId === 2)!;
  const ability = own("abilities");
  assert.notEqual(ability.id, 9);
  assert.equal(ability.equipmentId, own("equipment").id);
  assert.equal(ability.inventoryItemId, own("inventory").id);
  assert.equal(ability.essenceId, own("essences").id);
  assert.deepEqual(ability.definition, { id: "definition-uuid", results: [{ id: "result-uuid", templateId: "template-uuid" }] });
  const character = result.characters[0] as Record<string, any>;
  assert.deepEqual(character.favorites.map((slot: any) => slot.targetId), [own("equipment").id, own("inventory").id, ability.id, own("skills").id, 9]);
  assert.equal(character.favorites[2].subId, "result-uuid");
  assert.equal(character.effectApplications[0].abilityId, ability.id);
  assert.equal(character.manualTrackedEffects[0].abilityId, ability.id);
  assert.equal(character.effectApplications[1].abilityId, 9);
  assert.equal(character.familiars[0].id, "pet-uuid");
  assert.equal(character.familiars[0].abilities[0].id, 9);
  assert.equal(character.familiars[0].abilities[0].equipmentId, own("equipment").id);
  assert.equal(character.familiars[0].abilities[0].definition.id, "familiar-definition-uuid");
  assert.equal(character.familiars[0].effectApplications[0].abilityId, 9);
});

test("only explicit lists replace target data and history outside the sheet stays intact", () => {
  const current = { ...snapshot(), history: [{ id: 1, characterId: 2, result: 42 }], unknownArchiveProperty: { keep: true } };
  const result = refreshExistingCharacter(current, 2, { character: { id: 2, name: "Updated" }, equipment: [], notes: [] });
  assert.deepEqual(result.equipment, current.equipment.filter(item => item.characterId !== 2));
  assert.deepEqual(result.notes, current.notes?.filter(item => item.characterId !== 2));
  assert.deepEqual(result.currencies, current.currencies);
  assert.deepEqual(result.history, current.history);
  assert.deepEqual(result.unknownArchiveProperty, current.unknownArchiveProperty);
});

test("refresh keeps target-owned IDs and valid omitted-list links, but not foreign source links", () => {
  const current = snapshot();
  const result = refreshExistingCharacter(current, 2, {
    character: { id: 2, name: "Updated" },
    abilities: [{ id: 1, equipmentId: 4, inventoryItemId: 6, essenceId: -1, linkedStat: "willpower", unknown: { id: "legacy-uuid" } }],
  });
  assert.equal(result.abilities[1].equipmentId, 4);
  assert.equal(result.abilities[1].inventoryItemId, null);
  assert.equal(result.abilities[1].essenceId, -1);
  assert.equal(result.abilities[1].linkedStat, "willpower");
  assert.deepEqual(result.abilities[1].unknown, { id: "legacy-uuid" });
});

test("ambiguous duplicate IDs or foreign favorite references reject without changing storage", () => {
  const current = snapshot();
  const before = structuredClone(current);
  assert.throws(() => refreshExistingCharacter(current, 2, { character: { id: 2 }, abilities: [{ id: 10 }, { id: 10 }] }), /Duplicate abilities ID/);
  assert.throws(() => refreshExistingCharacter(current, 2, { character: { id: 2, favorites: [{ type: "weapon", targetId: 5 }] } }), /another character/);
  assert.throws(() => refreshExistingCharacter(current, 99, { character: { id: 99 } }), /does not exist/);
  assert.deepEqual(current, before);
});
