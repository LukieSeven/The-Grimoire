export function shouldEndAbilityOnUse(recorded: boolean, durationType: string, toggle: boolean): boolean {
  return toggle && recorded && !["Instant", "When Triggered", "Always On"].includes(durationType);
}
