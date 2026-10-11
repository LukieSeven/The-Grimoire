import type { AbilityOptions } from "./ability-input.ts";
import { COMMON_EFFECTS, durationLabel } from "./ability-input.ts";
import type { ManualTrackedEffect } from "./ability-components.ts";
export function applyPresetEffect(effects: ManualTrackedEffect[], incoming: ManualTrackedEffect, now = new Date().toISOString()): ManualTrackedEffect[] {
  const result = incoming.definition?.results.find(result => result.target === "Enemy" || result.target === "Ally") ?? incoming.definition?.results[0];
  const peers = effects.filter(effect => effect.targetId === incoming.targetId && effect.templateId === incoming.templateId && effect.active);
  const existing = peers[0];
  if (result?.stacking === "Stack") {
    const count = peers.reduce((sum, effect) => sum + (effect.stacks ?? 1), 0);
    if (result.maxStacks !== undefined && count >= result.maxStacks) return effects;
    if (existing) return effects.map(effect => effect.id === existing.id ? { ...effect, stacks: (effect.stacks ?? 1) + 1, startedAt: now } : effect);
  } else if (existing && result?.stacking !== "Replace Existing") {
    return effects.map(effect => effect.id === existing.id ? { ...incoming, id: existing.id, stacks: 1, startedAt: now } : effect);
  }
  return [...effects.filter(effect => !peers.includes(effect)), { ...incoming, stacks: 1, startedAt: now }];
}
export function presetEffect(selection: string, targetId: string, options: AbilityOptions): ManualTrackedEffect | undefined {
  if (selection.startsWith("common:")) {
    const name = selection.slice(7);
    return COMMON_EFFECTS.includes(name) ? { id: crypto.randomUUID(), targetId, name, rules: "", active: true, templateId: selection } : undefined;
  }
  const template = options.effects.find(effect => effect.id === selection);
  if (!template?.name.trim()) return;
  const definition = template.definition;
  const result = definition?.results.find(result => result.target === "Enemy" || result.target === "Ally") ?? definition?.results[0];
  return { id: crypto.randomUUID(), targetId, templateId: template.id, name: template.name, rules: [template.rules, ...definition?.results.map(result => result.rules).filter(Boolean) ?? []].filter(Boolean).join("\n"), active: true, ...(definition ? { definition: structuredClone(definition), duration: durationLabel(result?.durationType || definition.durationType, result?.duration || definition.duration) } : {}) };
}
