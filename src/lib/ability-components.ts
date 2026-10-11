export const COMPONENT_KINDS = ["aura", "damage", "healing", "modifier", "condition", "custom"] as const;
export const COMPONENT_BEHAVIORS = ["always-on", "activated", "reaction", "conditional"] as const;
export const SITUATIONS = ["Saving throws", "Incoming attacks", "Taking damage", "Outgoing attacks", "Damage types", "Status conditions", "Movement", "Resource thresholds", "Ally interactions", "Enemy interactions", "Reactions"];
export const TRIGGER_CHOICES = ["Resources", "Custom", "Being Attacked", "Ally Being Attacked", "Taking Damage", "Ally Taking Damage", "Dealing Damage", "Hitting a Target", "Missing a Target", "Defeating an Enemy", "Ally Defeated", "Using an Ability", "Moving", "Entering Range", "Leaving Range", "Start of Turn", "End of Turn", "Gaining an Effect", "Losing an Effect", "Succeeding a Resistance Roll", "Failing a Resistance Roll", "Critical Hit", "Receiving Healing", "Activating an Ability", "Deactivating an Ability"];
export type ComponentKind = typeof COMPONENT_KINDS[number];
export type ComponentBehavior = typeof COMPONENT_BEHAVIORS[number];
export type EffectTarget = "self" | "allies" | "enemies" | "custom";
export type TriggerCondition = {
  id: string;
  kind: "resource" | "situation";
  label: string;
  resource?: "hp" | "mana" | "dt";
  operator?: "below_percent" | "below_value" | "depleted" | "above_percent" | "full";
  threshold?: number;
};
export interface ComponentEvolution {
  id: string;
  modifierId: string;
  rules?: string;
  radius?: number;
  rollFormula?: string;
  duration?: string;
}
export interface AbilityComponent {
  createdEffects?: CreatedEffect[];
  id: string;
  name: string;
  kinds: ComponentKind[];
  behaviors: ComponentBehavior[];
  targets: EffectTarget[];
  rules: string;
  targetRules?: string;
  radius?: number;
  radiusUnit?: string;
  range?: string;
  rollFormula?: string;
  cost?: string;
  duration?: string;
  uses?: string;
  situations?: string[];
  conditions?: TriggerCondition[];
  conditionMatch?: "all" | "any";
  triggerMode?: "reference" | "manual" | "automatic";
  unlockedByModifierId?: string;
  evolutions?: ComponentEvolution[];
}
export interface CreatedEffect {
  /** Ongoing effects share component activation; applied effects have independent lifetimes. */
  delivery?: "ongoing" | "applied";
  id: string;
  name: string;
  rules: string;
  targets: EffectTarget[];
  duration?: string;
  rollFormula?: string;
  conditions?: TriggerCondition[];
  conditionMatch?: "all" | "any";
  triggerMode?: "reference" | "manual";
  situations?: string[];
}
export interface ManualTrackedEffect {
  stacks?: number;
  startedAt?: string;
  templateId?: string;
  definition?: import("./ability-input.ts").AbilityInput;
  abilityId?: number;
  id: string;
  targetId: string;
  name: string;
  rules: string;
  active: boolean;
  radius?: number;
  radiusUnit?: string;
  duration?: string;
  conditions?: TriggerCondition[];
  conditionMatch?: "all" | "any";
  triggerMode?: "reference" | "manual" | "automatic";
  situations?: string[];
}
export interface TriggerContext {
  hp: number; maxHp: number; mana: number; maxMana: number; dt: number; maxDt: number;
}
export type RequirementState = "met" | "unmet" | "judgment";

export function evaluateCondition(condition: TriggerCondition, context?: TriggerContext, confirmations: Record<string, boolean> = {}): RequirementState {
  if (condition.kind === "situation") return condition.id in confirmations ? confirmations[condition.id] ? "met" : "unmet" : "judgment";
  if (!context || !condition.resource || !condition.operator) return "judgment";
  const value = context[condition.resource];
  const maximum = context[condition.resource === "hp" ? "maxHp" : condition.resource === "mana" ? "maxMana" : "maxDt"];
  if (!Number.isFinite(value)) return "judgment";
  if (condition.operator === "depleted") return value <= 0 ? "met" : "unmet";
  if (condition.operator === "full") return Number.isFinite(maximum) ? value >= maximum ? "met" : "unmet" : "judgment";
  if (condition.threshold === undefined || !Number.isFinite(condition.threshold)) return "judgment";
  if (condition.operator === "below_value") return value <= condition.threshold ? "met" : "unmet";
  if (!Number.isFinite(maximum) || maximum <= 0) return "judgment";
  const percent = value / maximum * 100;
  return (condition.operator === "below_percent" ? percent < condition.threshold : percent >= condition.threshold) ? "met" : "unmet";
}

export function evaluateRequirements(conditions: TriggerCondition[] = [], match: "all" | "any" = "all", context?: TriggerContext, confirmations: Record<string, boolean> = {}): RequirementState {
  if (!conditions.length) return "met";
  const states = conditions.map(condition => evaluateCondition(condition, context, confirmations));
  if (match === "any") return states.includes("met") ? "met" : states.includes("judgment") ? "judgment" : "unmet";
  return states.includes("unmet") ? "unmet" : states.includes("judgment") ? "judgment" : "met";
}

export function conditionText(condition: TriggerCondition): string {
  if (condition.kind === "situation") return condition.label;
  const operator = condition.operator?.replaceAll("_", " ") ?? "Select a comparison";
  return `${condition.resource?.toUpperCase() ?? "Resource"} ${operator}${condition.threshold === undefined ? "" : ` ${condition.threshold}${condition.operator?.includes("percent") ? "%" : ""}`}`;
}

export function blankComponent(): AbilityComponent {
  return { id: crypto.randomUUID(), name: "", kinds: [], behaviors: [], targets: [], rules: "", conditions: [], conditionMatch: "all", triggerMode: "manual" };
}
