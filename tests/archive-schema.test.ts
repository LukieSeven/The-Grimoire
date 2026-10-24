import assert from "node:assert/strict";
import test from "node:test";
import { ARCHIVE_SCHEMA_VERSION, assertSupportedVersion, fullArchiveSchema, grimoireBackupSchema, codexBackupSchema, validateArchiveRelationships } from "../src/lib/archive-schema.ts";

test("archive schema supplies optional collections and current version", () => {
  const archive = fullArchiveSchema.parse({ fullArchive: true, characters: [{ id: 1, name: "Aria" }] });
  assert.equal(archive.schemaVersion, ARCHIVE_SCHEMA_VERSION);
  assert.deepEqual(archive.abilities, []);
});

test("archive schema rejects malformed characters", () => {
  assert.throws(() => fullArchiveSchema.parse({ fullArchive: true, characters: [{ id: 1 }] }));
});

test("newer archive versions fail explicitly", () => {
  assert.throws(() => assertSupportedVersion(ARCHIVE_SCHEMA_VERSION + 1), /supports/);
});

test("archive relationships reject orphaned records", () => {
  const archive = fullArchiveSchema.parse({
    fullArchive: true,
    characters: [{ id: 1, name: "Aria" }],
    abilities: [{ id: 2, characterId: 999 }],
  });
  assert.throws(() => validateArchiveRelationships(archive), /missing character/);
});

test("patched validation retains legacy entity fields, layouts and per-die critical metadata", () => {
  const character = { id: 1, name: "Legacy hero", oldCustomField: { keep: true }, familiars: [{ id: "fam", name: "Legacy familiar" }], uiPreferences: { layout: { version: 1, oldPosition: true }, deletedLayoutPresetIds: ["new-layout"] } };
  const roll = { id: 2, characterId: 1, criticalDice: [{ sides: 6 }, { sides: 12 }], oldRollField: "keep" };
  for (const schema of [fullArchiveSchema, grimoireBackupSchema]) {
    const parsed = schema.parse({ fullArchive: true, grimoireBackup: true, characters: [character], rolls: [roll] });
    assert.equal(parsed.schemaVersion, ARCHIVE_SCHEMA_VERSION);
    assert.deepEqual(parsed.characters[0], character);
    assert.deepEqual(parsed.rolls[0], roll);
  }
  const note = { id: 3, title: "Legacy lore", oldNoteField: ["keep"] };
  assert.deepEqual(codexBackupSchema.parse({ codexBackup: true, codex: [note] }).codex[0], note);
});

test("omitted archive collections are fresh arrays for each import", () => {
  const first = fullArchiveSchema.parse({ fullArchive: true });
  first.equipment.push({ id: 99 });
  try {
    const second = fullArchiveSchema.parse({ fullArchive: true });
    assert.deepEqual(second.equipment, []);
  } finally {
    first.equipment.pop();
  }
});
