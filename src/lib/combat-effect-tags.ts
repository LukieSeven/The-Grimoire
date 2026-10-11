import type { ResolvedEffect } from "./tracker.ts";
/** A target result or aura origin is not itself a named applied status. Never parse descriptions. */
export function combatEffectName(entry: ResolvedEffect): string | undefined {
  if (entry.result?.templateId?.startsWith("common:")) return entry.result.templateId.slice(7);
  const template = entry.result?.templateId ? entry.ability.definition?.options.effects.find(effect => effect.id === entry.result!.templateId) : undefined;
  const legacy = !entry.input && !entry.component ? entry.ability.abilityEffects?.find(effect => effect.id === entry.effect.id) : undefined;
  const name = (template?.name ?? entry.createdEffect?.name ?? entry.result?.name ?? legacy?.name)?.trim();
  return name && name !== entry.ability.name && name !== entry.input?.name && name !== entry.component?.name ? name : undefined;
}
