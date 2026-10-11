import type { AbilityOptions, TargetResult } from "./ability-input.ts";
import { BONUS_FIELDS, hasModifierValue } from "./ability-bonuses.ts";
const common: Record<string, string> = {
  Stunned: "Unable to act normally. Follow the source ability's restrictions.", Prone: "Knocked down or lying on the ground.", Restrained: "Movement is restricted by a restraint.", Grappled: "Held by another creature or effect.", Incapacitated: "Unable to take normal actions.", Blinded: "Unable to see.", Deafened: "Unable to hear.", Silenced: "Unable to speak or use abilities requiring speech, as specified by the source.", Invisible: "Not visible to ordinary sight.", Fear: "Fear affects actions or movement as described by the source.", Bleeding: "A bleeding condition; follow the source's damage and ending rules.", Burning: "A fire-related condition; follow the source's damage and ending rules.", Poisoned: "Affected by poison; use the source's penalties and duration.", Paralyzed: "Unable to move voluntarily.", Petrified: "Transformed into stone or a similar immobile state.", Unconscious: "Not conscious or able to act voluntarily.", Charmed: "Influenced by another creature; use the source's restrictions.", Slowed: "Movement or actions are reduced as specified by the source.", Exhausted: "Fatigue imposes the source's penalties.",
};
export function attachedEffects(result: TargetResult): NonNullable<TargetResult["effects"]> {
  return result.effects ?? (result.templateId ? [{ templateId: result.templateId, outcome: "always" }] : []);
}
export function effectDetails(id: string, options: AbilityOptions) {
  if (id.startsWith("common:")) { const name = id.slice(7); return { name, description: common[name] ?? "Follow the source ability's rules." }; }
  const effect = options.effects.find(effect => effect.id === id);
  if (!effect) return { name: "Saved effect", description: "This effect definition is not available in the loaded settings." };
  const definition = effect.definition;
  const details = [effect.rules, ...definition?.results.flatMap(result => [result.rules, result.formula?.trim() ? `Formula: ${result.formula}` : "", ...BONUS_FIELDS.filter(([key]) => hasModifierValue(result.bonuses?.[key])).map(([key, label]) => `${label}: ${result.bonuses![key]}`), ...(["resistances", "immunities", "vulnerabilities"] as const).flatMap(key => result.bonuses?.[key]?.trim() ? [`${key}: ${result.bonuses[key]}`] : []), hasModifierValue(result.bonuses?.bonusResistanceRoll) && result.bonuses?.resistanceAttributes?.length ? `Resistance attributes: ${result.bonuses.resistanceAttributes.join(", ")}` : "", hasModifierValue(result.bonuses?.bonusSkillCheck) && result.bonuses?.checkSkills?.length ? `Applies to: ${result.bonuses.checkSkills.join(", ")}` : "", result.stacking ? `Stacking: ${result.stacking}${result.maxStacks !== undefined ? ` (maximum ${result.maxStacks})` : ""}` : ""]) ?? [], definition ? [definition.durationType, definition.duration].filter(Boolean).join(" · ") : ""].filter(value => value?.trim());
  return { name: effect.name, description: [...new Set(details)].join("\n") || "Follow the source ability's rules." };
}
export function outcomeLabel(outcome?: string) { return outcome === "success" ? "On a successful roll" : outcome === "failed-save" ? "When the target fails its save" : "Applies regardless of the roll or save outcome"; }
export function saveReference(result: TargetResult): string {
  return [result.enemySavingThrow ? `Enemy Saving Throw: ${result.enemySavingThrow}` : "", result.saveFormula?.trim() ? `Save Formula (must beat): ${result.saveFormula}` : ""].filter(Boolean).join("\n");
}
export function expandAttachedEffects(result: TargetResult): TargetResult[] {
  // Legacy single-effect records retain their identity and application history.
  if (!result.effects) return [result];
  const effects = attachedEffects(result);
  return [{ ...result, templateId: undefined }, ...effects.map(effect => ({ ...result, id: `${result.id}:effect:${encodeURIComponent(effect.templateId)}:${effect.outcome}`, templateId: effect.templateId, effectOutcome: effect.outcome, attachedEffectOnly: true, effects: undefined, rules: "", formula: "", bonuses: undefined, lifetime: effect.outcome === "always" ? result.lifetime : "independent" as const }))];
}
