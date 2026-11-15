import type { AbilityInput, RequirementGroup } from "./ability-input.ts";

export function hasManualEvent(group: RequirementGroup): boolean {
  return group.mode === "manual" && group.conditions.some(condition => condition.kind === "situation");
}

/** Accepts the effective trigger group from a resolved ability. */
export function isManualTriggerActivation(input: Pick<AbilityInput, "durationType" | "trigger">): boolean {
  return input.durationType === "When Triggered" && hasManualEvent(input.trigger);
}

export function recordsAbilityActivation(input: Pick<AbilityInput, "durationType" | "trigger">): boolean {
  return input.durationType !== "Instant" && (input.durationType !== "When Triggered" || isManualTriggerActivation(input));
}

export function shouldEndAbilityOnUse(recorded: boolean, durationType: string, toggle: boolean, manualTrigger = false): boolean {
  return toggle && recorded && (manualTrigger || !["Instant", "When Triggered", "Always On"].includes(durationType));
}
