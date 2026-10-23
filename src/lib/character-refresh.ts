import type { CharacterBundle, EntityRecord, GrimoireCollections } from "./character-import.ts";

export type CharacterRefreshBundle = CharacterBundle & { notes?: EntityRecord[] };
export type RefreshCollections = GrimoireCollections & { notes?: EntityRecord[] };

const RELATED_LISTS = ["equipment", "currencies", "inventory", "essences", "abilities", "skills", "notes"] as const;
type RelatedList = typeof RELATED_LISTS[number];
type IdMaps = Record<RelatedList, Map<number, number>>;
type ForeignIds = Record<RelatedList, Set<number>>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const entityId = (value: unknown): number | undefined => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (value === "") return undefined;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : undefined;
};

/**
 * Replace one existing character from a portable sheet without replacing its local
 * workspace, another character, or collections omitted by older sheet formats.
 * No I/O, defaults, generated gameplay values, or input mutations occur here.
 */
export function refreshExistingCharacter<T extends RefreshCollections>(
  current: T,
  targetId: number,
  bundle: CharacterRefreshBundle,
): T {
  const existing = current.characters.find(character => character.id === targetId);
  if (!existing) throw new Error(`Character ${targetId} does not exist`);
  if (!isRecord(bundle.character)) throw new Error("Invalid character data structure");

  const result: RefreshCollections = structuredClone(current);
  const incoming = structuredClone(bundle);
  const maps = Object.fromEntries(RELATED_LISTS.map(key => [key, new Map<number, number>()])) as IdMaps;
  const foreign = Object.fromEntries(RELATED_LISTS.map(key => [key,
    new Set((current[key] ?? []).filter(item => item.characterId !== targetId).map(item => item.id)),
  ])) as ForeignIds;

  for (const key of RELATED_LISTS) {
    // Missing means "not included in this file", whereas [] explicitly clears
    // this character's list. A malformed list must not silently clear anything.
    if (incoming[key] === undefined) continue;
    const source = incoming[key];
    if (!Array.isArray(source) || source.some(item => !isRecord(item))) {
      throw new Error(`Invalid character ${key} list`);
    }
    const previous = current[key] ?? [];
    const retained = result[key]?.filter(item => item.characterId !== targetId) ?? [];
    const allocated = new Set(foreign[key]);
    let next = [...previous, ...source].reduce((highest, item) => Math.max(highest, entityId(item.id) ?? 0), 0) + 1;
    const replacements = source.map(item => {
      const oldId = entityId(item.id);
      if (oldId !== undefined && maps[key].has(oldId)) throw new Error(`Duplicate ${key} ID ${oldId}`);
      const id = oldId !== undefined && !allocated.has(oldId) ? oldId : next++;
      if (!Number.isSafeInteger(id)) throw new Error(`No safe ${key} ID is available`);
      allocated.add(id);
      if (oldId !== undefined) maps[key].set(oldId, id);
      return { ...item, id, characterId: targetId };
    });
    result[key] = [...retained, ...replacements];
  }

  const reference = (value: unknown, key: RelatedList): unknown => {
    const id = entityId(value);
    if (id === undefined) return value; // Includes null and legacy essenceId=-1.
    if (maps[key].has(id)) return maps[key].get(id);
    // An unresolved legacy reference must never accidentally select another
    // character's entity. Other unrecognized legacy values are retained.
    return foreign[key].has(id) ? null : value;
  };
  const remapSources = (record: EntityRecord | Record<string, unknown>) => {
    for (const [field, key] of [["equipmentId", "equipment"], ["inventoryItemId", "inventory"], ["essenceId", "essences"]] as const) {
      if (Object.hasOwn(record, field)) record[field] = reference(record[field], key);
    }
  };
  for (const key of RELATED_LISTS) {
    for (const record of result[key] ?? []) {
      if (record.characterId === targetId) remapSources(record);
    }
  }

  const character: EntityRecord = { ...structuredClone(existing), ...incoming.character, id: targetId };
  if (Object.hasOwn(existing, "createdAt")) character.createdAt = existing.createdAt;
  if (isRecord(existing.uiPreferences)) {
    character.uiPreferences = {
      ...(isRecord(incoming.character.uiPreferences) ? incoming.character.uiPreferences : {}),
      ...structuredClone(existing.uiPreferences),
    };
  }

  if (Array.isArray(character.favorites)) {
    character.favorites = character.favorites.map(slot => {
      if (!isRecord(slot)) return slot;
      const key = ["ability", "ability-result", "sub-ability"].includes(String(slot.type)) ? "abilities"
        : slot.type === "weapon" ? "equipment"
        : slot.type === "item" ? "inventory"
        : slot.type === "skill" ? "skills" : undefined;
      if (!key) return slot; // Familiar-local and attribute identifiers are not global IDs.
      const target = reference(slot.targetId, key);
      if (target === null && slot.targetId !== null) throw new Error(`Favorite ${String(slot.label ?? slot.type)} refers to another character's ${key}`);
      return { ...slot, targetId: target };
    });
  }
  for (const field of ["manualTrackedEffects", "effectApplications"] as const) {
    if (!Array.isArray(character[field])) continue;
    character[field] = character[field].map((effect: unknown) => {
      if (!isRecord(effect) || effect.familiarId !== undefined || !Object.hasOwn(effect, "abilityId")) return effect;
      const id = reference(effect.abilityId, "abilities");
      return { ...effect, abilityId: id === null ? undefined : id };
    });
  }
  if (Array.isArray(character.familiars)) {
    for (const familiar of character.familiars) {
      if (!isRecord(familiar) || !Array.isArray(familiar.abilities)) continue;
      // Familiar and ability IDs belong to the familiar snapshot, not the global
      // ability table; definition/result/trigger UUIDs must remain untouched.
      for (const ability of familiar.abilities) if (isRecord(ability)) remapSources(ability);
    }
  }
  result.characters = result.characters.map(item => item.id === targetId ? character : item);
  return result as T;
}
