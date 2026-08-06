export type EntityRecord = Record<string, unknown> & { id: number; characterId?: number };

export interface CharacterBundle {
  character: EntityRecord;
  equipment?: EntityRecord[];
  currencies?: EntityRecord[];
  inventory?: EntityRecord[];
  essences?: EntityRecord[];
  abilities?: EntityRecord[];
  skills?: EntityRecord[];
}

export interface GrimoireCollections {
  characters: EntityRecord[];
  equipment: EntityRecord[];
  currencies: EntityRecord[];
  inventory: EntityRecord[];
  essences: EntityRecord[];
  abilities: EntityRecord[];
  skills: EntityRecord[];
}

const nextId = (items: EntityRecord[]): number =>
  items.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1;

function cloneRecords(
  source: EntityRecord[] | undefined,
  target: EntityRecord[],
  characterId: number,
): Map<number, number> {
  const ids = new Map<number, number>();
  for (const item of source ?? []) {
    const id = nextId(target);
    ids.set(Number(item.id), id);
    target.push({ ...item, id, characterId });
  }
  return ids;
}

/** Clone Chronicle bundles into Grimoire collections without retaining stale IDs. */
export function importChronicleBundles(
  current: GrimoireCollections,
  bundles: CharacterBundle[],
): GrimoireCollections {
  const result = structuredClone(current);

  for (const bundle of bundles) {
    const characterId = nextId(result.characters);
    result.characters.push({ ...bundle.character, id: characterId });

    const equipmentIds = cloneRecords(bundle.equipment, result.equipment, characterId);
    cloneRecords(bundle.currencies, result.currencies, characterId);
    const inventoryIds = cloneRecords(bundle.inventory, result.inventory, characterId);
    const essenceIds = cloneRecords(bundle.essences, result.essences, characterId);
    cloneRecords(bundle.skills, result.skills, characterId);

    for (const ability of bundle.abilities ?? []) {
      const id = nextId(result.abilities);
      const oldEquipmentId = Number(ability.equipmentId);
      const oldInventoryId = Number(ability.inventoryItemId);
      const oldEssenceId = Number(ability.essenceId);
      result.abilities.push({
        ...ability,
        id,
        characterId,
        equipmentId: equipmentIds.get(oldEquipmentId) ?? null,
        inventoryItemId: inventoryIds.get(oldInventoryId) ?? null,
        essenceId: essenceIds.get(oldEssenceId) ?? null,
      });
    }
  }

  return result;
}
