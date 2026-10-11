import { evaluateFormula, parseFormulaOrNum, getAdjustedStats } from "./storage.ts";
import type { Familiar, FamiliarAbility, Character, Ability } from "./storage.ts";
import { resolveTrackerEffects } from "./tracker.ts";
export function resolveFamiliarTrackerEffects(familiar: Familiar) {
  const adjusted = getFamiliarAdjusted(familiar);
  const entries = resolveTrackerEffects(familiar.abilities.map(familiarAbilityAsAbility), familiar.className, adjusted.stats,
    { hp: familiar.currentHp, maxHp: adjusted.maxHp, mana: familiar.currentMana, maxMana: adjusted.maxMana, dt: familiar.currentDt, maxDt: adjusted.maxDt }, familiar.triggerConfirmations ?? {});
  // Preserve parent references: conditional children must consult this owner's activation records.
  for (const entry of entries) entry.ownerFamiliar = familiar;
  return entries;
}
export function familiarAsCharacter(fam: Familiar): Character {
  return { ...fam, id: -1, rank: fam.className, familiars: [], hpFormula: fam.hpFormula || "Vitality * 8", manaFormula: fam.manaFormula || "Spirit * 5", dtFormula: fam.dtFormula || "Endurance * 1", speedFormula: fam.speedFormula || "Agility * 5" } as unknown as Character;
}
export function familiarAbilityAsAbility(ability: FamiliarAbility): Ability { return { ...ability, characterId: -1 } as Ability; }
export function getFamiliarAdjusted(fam: Familiar) { return getAdjustedStats(familiarAsCharacter(fam), [], fam.abilities.map(familiarAbilityAsAbility)); }
export function restedFamiliar(familiar: Familiar): Familiar {
  const rested = { ...familiar, tempHp: 0, tempMana: 0, tempDt: 0, effectApplications: [], triggerConfirmations: {}, abilityTiming: {}, abilities: familiar.abilities.map(ability => ({ ...ability, active: false, ...((ability as unknown as Ability).usageType === "rechargeable" && (ability as unknown as Ability).maxCharges != null ? { currentCharges: (ability as unknown as Ability).maxCharges } : {}) })) };
  const maximums = getFamiliarAdjusted(rested);
  return { ...rested, currentHp: maximums.maxHp, currentMana: maximums.maxMana, currentDt: maximums.maxDt };
}
// Shared existing familiar calculations, unchanged from the character sheet.
export function getFamiliarMaxValues(fam: Familiar) {
    if (fam.abilities.some(ability => ability.definition)) {
      const adjusted = getFamiliarAdjusted(fam);
      return { ...adjusted, maxSpeed: adjusted.speed };
    }
    const vars = {
      power: fam.power, pow: fam.power,
      vitality: fam.vitality, vit: fam.vitality,
      spirit: fam.spirit, spi: fam.spirit,
      agility: fam.agility, agi: fam.agility,
      endurance: fam.endurance, end: fam.endurance,
      precision: fam.precision, pre: fam.precision,
      willpower: fam.willpower, wil: fam.willpower,
      charisma: fam.charisma, cha: fam.charisma,
      dtbonus: parseFormulaOrNum(fam.dtBonus, {})
    };
    const activeFamAbilities = fam.abilities?.filter(ab => ab.active) || [];
    const hpAddBonus = activeFamAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.hpAdd, vars), 0);
    const hpBuffBonus = activeFamAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.hpBuff, vars), 0);
    const manaAddBonus = activeFamAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.manaAdd, vars), 0);
    const manaBuffBonus = activeFamAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.manaBuff, vars), 0);
    const dtAddBonus = activeFamAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.dtAdd, vars), 0);
    const dtBuffBonus = activeFamAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.dtBuff, vars), 0);

    const baseMaxHp = Math.max(1, evaluateFormula(fam.hpFormula || "Vitality * 8", vars) + hpAddBonus);
    const totalMaxHp = Math.max(1, baseMaxHp + hpBuffBonus);

    const baseMaxMana = Math.max(0, evaluateFormula(fam.manaFormula || "Spirit * 5", vars) + manaAddBonus);
    const totalMaxMana = Math.max(0, baseMaxMana + manaBuffBonus);

    const baseMaxDt = Math.max(0, evaluateFormula(fam.dtFormula || "Endurance * 1", vars) + dtAddBonus);
    const totalMaxDt = Math.max(0, baseMaxDt + dtBuffBonus);

    const famSpeed = Math.max(0, evaluateFormula(fam.speedFormula || "Agility * 5", vars));

    return {
      baseMaxHp,
      totalMaxHp,
      maxHp: totalMaxHp,
      baseMaxMana,
      totalMaxMana,
      maxMana: totalMaxMana,
      baseMaxDt,
      totalMaxDt,
      maxDt: totalMaxDt,
      speed: famSpeed,
      maxSpeed: famSpeed,
    };
  }
