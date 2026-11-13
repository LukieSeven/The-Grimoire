import { buildFormulaVars, evaluateFormula, getAdjustedStats, tryEvaluateFormula } from "./storage.ts";
import type { Familiar, FamiliarAbility, Character, Ability } from "./storage.ts";
import { resolveTrackerEffects } from "./tracker.ts";
export const FAMILIAR_RANKS: readonly string[] = ["Iron", "Bronze", "Silver", "Gold", "Diamond"];

/** Keep the effective movement of older records which omitted a formula. */
export function familiarMovementExpression(familiar: Pick<Familiar, "speedFormula">): string {
  return familiar.speedFormula || "Agility * 5";
}

export function evaluateFamiliarMovement(expression: string, stats: Record<string, unknown>): number {
  return Math.max(0, evaluateFormula(expression, buildFormulaVars(stats)));
}

export function getFamiliarMovementSpeed(expression: string, stats: Record<string, unknown>): number | undefined {
  const speed = tryEvaluateFormula(expression, buildFormulaVars(stats));
  return speed === undefined ? undefined : Math.max(0, speed);
}

export function resolveFamiliarTrackerEffects(familiar: Familiar) {
  const adjusted = getFamiliarAdjusted(familiar);
  const entries = resolveTrackerEffects(familiar.abilities.map(familiarAbilityAsAbility), familiar.className, adjusted.stats,
    { hp: familiar.currentHp, maxHp: adjusted.maxHp, mana: familiar.currentMana, maxMana: adjusted.maxMana, dt: familiar.currentDt, maxDt: adjusted.maxDt }, familiar.triggerConfirmations ?? {});
  // Preserve parent references: conditional children must consult this owner's activation records.
  for (const entry of entries) entry.ownerFamiliar = familiar;
  return entries;
}
export function familiarAsCharacter(fam: Familiar): Character {
  return { ...fam, id: -1, rank: fam.className, familiars: [], hpFormula: fam.hpFormula || "Vitality * 8", manaFormula: fam.manaFormula || "Spirit * 5", dtFormula: fam.dtFormula || "Endurance * 1", speedFormula: familiarMovementExpression(fam) } as unknown as Character;
}
export function familiarAbilityAsAbility(ability: FamiliarAbility): Ability { return { ...ability, characterId: -1 } as Ability; }
export function getFamiliarAdjusted(fam: Familiar) { return getAdjustedStats(familiarAsCharacter(fam), [], fam.abilities.map(familiarAbilityAsAbility)); }
export function restedFamiliar(familiar: Familiar): Familiar {
  const rested = { ...familiar, tempHp: 0, tempMana: 0, tempDt: 0, effectApplications: [], triggerConfirmations: {}, abilityTiming: {}, abilities: familiar.abilities.map(ability => ({ ...ability, active: false, ...((ability as unknown as Ability).usageType === "rechargeable" && (ability as unknown as Ability).maxCharges != null ? { currentCharges: (ability as unknown as Ability).maxCharges } : {}) })) };
  const maximums = getFamiliarAdjusted(rested);
  return { ...rested, currentHp: maximums.maxHp, currentMana: maximums.maxMana, currentDt: maximums.maxDt };
}
export function getFamiliarMaxValues(fam: Familiar) {
  const adjusted = getFamiliarAdjusted(fam);
  return { ...adjusted, maxSpeed: adjusted.speed };
}
