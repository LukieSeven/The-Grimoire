import { expandAttachedEffects } from "./effect-details.ts";
import type { Ability, Familiar } from "./storage.ts";
import { buildFormulaVars, calculateAbilityEvolutions, EVOLUTION_THRESHOLDS_TABLE, parseFormulaOrNum } from "./storage.ts";
import { BONUS_FIELDS, bonusesFromSummary, normalizeBonuses, hasModifierValue } from "./ability-bonuses.ts";
import type { ResolvedEffect } from "./tracker.ts";
import type { TriggerContext, RequirementState } from "./ability-components.ts";
import { evaluateRequirements } from "./ability-components.ts";
import { durationLabel, activeInputEntries, normalizeDurationType, durationTriggerGroups, isMovementEffect, rollBonusKind, type RequirementGroup } from "./ability-input.ts";
import { isManualTriggerActivation } from "./ability-use-action.ts";
import { getFamiliarAdjusted } from "./familiar-values.ts";
const combine = (a: RequirementState, b: RequirementState): RequirementState => a === "unmet" || b === "unmet" ? "unmet" : a === "judgment" || b === "judgment" ? "judgment" : "met";

/** Reference checks are notes. Only a player can confirm a tabletop event. */
const evaluatedConditions = (group: RequirementGroup, confirmEvents: boolean) => group.mode === "reference" ? []
  : group.conditions.filter(condition => condition.kind === "resource" || (confirmEvents && group.mode === "manual"));

/** Legacy duration tags were reminders, even when saved with the old default `manual` mode. */
function legacyDurationGroup(group: RequirementGroup, legacy: boolean): RequirementGroup {
  if (!legacy || group.mode !== "manual" || !group.conditions.some(condition => condition.kind === "situation")) return group;
  return { ...group, mode: group.conditions.some(condition => condition.kind === "resource") ? "automatic" : "reference" };
}

export function resolveAbilityInput(ability: Ability, rank: string, stats: Record<string, number>, context?: TriggerContext, confirmations: Record<string, boolean> = {}, familiars: Familiar[] = []): ResolvedEffect[] {
  if (!ability.definition) return [];
  const inputs = activeInputEntries(ability.definition, familiars);
  const familiarValues = new WeakMap<Familiar, ReturnType<typeof getFamiliarAdjusted>>();
  const entries: ResolvedEffect[] = inputs.flatMap(({ input: saved, familiar }) => {
    const node = { ...saved, durationType: normalizeDurationType(saved.durationType) };
    const durationTriggers = durationTriggerGroups(node);
    node.trigger = legacyDurationGroup(durationTriggers.activation, !!saved.durationTrigger);
    node.ending = legacyDurationGroup(durationTriggers.ending, !!saved.durationTrigger);
    let adjusted = familiar ? familiarValues.get(familiar) : undefined;
    if (familiar && !adjusted) {
      // Familiar adjustment has no live roster. Its portable summon snapshots
      // are nested copies, so calculation can descend without revisiting an owner.
      adjusted = getFamiliarAdjusted(familiar);
      familiarValues.set(familiar, adjusted);
    }
    const ownerStats = adjusted?.stats ?? stats;
    const ownerRank = familiar?.className ?? rank;
    const ownerConfirmations = familiar ? familiar.triggerConfirmations ?? {} : confirmations;
    const ownerContext = familiar && adjusted ? { hp: familiar.currentHp, mana: familiar.currentMana, dt: familiar.currentDt, maxHp: adjusted.maxHp, maxMana: adjusted.maxMana, maxDt: adjusted.maxDt } : context;
    const variables = buildFormulaVars({ ...ownerStats, rank: ownerRank });
    const progression = calculateAbilityEvolutions({ ...ability, linkedStats: node.linkedStats, primaryStat: node.linkedStats[0] ?? "", evolutionModifiers: EVOLUTION_THRESHOLDS_TABLE.map(step => ({ id: step.rankLabel, name: step.rankLabel, rankLabel: step.rankLabel, requiredStat: step.requiredStat, effect: "" })) }, ownerRank, ownerStats);
    const earned = (id: string) => progression.activeModifiers.some(modifier => modifier.id === id);
    const state = !node.unlockRank || earned(node.unlockRank) ? "unlocked" : progression.earnedDormantModifiers.some(modifier => modifier.id === node.unlockRank) ? "dormant" : "locked";
    // The current form owns these fields. Preserve older upgrade data in saved
    // files, but do not inject uneditable descriptions or field overrides.
    const manualActivation = isManualTriggerActivation(node);
    const triggers = evaluatedConditions(node.trigger, node.durationType === "When Triggered");
    const endings = evaluatedConditions(node.ending, node.durationType === "Until Triggered");
    const parentRequirements = evaluateRequirements(triggers, node.trigger.match, ownerContext, ownerConfirmations);
    const ended = endings.length > 0 && evaluateRequirements(endings, node.ending.match, ownerContext, ownerConfirmations) === "met";
    const automatic = node.durationType === "Always On" || (
      !manualActivation && (node.durationType === "When Triggered" || node.trigger.mode === "automatic") &&
      triggers.some(condition => condition.kind === "resource")
    );
    const radius = node.rangeType === "Aura" && node.range.trim() && Number.isFinite(Number(node.range)) ? Number(node.range) : undefined;
    const tracking = { radius, radiusUnit: radius === undefined ? undefined : "ft", situations: node.trigger.conditions.filter(condition => condition.kind === "situation").map(condition => condition.label) };
    const available = (requirements: RequirementState): ResolvedEffect["applicability"] => state !== "unlocked" || requirements === "unmet" || ended ? "unavailable" : requirements === "judgment" ? "requires judgment" : "available";
    const parent: ResolvedEffect = {
      ability, familiar, input: node, targetLabels: node.targets, requirements: parentRequirements, progression: state,
      effect: { id: node.id, name: node.name, description: "", duration: durationLabel(node.durationType, node.duration), tracking },
      applicability: available(parentRequirements), permanent: state === "unlocked" && !ended && automatic && parentRequirements === "met", endingMet: ended,
    };
    return [parent, ...node.results.filter(result => node.targets.includes(result.target)).flatMap(expandAttachedEffects).map(savedResult => {
      const selectedTemplate = savedResult.templateId ? ability.definition?.options.effects.find(effect => effect.id === savedResult.templateId) : undefined;
      const effectDefinition = selectedTemplate?.definition;
      const effectResult = effectDefinition?.results.find(result => result.target === savedResult.target) ?? effectDefinition?.results[0];
      const configuredResult = effectResult ? { ...savedResult, bonuses: savedResult.bonuses ?? effectResult.bonuses, formula: savedResult.formula || effectResult.formula, rollBonusKind: savedResult.rollBonusKind ?? (!savedResult.formula && !rollBonusKind(savedResult.purpose) ? effectResult.rollBonusKind : undefined), rules: savedResult.rules || effectResult.rules, durationType: savedResult.durationType || effectDefinition?.durationType || effectResult.durationType, duration: savedResult.duration || effectDefinition?.duration || effectResult.duration, durationTrigger: savedResult.durationTrigger ?? effectDefinition?.durationTrigger ?? effectResult.durationTrigger, trigger: { ...savedResult.trigger, conditions: [...(effectDefinition?.trigger.conditions ?? []), ...effectResult.trigger.conditions, ...savedResult.trigger.conditions] }, ending: { ...savedResult.ending, conditions: [...(effectDefinition?.ending.conditions ?? []), ...effectResult.ending.conditions, ...savedResult.ending.conditions] }, stacking: savedResult.stacking ?? effectResult.stacking, maxStacks: savedResult.maxStacks ?? effectResult.maxStacks } : savedResult;
      const resultDuration = normalizeDurationType(configuredResult.durationType || node.durationType);
      const effective = durationTriggerGroups(configuredResult, resultDuration);
      const movement = isMovementEffect(configuredResult.effectAction) ? configuredResult.effectAction : undefined;
      const result = { ...configuredResult, trigger: legacyDurationGroup(effective.activation, !!configuredResult.durationTrigger), ending: legacyDurationGroup(effective.ending, !!configuredResult.durationTrigger), ...(movement ? { bonuses: undefined } : {}) };
      const legacyBonuses = movement ? undefined : bonusesFromSummary(result.rules);
      const bonuses = result.bonuses ? normalizeBonuses(result.bonuses) : legacyBonuses;
      const bonusReadout = bonuses ? BONUS_FIELDS.filter(([key]) => hasModifierValue(bonuses[key])).map(([key, label]) => `${label}: ${parseFormulaOrNum(bonuses[key], variables)}`).concat(["resistances", "immunities", "vulnerabilities"].flatMap(key => bonuses[key as "resistances" | "immunities" | "vulnerabilities"]?.trim() ? [`${key}: ${bonuses[key as "resistances" | "immunities" | "vulnerabilities"]}`] : [])) : [];
      const template = result.templateId ? ability.definition?.options.effects.find(effect => effect.id === result.templateId) : undefined;
      const resultTriggers = evaluatedConditions(result.trigger, resultDuration === "When Triggered");
      const resultEndings = evaluatedConditions(result.ending, resultDuration === "Until Triggered");
      const own = evaluateRequirements(resultTriggers, result.trigger.match, ownerContext, ownerConfirmations);
      const ownEnded = resultEndings.length > 0 && evaluateRequirements(resultEndings, result.ending.match, ownerContext, ownerConfirmations) === "met";
      const requirements = combine(parentRequirements, own);
      return {
        ability, familiar, input: node, result, targetLabels: [result.target], requirements, applicationRequirements: own, progression: state,
        effect: { ...bonuses, id: result.id, name: node.name, description: [movement, legacyBonuses ? "" : result.rules || template?.rules, ...bonusReadout, (result.value || template?.value) ? `Value: ${result.value || template?.value}` : ""].filter(Boolean).join("\n"), rollFormula: movement || result.attachedEffectOnly ? "" : result.formula,
          duration: durationLabel(result.durationType || node.durationType, result.durationType ? result.duration : result.duration || node.duration),
          tracking: { ...tracking, radius: result.lifetime === "source" ? radius : undefined, situations: [...tracking.situations, ...result.trigger.conditions.filter(condition => condition.kind === "situation").map(condition => condition.label)] } },
        applicability: ownEnded ? "unavailable" : available(requirements),
        permanent: (!result.effectOutcome || result.effectOutcome === "always") && result.lifetime === "independent" && result.target === "Self" && result.trigger.mode === "automatic" && resultTriggers.length > 0 && state === "unlocked" && !ended && !ownEnded && requirements === "met",
        endingMet: ownEnded,
        sharedActivation: (!result.effectOutcome || result.effectOutcome === "always") && result.lifetime === "source" ? { effectId: node.id, automatic, ready: !ended && parentRequirements === "met", aura: node.rangeType === "Aura", selfTarget: result.target === "Self" } : undefined,
      } satisfies ResolvedEffect;
    })];
  });
  // Triggered alternate effects depend on their immediate source ability, not a hidden editor mode.
  for (const entry of entries) {
    const parentId = inputs.find(item => item.input.id === entry.input?.id)?.parentId;
    if (parentId && entry.input?.durationType === "When Triggered" && evaluatedConditions(entry.input.trigger, true).length > 0) {
      entry.triggerParent = entries.find(candidate => !candidate.result && candidate.input?.id === parentId);
    }
  }
  return entries;
}
