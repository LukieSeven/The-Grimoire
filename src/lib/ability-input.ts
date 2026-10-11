import type { Ability, SubAbility, AbilityEffect, Familiar } from "./storage.ts";
import type { TriggerCondition } from "./ability-components.ts";
import { bonusesFromSummary, readAbilityBonuses, normalizeBonuses } from "./ability-bonuses.ts";
import type { AbilityBonuses } from "./ability-bonuses.ts";

export const DURATION_TYPES = ["Always On", "While Active", "Instant", "Time", "Until Dispelled", "When Triggered", "Until Triggered", "Until Next Turn", "Until Used", "Until Combat Ends", "Until Rest"];
export const TARGET_TYPES = ["Self", "Ally", "Enemy", "Summon", "Object", "Location"];
export const normalizeDurationType = (value: string): string => value === "Concentration" ? "While Active" : value;
export const showsTriggerInput = (durationType: string): boolean => ["When Triggered", "Until Triggered"].includes(durationType);
export const RANGE_TYPES = ["Self", "Touch", "Ranged", "Aura", "Sight", "Unlimited"];
export const RANGED_TARGETING = ["Single Target", "Multiple Targets", "Chain / Bounce", "Target-Centered AoE", "Point-Placed AoE", "Cone", "Line / Beam", "Wall / Barrier"];
export const AREA_SHAPES = ["Circle / Sphere", "Cube / Box", "Cylinder / Column", "Ring / Hollow Area"];
export type CustomChoiceCategory = "durationTypes" | "rangeTypes" | "targets" | "rangedTargeting" | "areaShapes" | "triggers" | "effects";
export const ROLL_PURPOSES = ["Damage", "Healing", "Shielding"];
export const COMMON_EFFECTS = ["Stunned", "Prone", "Restrained", "Grappled", "Incapacitated", "Blinded", "Deafened", "Silenced", "Invisible", "Fear", "Bleeding", "Burning", "Poisoned", "Paralyzed", "Petrified", "Unconscious", "Charmed", "Slowed", "Exhausted"];
export const STACKING_RULES = ["Stack", "Highest Only", "Replace Existing", "Refresh Duration"] as const;
export interface EffectTemplate { id: string; name: string; kind: "Buff" | "Debuff"; rules: string; value?: string; definition?: AbilityInput }
export interface AbilityOptions {
  rangedTargeting?: string[]; areaShapes?: string[];
  durationTypes: string[]; rangeTypes: string[]; targets: string[]; rollPurposes: string[];
  triggers: { id: string; name: string; conditions: TriggerCondition[]; match: "all" | "any" }[];
  effects: EffectTemplate[];
}
export interface RequirementGroup {
  conditions: TriggerCondition[]; match: "all" | "any"; mode: "reference" | "manual" | "automatic";
}
export interface TargetResult {
  effects?: { templateId: string; outcome: "always" | "success" | "failed-save" }[];
  effectOutcome?: "always" | "success" | "failed-save";
  attachedEffectOnly?: boolean;
  enemySavingThrow?: string;
  saveFormula?: string;
  stacking?: typeof STACKING_RULES[number]; maxStacks?: number;
  bonuses?: AbilityBonuses;
  durationTrigger?: RequirementGroup;
  id: string; target: string; name: string; purpose: string; formula: string;
  rules: string; value: string; templateId?: string;
  effectKind?: "Buff" | "Debuff";
  durationType: string; duration: string; lifetime: "source" | "independent";
  trigger: RequirementGroup; ending: RequirementGroup;
}
export interface AbilityInput {
  rangedTargeting?: string; areaShape?: string;
  areaDimensions?: Partial<Record<"radius" | "innerRadius" | "length" | "width" | "height" | "targetCount" | "jumpRange", string>>;
  areaBehavior?: { persistent?: boolean; movable?: boolean; followsTarget?: boolean };
  durationTrigger?: RequirementGroup;
  id: string; name: string; source: string; targets: string[];
  manaCost?: number; manaPerTurn?: number; timeCost?: number; reaction: boolean;
  durationType: string; duration: string; rangeType: string; range: string;
  cooldown?: number; cooldownUnit: "Seconds" | "Minutes" | "Hours" | "Days";
  cooldownStarts: "activation" | "end";
  uses: string; recharge: string; description: string; linkedStats: string[];
  unlockRank?: string;
  upgrades: { id: string; rank: string; rules: string; range?: string; duration?: string; formula?: string; resultId?: string }[];
  trigger: RequirementGroup; ending: RequirementGroup;
  results: TargetResult[]; subAbilities: AbilityInput[];
  summon?: { familiar: Familiar; abilities: AbilityInput[] };
  options: AbilityOptions;
}
export const emptyOptions = (): AbilityOptions => ({ durationTypes: [], rangeTypes: [], targets: [], rollPurposes: [], rangedTargeting: [], areaShapes: [], triggers: [], effects: [] });
export function rangedDimensionKeys(input: AbilityInput): (keyof NonNullable<AbilityInput["areaDimensions"]>)[] {
  if (input.rangeType !== "Ranged") return [];
  if (input.rangedTargeting === "Single Target" || !input.rangedTargeting) return [];
  if (input.rangedTargeting === "Multiple Targets") return ["targetCount"];
  if (input.rangedTargeting === "Chain / Bounce") return ["targetCount", "jumpRange"];
  if (input.rangedTargeting === "Cone") return [];
  if (["Line / Beam", "Wall / Barrier"].includes(input.rangedTargeting)) return ["length", "width", "height"];
  if (input.areaShape === "Circle / Sphere") return ["radius"];
  if (input.areaShape === "Cube / Box") return ["length", "width", "height"];
  if (input.areaShape === "Cylinder / Column") return ["radius", "height"];
  if (input.areaShape === "Ring / Hollow Area") return ["innerRadius", "radius", "height"];
  return ["radius", "length", "width", "height"];
}
export function rangedAreaSummary(input: AbilityInput): string {
  if (input.rangeType !== "Ranged") return "";
  return [input.rangedTargeting, ["Target-Centered AoE", "Point-Placed AoE"].includes(input.rangedTargeting ?? "") ? input.areaShape : undefined,
    ...rangedDimensionKeys(input).filter(key => input.areaDimensions?.[key]?.trim()).map(key => `${key === "targetCount" ? "Targets" : key === "innerRadius" ? "Inner radius" : key === "jumpRange" ? "Jump range" : key}: ${input.areaDimensions![key]}${key === "targetCount" ? "" : " ft"}`),
    ...Object.entries(!input.rangedTargeting || ["Single Target", "Multiple Targets", "Chain / Bounce"].includes(input.rangedTargeting) ? {} : input.areaBehavior ?? {}).filter(([, enabled]) => enabled).map(([key]) => key === "followsTarget" ? "Follows target" : key === "movable" ? "Movable" : "Persistent")].filter(Boolean).join(" · ");
}
export const emptyRequirements = (): RequirementGroup => ({ conditions: [], match: "all", mode: "manual" });
/** One event input, interpreted as an activation or ending trigger by Duration Type. */
export function durationTriggerGroups(value: Pick<AbilityInput, "durationType" | "durationTrigger" | "trigger" | "ending">, effectiveType = value.durationType): { activation: RequirementGroup; ending: RequirementGroup } {
  if (!value.durationTrigger) return { activation: value.trigger, ending: value.ending };
  return { activation: effectiveType === "When Triggered" ? value.durationTrigger : emptyRequirements(), ending: effectiveType === "Until Triggered" ? value.durationTrigger : emptyRequirements() };
}
export function blankAbilityInput(): AbilityInput {
  return { id: crypto.randomUUID(), name: "", source: "", targets: [], reaction: false,
    durationType: "Instant", duration: "", rangeType: "Self", range: "", cooldownUnit: "Seconds", cooldownStarts: "activation",
    uses: "", recharge: "", description: "", linkedStats: [], upgrades: [],
    trigger: emptyRequirements(), ending: emptyRequirements(), results: [], subAbilities: [], options: emptyOptions() };
}
export function blankResult(target: string): TargetResult {
  return { id: crypto.randomUUID(), target, name: "", purpose: "", formula: "", rules: "", value: "",
    durationType: "", duration: "", lifetime: "source", trigger: emptyRequirements(), ending: emptyRequirements() };
}
export function targetResults(input: AbilityInput, target: string): TargetResult[] {
  const results = input.results.filter(result => result.target === target);
  return results.length ? results : [blankResult(target)];
}
export function flattenInputs(input: AbilityInput): AbilityInput[] {
  return [input, ...input.subAbilities.flatMap(flattenInputs), ...(input.summon?.abilities ?? []).flatMap(flattenInputs)];
}
/** Recorded summons carry a portable snapshot; prefer the current minion's live values when loaded. */
export function activeInputEntries(input: AbilityInput, familiars: Familiar[] = [], actor?: Familiar, parentId?: string): { input: AbilityInput; familiar?: Familiar; parentId?: string }[] {
  const summoned = input.targets.includes("Summon") ? input.summon : undefined;
  const familiar = summoned ? familiars.find(entry => entry.id === summoned.familiar.id) ?? summoned.familiar : undefined;
  return [{ input, familiar: actor, parentId }, ...input.subAbilities.flatMap(node => activeInputEntries(node, familiars, actor, input.id)), ...(summoned?.abilities ?? []).flatMap(node => activeInputEntries(node, familiars, familiar, input.id))];
}
export function normalizeAbilityInput(input: AbilityInput): AbilityInput {
  const copy = structuredClone(input);
  for (const node of flattenInputs(copy)) {
    // Recover a previously entered cone reach only when Range was left blank.
    // Keep the original dimension metadata for lossless file compatibility.
    if (node.rangeType === "Ranged" && node.rangedTargeting === "Cone" && !node.range.trim() && node.areaDimensions?.length?.trim()) node.range = node.areaDimensions.length;
    node.durationType = normalizeDurationType(node.durationType);
    node.results = node.results.map(result => {
      const recovered = result.bonuses === undefined ? bonusesFromSummary(result.rules) : undefined;
      return { ...result, bonuses: result.bonuses ? normalizeBonuses(result.bonuses) : recovered, rules: recovered ? "" : result.rules, durationType: normalizeDurationType(result.durationType) };
    });
    node.options.durationTypes = [...new Set(node.options.durationTypes.map(normalizeDurationType))];
  }
  return copy;
}
/** Selection replaces only this imported summon block, never manually entered Sub-Abilities. */
export function selectSummon(input: AbilityInput, familiar?: Familiar): AbilityInput {
  if (!familiar) return { ...input, summon: undefined };
  const abilities = familiar.abilities.map(ability => duplicateInput(inputFromAbility(ability as Ability, familiar.name)));
  return { ...input, summon: { familiar: structuredClone(familiar), abilities } };
}
export function durationLabel(type: string, value: string): string {
  return [normalizeDurationType(type), value].filter(Boolean).join(" · ");
}
function existingRange(value: string): Pick<AbilityInput, "rangeType" | "range"> {
  const distance = value.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet)\s*(.*)$/i);
  if (distance) return { rangeType: distance[2].trim() || "Ranged", range: distance[1] };
  return { rangeType: value.trim() || "Self", range: "" };
}
function existingBonuses(value: Partial<Ability | SubAbility | AbilityEffect>): string {
  return Object.entries(value).filter(([key, entry]) => (/^bonus|^(hp|mana|dt)(Add|Buff)$/.test(key) || ["resistances", "immunities"].includes(key)) && entry !== undefined && entry !== "" && entry !== 0).map(([key, entry]) => `${key}: ${entry}`).join("\n");
}
export function mergeOptions(...sets: (AbilityOptions | undefined)[]): AbilityOptions {
  const result = emptyOptions();
  for (const set of sets) {
    if (!set) continue;
    for (const key of ["durationTypes", "rangeTypes", "targets", "rollPurposes", "rangedTargeting", "areaShapes"] as const) result[key] = [...new Set([...(result[key] ?? []), ...(set[key] ?? []).map(value => key === "durationTypes" ? normalizeDurationType(value) : value)])];
    for (const key of ["triggers", "effects"] as const) {
      // Retain imported definitions even when another file reused its ID.
      for (const entry of set[key]) if (!result[key].some(existing => JSON.stringify(existing) === JSON.stringify(entry))) {
        if (key === "triggers") result.triggers.push(entry as AbilityOptions["triggers"][number]);
        else result.effects.push(entry as EffectTemplate);
      }
    }
  }
  return result;
}
export function duplicateInput(input: AbilityInput): AbilityInput {
  const copy = structuredClone(input);
  const fresh = (group: RequirementGroup) => ({ ...group, conditions: group.conditions.map(condition => ({ ...condition, id: crypto.randomUUID() })) });
  copy.id = crypto.randomUUID(); copy.trigger = fresh(copy.trigger); copy.ending = fresh(copy.ending);
  if (copy.durationTrigger) copy.durationTrigger = fresh(copy.durationTrigger);
  copy.results = copy.results.map(result => ({ ...result, id: crypto.randomUUID(), trigger: fresh(result.trigger), ending: fresh(result.ending), durationTrigger: result.durationTrigger ? fresh(result.durationTrigger) : undefined }));
  copy.upgrades = copy.upgrades.map(upgrade => ({ ...upgrade, id: crypto.randomUUID() }));
  copy.subAbilities = copy.subAbilities.map(duplicateInput);
  if (copy.summon) copy.summon.abilities = copy.summon.abilities.map(duplicateInput);
  return copy;
}
/** Explicit editor conversion only. Never rewrites an imported record until Save. */
export function inputFromAbility(ability: Ability, source: string): AbilityInput {
  if (ability.definition) return normalizeAbilityInput(ability.definition);
  const root = { ...blankAbilityInput(), id: `ability:${ability.id}`, name: ability.name, source,
    description: ability.description, linkedStats: ability.linkedStats ?? [], manaCost: ability.cost || undefined,
    cooldown: ability.cooldown || undefined, ...existingRange(ability.range ?? ""), durationType: ability.isInnatePassive ? "Always On" : "Instant",
    uses: ability.maxCharges == null ? "" : String(ability.maxCharges), recharge: ability.usageType ?? "" };
  const time = ability.speed?.match(/^(\d+(?:\.\d+)?)\s*(?:s|seconds?)$/i);
  if (time) root.timeCost = Number(time[1]);
  root.reaction = ability.speed?.toLowerCase() === "reaction";
  const fromComponent = (component: NonNullable<Ability["components"]>[number]): AbilityInput => {
    const node = { ...blankAbilityInput(), id: component.id, name: component.name, source,
      durationType: component.behaviors.includes("always-on") ? "Always On" : "Time", duration: component.duration ?? "",
      rangeType: component.kinds.includes("aura") ? "Aura" : "Ranged", range: component.radius !== undefined ? String(component.radius) : component.range ?? "",
      targets: component.targets.map(target => target === "allies" ? "Ally" : target === "enemies" ? "Enemy" : target === "self" ? "Self" : "Custom"),
      unlockRank: ability.evolutionModifiers?.find(modifier => modifier.id === component.unlockedByModifierId)?.rankLabel ?? component.unlockedByModifierId, linkedStats: root.linkedStats,
      trigger: { conditions: structuredClone(component.conditions ?? []), match: component.conditionMatch ?? "all", mode: component.triggerMode ?? "manual" } as RequirementGroup,
      upgrades: (component.evolutions ?? []).map(entry => ({ id: entry.id, rank: ability.evolutionModifiers?.find(modifier => modifier.id === entry.modifierId)?.rankLabel ?? entry.modifierId, rules: entry.rules ?? "", range: entry.radius === undefined ? undefined : String(entry.radius), duration: entry.duration, formula: entry.rollFormula })) };
    const cost = component.cost?.match(/^(\d+(?:\.\d+)?)\s*(?:MP|mana)?$/i);
    if (cost) node.manaCost = Number(cost[1]);
    node.uses = component.uses ?? "";
    for (const target of node.targets) if (component.rules || component.rollFormula) node.results.push({ ...blankResult(target), id: `${component.id}:${target}`, name: component.name, rules: [component.rules, component.targetRules].filter(Boolean).join("\n"), formula: component.rollFormula ?? "" });
    for (const effect of component.createdEffects ?? []) for (const target of effect.targets) {
      const label = target === "allies" ? "Ally" : target === "enemies" ? "Enemy" : target === "self" ? "Self" : "Custom";
      if (!node.targets.includes(label)) node.targets.push(label);
      node.results.push({ ...blankResult(label), id: `${effect.id}:${label}`, name: effect.name, rules: effect.rules, formula: effect.rollFormula ?? "", duration: effect.duration ?? "", lifetime: effect.delivery === "ongoing" ? "source" : "independent", trigger: { conditions: structuredClone(effect.conditions ?? []), match: effect.conditionMatch ?? "all", mode: effect.triggerMode ?? "manual" } });
    }
    return node;
  };
  if (ability.components?.length) {
    const nodes = ability.components.map(fromComponent);
    Object.assign(root, nodes[0], { name: ability.name, description: ability.description });
    root.subAbilities = nodes.slice(1);
  } else {
    for (const effect of ability.abilityEffects ?? []) for (const target of effect.tracking?.targets ?? ["self"]) {
      const label = target === "allies" ? "Ally" : target === "enemies" ? "Enemy" : "Self";
      if (!root.targets.includes(label)) root.targets.push(label);
      root.results.push({ ...blankResult(label), id: `${effect.id}:${label}`, name: effect.name, rules: effect.description ?? "", bonuses: readAbilityBonuses(effect), formula: effect.rollFormula ?? "", duration: effect.duration ?? "", lifetime: effect.tracking?.permanent ? "source" : "independent" });
      if (effect.tracking?.radius !== undefined) { root.rangeType = "Aura"; root.range = String(effect.tracking.radius); }
    }
    if (ability.rollFormula) { if (!root.targets.length) root.targets.push("Enemy"); root.results.push({ ...blankResult(root.targets[0]), formula: ability.rollFormula }); }
  }
    root.subAbilities.push(...(ability.subAbilities ?? []).filter(sub => !root.subAbilities.some(node => node.id === sub.id)).map(sub => {
      const node = { ...blankAbilityInput(), id: sub.id, name: sub.name, source, description: sub.description ?? "", manaCost: sub.cost || undefined, cooldown: sub.cooldown || undefined, ...existingRange(sub.range ?? ""), linkedStats: sub.linkedStats ?? [], targets: [] as string[], results: [] as TargetResult[] };
      if (sub.rollFormula) { node.targets.push("Enemy"); node.results.push({ ...blankResult("Enemy"), formula: sub.rollFormula }); }
      const bonuses = existingBonuses(sub);
      if (bonuses) { node.targets.push("Self"); node.results.push({ ...blankResult("Self"), rules: "", bonuses: readAbilityBonuses(sub) }); }
      const subTime = sub.speed?.match(/^(\d+(?:\.\d+)?)\s*(?:s|seconds?)$/i);
      if (subTime) node.timeCost = Number(subTime[1]);
      node.reaction = sub.speed?.toLowerCase() === "reaction";
      return node;
    }));
  const bonuses = existingBonuses(ability);
  if (bonuses) { if (!root.targets.includes("Self")) root.targets.push("Self"); root.results.push({ ...blankResult("Self"), rules: "", bonuses: readAbilityBonuses(ability) }); }
  for (const modifier of ability.evolutionModifiers ?? []) if (!root.upgrades.some(upgrade => upgrade.id === modifier.id)) root.upgrades.push({ id: modifier.id, rank: modifier.rankLabel, rules: modifier.effect });
  for (const trigger of ability.triggers ?? []) {
    const condition: TriggerCondition = { id: trigger.id, kind: "resource", label: trigger.name, resource: trigger.resource, operator: trigger.operator, threshold: trigger.threshold };
    const target = root.subAbilities.find(sub => sub.id === trigger.linkedTargetId);
    if (target) target.trigger.conditions.push(condition);
    else {
      const linked = root.results.filter(result => result.id.startsWith(`${trigger.linkedTargetId}:`));
      if (linked.length) for (const result of linked) result.trigger.conditions.push({ ...condition, id: `${trigger.id}:${result.id}` });
      else root.options.triggers.push({ id: trigger.id, name: trigger.name, conditions: [condition], match: "all" });
    }
  }
  return root;
}
export function validateAbilityInput(input: AbilityInput): string | undefined {
  for (const node of flattenInputs(input)) {
    if (!node.name.trim()) return "Name the ability and each Sub-Ability.";
    if (node.targets.includes("Summon") && !node.summon) return "Choose a recorded minion for each Summon target.";
    for (const value of [node.manaCost, node.manaPerTurn, node.timeCost, node.cooldown]) if (value !== undefined && (!Number.isFinite(value) || value < 0)) return "Costs and cooldowns must be nonnegative numbers.";
    for (const result of node.results) if (result.stacking === "Stack" && result.maxStacks !== undefined && (!Number.isInteger(result.maxStacks) || result.maxStacks < 1)) return "Max Stacks must be a positive whole number.";
    if (["Aura", "Ranged"].includes(node.rangeType) && (!node.range.trim() || !Number.isFinite(Number(node.range)) || Number(node.range) < 0)) return "Enter a nonnegative range in feet.";
    for (const key of rangedDimensionKeys(node)) {
      const value = node.areaDimensions?.[key];
      if (value?.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0 || key === "targetCount" && (!Number.isInteger(Number(value)) || Number(value) < 1))) return "Area dimensions must be nonnegative numbers; target counts must be positive whole numbers.";
    }
    if (node.rangeType === "Ranged" && node.areaShape === "Ring / Hollow Area" && node.areaDimensions?.innerRadius && node.areaDimensions?.radius && Number(node.areaDimensions.innerRadius) > Number(node.areaDimensions.radius)) return "Inner radius cannot exceed the outer radius.";
    const groups = durationTriggerGroups(node);
    for (const group of [groups.activation, groups.ending, ...node.results.flatMap(result => { const effective = durationTriggerGroups(result, result.durationType || node.durationType); return [effective.activation, effective.ending]; })]) {
      if (group.conditions.some(condition => condition.kind === "situation" ? !condition.label.trim() : !condition.resource || !condition.operator || (!["depleted", "full"].includes(condition.operator) && (condition.threshold === undefined || !Number.isFinite(condition.threshold))))) return "Complete each trigger or ending condition.";
    }
  }
  for (const effect of input.options.effects) if (effect.definition) {
    const error = validateAbilityInput(effect.definition);
    if (error) return `${effect.name || "Custom effect"}: ${error}`;
  }
}
