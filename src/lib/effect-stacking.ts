import type { EffectApplication } from "./tracker-types.ts";
import type { ResolvedEffect } from "./tracker.ts";
import { isEffectApplied } from "./tracker.ts";
import { BONUS_FIELDS } from "./ability-bonuses.ts";
import type { AbilityBonuses } from "./ability-bonuses.ts";
export function selectStackedEffects(entries: ResolvedEffect[], applications: EffectApplication[], evaluate: (value: number | string | undefined) => number): ResolvedEffect[] {
  const active = entries.filter(entry => entry.result && isEffectApplied(entry, "self", applications));
  const groupKey = (entry: ResolvedEffect) => entry.result?.templateId ?? `${entry.ability.id}:${entry.effect.id}`;
  const started = (entry: ResolvedEffect) => applications.find(application => application.abilityId === entry.ability.id && application.targetId === "self" && (application.effectId === entry.effect.id || application.effectId === entry.input?.id))?.startedAt ?? "";
  const groups = new Map<string, ResolvedEffect[]>();
  for (const entry of active) groups.set(groupKey(entry), [...(groups.get(groupKey(entry)) ?? []), entry]);
  return active.flatMap(entry => {
    const peers = groups.get(groupKey(entry))!;
    if (peers.some(peer => peer.result?.stacking === "Replace Existing")) {
      const newest = peers.reduce((winner, peer) => started(peer) >= started(winner) ? peer : winner);
      if (entry !== newest) return [];
    }
    if (!peers.some(peer => peer.result?.stacking === "Highest Only")) return [entry];
    const bonuses: AbilityBonuses = { ...(entry.result?.bonuses ?? {}) };
    for (const [key] of BONUS_FIELDS) {
      const winner = peers.reduce((best, peer) => Math.abs(evaluate(peer.result?.bonuses?.[key])) > Math.abs(evaluate(best.result?.bonuses?.[key])) ? peer : best);
      if (winner !== entry) bonuses[key] = 0;
    }
    return [{ ...entry, result: { ...entry.result!, bonuses } }];
  });
}
export function expireEffectApplications(applications: EffectApplication[], event: "turn" | "combat" | "use" | "rest") {
  const label = { turn: "Until Next Turn", combat: "Until Combat Ends", use: "Until Used", rest: "Until Rest" }[event];
  return applications.filter(application => !application.duration?.startsWith(label));
}
export function applyTrackedEffect(applications: EffectApplication[], entry: ResolvedEffect, targetId: string, now = new Date().toISOString()): EffectApplication[] {
  const same = (application: EffectApplication) => application.abilityId === entry.ability.id && application.effectId === entry.effect.id && application.familiarId === entry.ownerFamiliar?.id && application.targetId === targetId;
  const existing = applications.find(same);
  const rule = entry.result?.stacking;
  const peers = applications.filter(application => application.targetId === targetId && entry.result?.templateId && application.templateId === entry.result.templateId);
  if (rule === "Stack" && entry.result?.maxStacks !== undefined && peers.reduce((sum, application) => sum + (application.stacks ?? 1), 0) >= entry.result.maxStacks) return applications;
  if (rule === "Replace Existing" && entry.result?.templateId) applications = applications.filter(application => !peers.includes(application) || same(application));
  if (existing) {
    if (rule === "Stack") return applications.map(application => same(application) ? { ...application, stacks: Math.min(entry.result?.maxStacks ?? Number.POSITIVE_INFINITY, (application.stacks ?? 1) + 1), startedAt: now } : application);
    if (rule === "Refresh Duration" || rule === "Replace Existing" || rule === "Highest Only") return applications.map(application => same(application) ? { ...application, startedAt: now, duration: entry.effect.duration } : application);
    return applications;
  }
  return [...applications, { id: crypto.randomUUID(), abilityId: entry.ability.id, effectId: entry.effect.id, templateId: entry.result?.templateId, familiarId: entry.ownerFamiliar?.id, targetId, startedAt: now, duration: entry.effect.duration, stacks: rule === "Stack" && targetId === "self" && isEffectApplied(entry, "self", applications) ? Math.min(entry.result?.maxStacks ?? Infinity, 2) : 1 }];
}
