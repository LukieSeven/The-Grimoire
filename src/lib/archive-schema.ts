import { z } from "zod";

export const ARCHIVE_SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

const entitySchema = z.object({ id: z.number().finite() }).passthrough();
const characterSchema = entitySchema.extend({ name: z.string().trim().min(1).max(200) });

const collectionsSchema = z.object({
  characters: z.array(characterSchema).default([]),
  equipment: z.array(entitySchema).default([]),
  currencies: z.array(entitySchema).default([]),
  inventory: z.array(entitySchema).default([]),
  essences: z.array(entitySchema).default([]),
  abilities: z.array(entitySchema).default([]),
  skills: z.array(entitySchema).default([]),
  notes: z.array(entitySchema).default([]),
  rolls: z.array(z.unknown()).default([]),
});

export const fullArchiveSchema = collectionsSchema.extend({
  fullArchive: z.literal(true),
  schemaVersion: z.number().int().positive().default(ARCHIVE_SCHEMA_VERSION),
  codex: z.array(entitySchema).default([]),
  unlockedPasswords: z.array(z.string()).default([]),
});

export const grimoireBackupSchema = collectionsSchema.extend({
  grimoireBackup: z.literal(true),
  schemaVersion: z.number().int().positive().default(ARCHIVE_SCHEMA_VERSION),
});

export const codexBackupSchema = z.object({
  codexBackup: z.literal(true),
  schemaVersion: z.number().int().positive().default(ARCHIVE_SCHEMA_VERSION),
  codex: z.array(entitySchema).default([]),
  unlockedPasswords: z.array(z.string()).default([]),
});

export function parseImportJson(json: string): unknown {
  if (new Blob([json]).size > MAX_IMPORT_BYTES) {
    throw new Error(`Import exceeds the ${MAX_IMPORT_BYTES / 1024 / 1024} MB safety limit.`);
  }
  return JSON.parse(json) as unknown;
}

export function assertSupportedVersion(version: number): void {
  if (version > ARCHIVE_SCHEMA_VERSION) {
    throw new Error(`This archive uses schema version ${version}; this app supports ${ARCHIVE_SCHEMA_VERSION}.`);
  }
}

type ArchiveCollections = z.infer<typeof collectionsSchema>;

export function validateArchiveRelationships(data: ArchiveCollections): void {
  const characterIds = new Set(data.characters.map(item => item.id));
  for (const collection of [data.equipment, data.currencies, data.inventory, data.essences, data.abilities, data.skills, data.notes]) {
    for (const item of collection) {
      const characterId = item.characterId;
      if (typeof characterId === "number" && !characterIds.has(characterId)) {
        throw new Error(`Record ${item.id} refers to missing character ${characterId}.`);
      }
    }
  }

  const equipmentIds = new Set(data.equipment.map(item => item.id));
  const inventoryIds = new Set(data.inventory.map(item => item.id));
  const essenceIds = new Set(data.essences.map(item => item.id));
  for (const ability of data.abilities) {
    for (const [field, ids] of [
      ["equipmentId", equipmentIds],
      ["inventoryItemId", inventoryIds],
      ["essenceId", essenceIds],
    ] as const) {
      const linkedId = ability[field];
      if (typeof linkedId === "number" && !ids.has(linkedId)) {
        throw new Error(`Ability ${ability.id} has an invalid ${field} (${linkedId}).`);
      }
    }
  }
}
