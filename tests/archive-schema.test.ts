import assert from "node:assert/strict";
import test from "node:test";
import { ARCHIVE_SCHEMA_VERSION, assertSupportedVersion, fullArchiveSchema, validateArchiveRelationships } from "../src/lib/archive-schema.ts";

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
