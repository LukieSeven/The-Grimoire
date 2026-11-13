import type { ResolvedEffect } from "./tracker.ts";
import type { Equipment, FavoriteSlot, InventoryItem } from "./storage.ts";
/** A generic favorite belongs to its exact main/Sub-Ability, never another use or summon. */
export function favoriteRollChoices(entries: ResolvedEffect[], abilityId: number, inputId: string): ResolvedEffect[] {
  return entries.filter(entry => entry.ability.id === abilityId && entry.input?.id === inputId && !!entry.result && !!entry.effect.rollFormula?.trim());
}

/** Old item shortcuts were used for either collection; their IDs can collide. */
export function resolveFavoriteItem(slot: FavoriteSlot, equipment: readonly Equipment[], inventory: readonly InventoryItem[]): { kind: "weapon"; item: Equipment } | { kind: "item"; item: InventoryItem } | undefined {
  if (slot.type !== "weapon" && slot.type !== "item") return;
  const gear = equipment.find(item => item.id === Number(slot.targetId));
  if (slot.type === "weapon") return gear ? { kind: "weapon", item: gear } : undefined;
  const general = inventory.find(item => item.id === Number(slot.targetId));
  if (gear && general) {
    const label = slot.label.trim().toLowerCase();
    const gearMatches = gear.name.trim().toLowerCase() === label;
    const generalMatches = general.name.trim().toLowerCase() === label;
    if (gearMatches === generalMatches) return;
    return gearMatches ? { kind: "weapon", item: gear } : { kind: "item", item: general };
  }
  if (general) return { kind: "item", item: general };
  if (gear) return { kind: "weapon", item: gear };
}
