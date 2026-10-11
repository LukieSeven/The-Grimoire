import { expandAttachedEffects } from "./effect-details.ts";
import type { Ability, Familiar } from "./storage.ts";
import { calculateAbilityEvolutions, EVOLUTION_THRESHOLDS_TABLE, parseFormulaOrNum, getModifierForStat } from "./storage.ts";
import { BONUS_FIELDS, bonusesFromSummary, normalizeBonuses, hasModifierValue } from "./ability-bonuses.ts";
import type { ResolvedEffect } from "./tracker.ts";
import type { TriggerContext, RequirementState } from "./ability-components.ts";
import { evaluateRequirements } from "./ability-components.ts";
import { durationLabel, activeInputEntries, normalizeDurationType, durationTriggerGroups } from "./ability-input.ts";
import { getFamiliarMaxValues } from "./familiar-values.ts";
const combine = (a: RequirementState, b: RequirementState): RequirementState => a === "unmet" || b === "unmet" ? "unmet" : a === "judgment" || b === "judgment" ? "judgment" : "met";
export function resolveAbilityInput(ability: Ability, rank: string, stats: Record<string, number>, context?: TriggerContext, confirmations: Record<string, boolean> = {}, familiars: Familiar[] = []): ResolvedEffect[] {
  if (!ability.definition) return [];
  const inputs = activeInputEntries(ability.definition, familiars);
  const entries: ResolvedEffect[] = inputs.flatMap(({ input: saved, familiar }) => {
    const node = { ...saved, durationType: normalizeDurationType(saved.durationType) };
    const durationTriggers = durationTriggerGroups(node);
    node.trigger = durationTriggers.activation;
    node.ending = durationTriggers.ending;
    const ownerStats = familiar ? Object.fromEntries(["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"].map(stat => [stat, familiar[stat as keyof Familiar] as number])) : stats;
    const maximums = familiar ? getFamiliarMaxValues(familiar) : undefined;
    const ownerContext = familiar && maximums ? { hp: familiar.currentHp, mana: familiar.currentMana, dt: familiar.currentDt, maxHp: maximums.maxHp, maxMana: maximums.maxMana, maxDt: maximums.maxDt } : context;
    const progression = calculateAbilityEvolutions({ ...ability, linkedStats: node.linkedStats, primaryStat: node.linkedStats[0] ?? "", evolutionModifiers: EVOLUTION_THRESHOLDS_TABLE.map(step => ({ id: step.rankLabel, name: step.rankLabel, rankLabel: step.rankLabel, requiredStat: step.requiredStat, effect: "" })) }, rank, ownerStats);
    const earned = (id: string) => progression.activeModifiers.some(modifier => modifier.id === id);
    const state = !node.unlockRank || earned(node.unlockRank) ? "unlocked" : progression.earnedDormantModifiers.some(modifier => modifier.id === node.unlockRank) ? "dormant" : "locked";
    // The current form owns these fields. Preserve older upgrade data in saved
    // files, but do not inject uneditable descriptions or field overrides.
    const resourceTriggers = node.trigger.conditions.filter(condition => condition.kind === "resource");
    const resourceEndings = node.ending.conditions.filter(condition => condition.kind === "resource");
    const parentRequirements = evaluateRequirements(resourceTriggers, node.trigger.match, ownerContext, confirmations);
    const ended = resourceEndings.length > 0 && evaluateRequirements(resourceEndings, node.ending.match, ownerContext, confirmations) === "met";
    const automatic = node.durationType === "Always On" || (node.durationType === "When Triggered" || node.trigger.mode === "automatic") && resourceTriggers.length > 0;
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
      const configuredResult = effectResult ? { ...savedResult, bonuses: savedResult.bonuses ?? effectResult.bonuses, formula: savedResult.formula || effectResult.formula, rules: savedResult.rules || effectResult.rules, durationType: savedResult.durationType || effectDefinition?.durationType || effectResult.durationType, duration: savedResult.duration || effectDefinition?.duration || effectResult.duration, durationTrigger: savedResult.durationTrigger ?? effectDefinition?.durationTrigger ?? effectResult.durationTrigger, trigger: { ...savedResult.trigger, conditions: [...(effectDefinition?.trigger.conditions ?? []), ...effectResult.trigger.conditions, ...savedResult.trigger.conditions] }, ending: { ...savedResult.ending, conditions: [...(effectDefinition?.ending.conditions ?? []), ...effectResult.ending.conditions, ...savedResult.ending.conditions] }, stacking: savedResult.stacking ?? effectResult.stacking, maxStacks: savedResult.maxStacks ?? effectResult.maxStacks } : savedResult;
      const effective = durationTriggerGroups(configuredResult, configuredResult.durationType || node.durationType);
      const result = { ...configuredResult, trigger: effective.activation, ending: effective.ending };
      const bonuses = result.bonuses ? normalizeBonuses(result.bonuses) : bonusesFromSummary(result.rules);
      const variables: Record<string, number> = { ...ownerStats };
      for (const [stat, value] of Object.entries(ownerStats)) {
        const prefix = stat.slice(0, 3);
        variables[prefix] = value;
        variables[`${prefix}r`] = getModifierForStat(value, rank);
      }
      const bonusReadout = bonuses ? BONUS_FIELDS.filter(([key]) => hasModifierValue(bonuses[key])).map(([key, label]) => `${label}: ${parseFormulaOrNum(bonuses[key], variables)}`).concat(["resistances", "immunities", "vulnerabilities"].flatMap(key => bonuses[key as "resistances" | "immunities" | "vulnerabilities"]?.trim() ? [`${key}: ${bonuses[key as "resistances" | "immunities" | "vulnerabilities"]}`] : [])) : [];
      const template = result.templateId ? ability.definition?.options.effects.find(effect => effect.id === result.templateId) : undefined;
      const resultResources = result.trigger.conditions.filter(condition => condition.kind === "resource");
      const resultEndings = result.ending.conditions.filter(condition => condition.kind === "resource");
      const own = evaluateRequirements(resultResources, result.trigger.match, ownerContext, confirmations);
      const ownEnded = resultEndings.length > 0 && evaluateRequirements(resultEndings, result.ending.match, ownerContext, confirmations) === "met";
      const requirements = combine(parentRequirements, own);
      return {
        ability, familiar, input: node, result, targetLabels: [result.target], requirements, applicationRequirements: own, progression: state,
        effect: { ...bonuses, id: result.id, name: node.name, description: [bonusesFromSummary(result.rules) ? "" : result.rules || template?.rules, ...bonusReadout, (result.value || template?.value) ? `Value: ${result.value || template?.value}` : ""].filter(Boolean).join("\n"), rollFormula: result.attachedEffectOnly ? "" : result.formula,
          duration: durationLabel(result.durationType || node.durationType, result.durationType ? result.duration : result.duration || node.duration),
          tracking: { ...tracking, radius: result.lifetime === "source" ? radius : undefined, situations: [...tracking.situations, ...result.trigger.conditions.filter(condition => condition.kind === "situation").map(condition => condition.label)] } },
        applicability: ownEnded ? "unavailable" : available(requirements),
        permanent: (!result.effectOutcome || result.effectOutcome === "always") && result.lifetime === "independent" && result.target === "Self" && result.trigger.mode === "automatic" && resultResources.length > 0 && state === "unlocked" && !ended && !ownEnded && requirements === "met",
        endingMet: ownEnded,
        sharedActivation: (!result.effectOutcome || result.effectOutcome === "always") && result.lifetime === "source" ? { effectId: node.id, automatic, ready: !ended && parentRequirements === "met", aura: node.rangeType === "Aura", selfTarget: result.target === "Self" } : undefined,
      } satisfies ResolvedEffect;
    })];
  });
  // Triggered alternate effects depend on their immediate source ability, not a hidden editor mode.
  for (const entry of entries) {
    const parentId = inputs.find(item => item.input.id === entry.input?.id)?.parentId;
    if (parentId && entry.input?.durationType === "When Triggered" && entry.input.trigger.conditions.some(condition => condition.kind === "resource")) {
      entry.triggerParent = entries.find(candidate => !candidate.result && candidate.input?.id === parentId);
    }
  }
  return entries;
}
