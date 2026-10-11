import { calculateAbilityEvolutions, isAbilityTriggerActive, EVOLUTION_THRESHOLDS_TABLE } from "./storage.ts";
import type { Ability, AbilityEffect, Familiar } from "./storage.ts";
import type { EffectApplication } from "./tracker-types.ts";
import { evaluateRequirements, conditionText } from "./ability-components.ts";
import type { AbilityComponent, CreatedEffect, TriggerContext, RequirementState } from "./ability-components.ts";
import type { AbilityInput, TargetResult } from "./ability-input.ts";
import { resolveAbilityInput } from "./ability-input-tracker.ts";

export interface ResolvedEffect {
  ownerFamiliar?: Familiar;
  triggerParent?: ResolvedEffect;
  familiar?: Familiar;
  input?: AbilityInput;
  result?: TargetResult;
  targetLabels?: string[];
  endingMet?: boolean;
  ability: Ability;
  effect: AbilityEffect;
  applicability: "available" | "requires judgment" | "unavailable";
  progression: "unlocked" | "dormant" | "locked";
  permanent: boolean;
  component?: AbilityComponent;
  requirements?: RequirementState;
  createdEffect?: CreatedEffect;
  applicationRequirements?: RequirementState;
  sharedActivation?: { effectId: string; automatic: boolean; ready: boolean; aura?: boolean; selfTarget?: boolean };
}

/** Derive presentation mechanics without modifying the saved ability or progression rules. */
export function resolveTrackerEffects(abilities: Ability[], rank: string, stats: Record<string, number>, context?: TriggerContext, confirmations: Record<string, boolean> = {}, familiars: Familiar[] = []): ResolvedEffect[] {
  return abilities.flatMap(ability => {
    if (ability.definition) return resolveAbilityInput(ability, rank, stats, context, confirmations, familiars);
    const progression = calculateAbilityEvolutions(ability, rank, stats);
    const componentProgression = calculateAbilityEvolutions({ ...ability, evolutionModifiers: EVOLUTION_THRESHOLDS_TABLE.map(step => ({ id: step.rankLabel, name: step.rankLabel, rankLabel: step.rankLabel, requiredStat: step.requiredStat, effect: "" })) }, rank, stats);
    const progressionFor = (id: string) => EVOLUTION_THRESHOLDS_TABLE.some(step => step.rankLabel === id) ? componentProgression : progression;
    const originals: AbilityEffect[] = ability.components ? ability.components.map(component => ({
      id: component.id, name: component.name, description: component.rules,
      duration: component.duration, rollFormula: component.rollFormula,
      category: component.kinds.join(", "),
      tracking: {
        targets: component.targets.filter((target): target is "self" | "allies" | "enemies" => target !== "custom"),
        ...(component.kinds.includes("aura") ? { radius: component.radius, radiusUnit: component.radiusUnit } : {}),
        permanent: component.behaviors.includes("always-on"),
        requirements: component.conditions?.map(conditionText).join(component.conditionMatch === "any" ? " OR " : " AND "),
        situations: [...new Set([...(component.situations ?? []), ...(component.conditions?.filter(condition => condition.kind === "situation").map(condition => condition.label) ?? [])])],
        unlockedByModifierId: component.unlockedByModifierId,
      },
    })) : ability.abilityEffects ?? [];
    for (const component of ability.components ?? []) {
      for (const created of component.createdEffects ?? []) originals.push({
        id: created.id, name: created.name, description: created.rules, duration: created.duration, rollFormula: created.rollFormula,
        tracking: {
          targets: created.targets.filter((target): target is "self" | "allies" | "enemies" => target !== "custom"),
          requirements: created.conditions?.map(conditionText).join(created.conditionMatch === "any" ? " OR " : " AND "),
          situations: [...new Set([...(created.situations ?? []), ...(component.situations ?? []), ...(created.conditions?.filter(condition => condition.kind === "situation").map(condition => condition.label) ?? [])])],
          unlockedByModifierId: component.unlockedByModifierId,
        },
      });
    }
    return originals.map(original => {
      let component = ability.components?.find(entry => entry.id === original.id || entry.createdEffects?.some(created => created.id === original.id));
      const createdEffect = component?.createdEffects?.find(created => created.id === original.id);
      if (component) {
        component = { ...component };
        for (const evolution of component.evolutions ?? []) {
          if (!progressionFor(evolution.modifierId).activeModifiers.some(modifier => modifier.id === evolution.modifierId)) continue;
          if (evolution.radius !== undefined) component.radius = evolution.radius;
          if (evolution.rules !== undefined) component.rules = evolution.rules;
          if (evolution.duration !== undefined) component.duration = evolution.duration;
          if (evolution.rollFormula !== undefined) component.rollFormula = evolution.rollFormula;
        }
      }
      const gate = original.tracking?.unlockedByModifierId;
      const gateProgression = gate ? progressionFor(gate) : progression;
      const state = !gate || gateProgression.activeModifiers.some(modifier => modifier.id === gate) ? "unlocked" as const
        : gateProgression.earnedDormantModifiers.some(modifier => modifier.id === gate) ? "dormant" as const : "locked" as const;
      let effect: AbilityEffect = { ...original, tracking: original.tracking ? { ...original.tracking } : undefined };
      if (component && !createdEffect) {
        effect.description = component.rules; effect.duration = component.duration; effect.rollFormula = component.rollFormula;
        if (component.kinds.includes("aura")) effect.tracking = { ...effect.tracking, radius: component.radius };
      }
      for (const modifier of progression.activeModifiers) {
        for (const change of modifier.effectChanges ?? []) {
          if (change.effectId !== original.id) continue;
          if (change.radius !== undefined) effect.tracking = { ...effect.tracking, radius: change.radius };
          if (change.duration !== undefined) effect.duration = change.duration;
          if (change.description !== undefined) effect.description = change.description;
          if (change.rollFormula !== undefined) effect.rollFormula = change.rollFormula;
        }
      }
      const parentRequirements = component ? evaluateRequirements(component.conditions, component.conditionMatch, context, confirmations) : undefined;
      const applicationRequirements = createdEffect ? evaluateRequirements(createdEffect.conditions, createdEffect.conditionMatch, context, confirmations) : undefined;
      const requirements = createdEffect
        ? parentRequirements === "unmet" || applicationRequirements === "unmet" ? "unmet" : parentRequirements === "judgment" || applicationRequirements === "judgment" ? "judgment" : "met"
        : parentRequirements;
      const automatic = component?.triggerMode === "automatic" && !!component.conditions?.length && requirements === "met";
      const ongoing = createdEffect?.delivery === "ongoing";
      if (ongoing && component?.kinds.includes("aura")) effect.tracking = { ...effect.tracking, radius: component.radius, radiusUnit: component.radiusUnit };
      if (ongoing) effect.duration ??= component?.duration;
      return {
        ability, effect,
        component, requirements, createdEffect, applicationRequirements,
        sharedActivation: ongoing && component ? {
          effectId: component.id,
          ready: parentRequirements === "met",
          automatic: component.behaviors.includes("always-on") || (component.triggerMode === "automatic" && !!component.conditions?.length),
        } : undefined,
        progression: state,
        applicability: state !== "unlocked" || requirements === "unmet" ? "unavailable" as const : component ? requirements === "judgment" ? "requires judgment" as const : "available" as const : !effect.tracking || effect.tracking.requirements ? "requires judgment" as const : "available" as const,
        permanent: !createdEffect && state === "unlocked" && (component
          ? requirements === "met" && (component.behaviors.includes("always-on") || automatic) && (component.kinds.includes("aura") || component.targets.includes("self") || !!component.createdEffects?.some(effect => effect.delivery === "ongoing"))
          : effect.tracking?.permanent === true && effect.tracking.targets?.includes("self") === true && !effect.tracking.requirements),
      };
    });
  });
}

export function isEffectApplied(entry: ResolvedEffect, targetId: string, applications: EffectApplication[]): boolean {
  const sourceApplications = entry.ownerFamiliar?.effectApplications ?? applications;
  const targetApplications = targetId === "self" ? sourceApplications : applications;
  if (entry.triggerParent && !isEffectApplied(entry.triggerParent, "self", applications)) return false;
  if (entry.progression !== "unlocked" || entry.endingMet) return false;
  if (entry.sharedActivation) {
    if (!entry.sharedActivation.ready || entry.applicationRequirements !== "met") return false;
    const parentActive = entry.sharedActivation.automatic || sourceApplications.some(application => application.abilityId === entry.ability.id && application.effectId === entry.sharedActivation!.effectId && application.targetId === "self");
    if (!parentActive) return false;
    // The aura's origin displays all its active effects, not automatic applications to nearby creatures.
    if (targetId === "self" && (entry.sharedActivation.aura || entry.sharedActivation.selfTarget || entry.component?.kinds.includes("aura") || entry.createdEffect?.targets.includes("self"))) return true;
  }
  if (entry.input && (entry.result ? entry.applicationRequirements !== "met" : entry.requirements !== "met")) return false;
  if (entry.createdEffect ? entry.applicationRequirements !== "met" : entry.component && entry.requirements !== "met") return false;
  return (targetId === "self" && entry.permanent) || targetApplications.some(application =>
    (targetId === "self" || application.familiarId === entry.ownerFamiliar?.id) && application.abilityId === entry.ability.id && (application.effectId === entry.effect.id || entry.result?.attachedEffectOnly && application.effectId === entry.effect.id.split(":effect:")[0] && application.templateId === entry.result.templateId) && application.targetId === targetId);
}

export { isAbilityTriggerActive };
