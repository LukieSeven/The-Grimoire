import type { Ability, AbilityTrigger } from "./storage.ts";
import type { ResolvedEffect } from "./tracker.ts";
import type { TriggerCondition, ManualTrackedEffect } from "./ability-components.ts";
import { TRIGGER_CHOICES } from "./ability-components.ts";

export interface TrackerTriggerGroup {
  name: string;
  entries: ResolvedEffect[];
  legacy: { ability: Ability; trigger: AbilityTrigger }[];
  eventConditions: TriggerCondition[];
}
export function triggerCategory(condition: TriggerCondition): string | undefined {
  if (condition.kind === "resource") return resourceTriggerCategory(condition.resource);
  const label = condition.label.trim();
  if (!label) return undefined;
  return TRIGGER_CHOICES.find(choice => !["Resources", "Custom"].includes(choice) && choice.toLowerCase() === label.toLowerCase()) ?? label;
}
function resourceTriggerCategory(resource: string | undefined): string | undefined {
  return resource === "dt" ? "DT Modified" : resource === "hp" ? "Health Modified" : resource === "mana" ? "Mana Modified" : undefined;
}
export function entryTriggerConditions(entry: ResolvedEffect): TriggerCondition[] {
  if (entry.input) return [...entry.input.trigger.conditions, ...entry.input.ending.conditions, ...(entry.result?.trigger.conditions ?? []), ...(entry.result?.ending.conditions ?? []), ...(entry.result?.effectOutcome === "failed-save" && (entry.result.enemySavingThrow || entry.result.saveFormula?.trim()) ? [{ id: `${entry.effect.id}:save-reference`, kind: "situation" as const, label: "Failing a Resistance Roll" }] : [])];
  return [...(entry.component?.conditions ?? []), ...(entry.createdEffect?.conditions ?? [])];
}
export function entryTriggerCategories(entry: ResolvedEffect): string[] {
  const categories = entryTriggerConditions(entry).map(triggerCategory).filter((value): value is string => !!value);
  // Old metadata remains a usable tag; do not invent event checks from prose.
  if (!entry.input) {
    for (const label of entry.effect.tracking?.situations ?? []) {
      const category = triggerCategory({ id: "", kind: "situation", label });
      if (category) categories.push(category);
    }
    if (entry.effect.tracking?.requirements?.trim() && !categories.length) categories.push("Custom");
  }
  return [...new Set(categories)];
}
/** Only actual ability tags create groups. Untagged effects and unused presets never do. */
export function groupAbilityTriggers(entries: ResolvedEffect[], abilities: Ability[]): TrackerTriggerGroup[] {
  const groups = new Map<string, TrackerTriggerGroup>();
  const group = (name: string) => {
    if (!groups.has(name)) groups.set(name, { name, entries: [], legacy: [], eventConditions: [] });
    return groups.get(name)!;
  };
  for (const entry of entries) for (const category of entryTriggerCategories(entry)) {
    const target = group(category);
    if (!target.entries.some(existing => existing.ownerFamiliar?.id === entry.ownerFamiliar?.id && existing.ability.id === entry.ability.id && existing.effect.id === entry.effect.id)) target.entries.push(entry);
    for (const condition of entryTriggerConditions(entry)) {
      if (condition.kind === "situation" && triggerCategory(condition) === category && !target.eventConditions.some(existing => existing.id === condition.id)) target.eventConditions.push(condition);
    }
  }
  for (const ability of abilities.filter(ability => !ability.definition && !ability.components)) for (const trigger of ability.triggers ?? []) {
    const category = resourceTriggerCategory(trigger.resource);
    if (category) group(category).legacy.push({ ability, trigger });
  }
  const order = ["DT Modified", "Health Modified", "Mana Modified", ...TRIGGER_CHOICES.filter(choice => choice !== "Resources")];
  const position = (name: string) => order.includes(name) ? order.indexOf(name) : order.indexOf("Custom");
  return [...groups.values()].sort((a, b) => position(a.name) - position(b.name));
}
export function manualTriggerCategories(effect: ManualTrackedEffect): string[] {
  return [...new Set([...(effect.conditions ?? []).map(triggerCategory), ...(effect.situations ?? []).map(label => triggerCategory({ id: "", kind: "situation", label }))].filter((value): value is string => !!value))];
}
