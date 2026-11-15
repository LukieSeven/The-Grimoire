import { normalizeDurationType } from "./ability-input.ts";
import { hasModifierValue } from "./ability-bonuses.ts";
import { parseFormulaOrNum } from "./storage.ts";
import { isEffectApplied, type ResolvedEffect } from "./tracker.ts";
import type { EffectApplication } from "./tracker-types.ts";
import type { TemporaryResources } from "./temporary-resources.ts";

export type AbilityResourcePools = TemporaryResources & { currentHp: number; currentMana: number; currentDt: number };

export const restoredResourceFields = [
  ["currentHp", "maxHp", "hpAdd", "hp-log"],
  ["currentMana", "maxMana", "manaAdd", "mana-log"],
  ["currentDt", "maxDt", "dtAdd", "dt-log"],
] as const;

type ResourceKey = typeof restoredResourceFields[number][0];
type ResourceMaximums = Record<typeof restoredResourceFields[number][1], number>;

export function isInstantSelfRestore({ input, result, effect }: ResolvedEffect): boolean {
  return !!input && result?.target === "Self" && normalizeDurationType(result.durationType || input.durationType) === "Instant" &&
    (!result.effectOutcome || result.effectOutcome === "always") && restoredResourceFields.some(([, , field]) => hasModifierValue(effect[field]));
}

/** Instant Self restores are one-shot changes to the acting sheet, not temporary maximums or roll outcomes. */
export function instantSelfRestoration(
  entries: readonly ResolvedEffect[],
  nodeId: string,
  poolsAfterPayment: AbilityResourcePools,
  maximums: ResourceMaximums,
  stats: Record<string, number>,
  rank: string,
  applications: EffectApplication[],
  selected?: ResolvedEffect,
): { patch: Partial<Pick<AbilityResourcePools, ResourceKey>>; restored: Partial<Record<ResourceKey, number>> } {
  const amounts = { currentHp: 0, currentMana: 0, currentDt: 0 };
  const vars = { ...stats, rank };
  const independent = selected && isInstantSelfRestore(selected) && !selected.sharedActivation;
  for (const entry of entries) {
    if (entry.input?.id !== nodeId || entry.applicability !== "available" || !isInstantSelfRestore(entry)) continue;
    // Independent results have their own button; using one should not apply its siblings.
    if (independent ? entry.effect.id !== selected?.effect.id : !entry.sharedActivation) continue;
    if (entry.triggerParent && !isEffectApplied(entry.triggerParent, "self", applications)) continue;
    for (const [resource, , field] of restoredResourceFields) amounts[resource] += Math.max(0, parseFormulaOrNum(entry.effect[field], vars));
  }

  const patch: Partial<Pick<AbilityResourcePools, ResourceKey>> = {};
  const restored: Partial<Record<ResourceKey, number>> = {};
  for (const [resource, maximum] of restoredResourceFields) {
    const amount = Math.min(amounts[resource], maximums[maximum] - poolsAfterPayment[resource]);
    if (amount > 0) {
      patch[resource] = poolsAfterPayment[resource] + amount;
      restored[resource] = amount;
    }
  }
  return { patch, restored };
}
