import type { Ability } from "./storage.ts";

type UsageFields = Pick<Ability, "usageType" | "maxCharges" | "currentCharges">;
export type TrackedAbilityUsage = {
  mode: "standard" | "one-time" | "rechargeable";
  maximum: string;
};

export function trackedUsageFromAbility(ability: UsageFields | null): TrackedAbilityUsage {
  const mode = ability?.usageType;
  return {
    mode: mode === "rechargeable" || mode === "one-time" ? mode : "standard",
    maximum: ability?.maxCharges == null ? "" : String(ability.maxCharges),
  };
}

export function trackedUsageChanges(input: TrackedAbilityUsage, original: UsageFields | null, canConsumeItem: boolean): { fields?: UsageFields; error?: string } {
  const previous = trackedUsageFromAbility(original);
  if (input.mode === previous.mode && (input.mode !== "rechargeable" || input.maximum === previous.maximum)) return {};
  if (input.mode === "one-time" && !canConsumeItem) return { error: "Only an inventory item can be consumed when used." };
  if (input.mode !== "rechargeable") return { fields: { usageType: input.mode, maxCharges: null, currentCharges: null } };
  const maximum = Number(input.maximum);
  if (!Number.isSafeInteger(maximum) || maximum < 1) return { error: "Enter a positive whole number for maximum charges." };
  const remaining = previous.mode === "rechargeable" ? original?.currentCharges ?? original?.maxCharges ?? maximum : maximum;
  return { fields: { usageType: input.mode, maxCharges: maximum, currentCharges: Math.max(0, Math.min(maximum, remaining)) } };
}
