import { selectStackedEffects } from "./effect-stacking.ts";
import { getAdjustedStats, parseFormulaOrNum, getModifierForStat } from "./storage.ts";
import type { Ability, Character, Equipment, Familiar } from "./storage.ts";
import { familiarAsCharacter, familiarAbilityAsAbility } from "./familiar-values.ts";
import { resolveTrackerEffects, isEffectApplied } from "./tracker.ts";
export type RollPurpose = "attack" | "check" | "resistance";
export function activeEffectModifier(actor: Character | Familiar, abilities: Ability[], equipment: Equipment[], key: "bonusAttackRoll" | "bonusSkillCheck" | "bonusResistanceRoll" | "damageReduction" | "armorPenetration" | "dtPenetration", scope?: string): number {
  const familiar = "className" in actor;
  const character = familiar ? familiarAsCharacter(actor as Familiar) : actor as Character;
  const owned = familiar ? (actor as Familiar).abilities.map(familiarAbilityAsAbility) : abilities;
  const adjusted = getAdjustedStats(character, equipment, owned);
  const vars: Record<string, number> = { ...adjusted.stats };
  for (const [stat, value] of Object.entries(adjusted.stats)) { vars[stat.slice(0, 3)] = value; vars[stat.slice(0, 3) + "r"] = getModifierForStat(value, character.rank); }
  const entries = resolveTrackerEffects(owned, character.rank, adjusted.stats, { hp: character.currentHp, maxHp: adjusted.maxHp, mana: character.currentMana, maxMana: adjusted.maxMana, dt: character.currentDt, maxDt: adjusted.maxDt }, character.triggerConfirmations ?? {}).filter(entry => !entry.familiar && entry.result?.target === "Self");
  return selectStackedEffects(entries, character.effectApplications ?? [], value => parseFormulaOrNum(value, vars)).reduce((sum, entry) => {
    const bonuses = entry.result?.bonuses;
    if (!bonuses) return sum;
    const scopes = key === "bonusResistanceRoll" ? bonuses.resistanceAttributes : key === "bonusSkillCheck" ? bonuses.checkSkills : undefined;
    if (scopes?.length && (!scope || !scopes.some(value => value.toLowerCase() === scope.toLowerCase()))) return sum;
    const stacks = entry.result?.stacking === "Stack" ? Math.min(entry.result.maxStacks ?? Infinity, character.effectApplications?.find(application => application.abilityId === entry.ability.id && application.effectId === entry.effect.id && application.targetId === "self")?.stacks ?? 1) : 1;
    return sum + parseFormulaOrNum(bonuses[key], vars) * stacks;
  }, 0);
}
