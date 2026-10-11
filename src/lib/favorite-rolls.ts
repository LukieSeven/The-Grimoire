import type { ResolvedEffect } from "./tracker.ts";
/** A generic favorite belongs to its exact main/Sub-Ability, never another use or summon. */
export function favoriteRollChoices(entries: ResolvedEffect[], abilityId: number, inputId: string): ResolvedEffect[] {
  return entries.filter(entry => entry.ability.id === abilityId && entry.input?.id === inputId && !!entry.result && !!entry.effect.rollFormula?.trim());
}
