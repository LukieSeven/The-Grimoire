export const BONUS_FIELDS = [
  ["bonusPower", "Power"], ["bonusVitality", "Vitality"], ["bonusSpirit", "Spirit"], ["bonusAgility", "Agility"],
  ["bonusEndurance", "Endurance"], ["bonusPrecision", "Precision"], ["bonusWillpower", "Willpower"], ["bonusCharisma", "Charisma"],
  ["hpAdd", "HP Add"], ["hpBuff", "HP Buff"], ["manaAdd", "Mana Add"], ["manaBuff", "Mana Buff"],
  ["dtAdd", "DT Add"], ["dtBuff", "DT Buff"], ["bonusInitiative", "Initiative"],
  ["bonusHp", "HP Buff"], ["bonusMana", "Mana Buff"], ["bonusDt", "DT Buff"],
  ["bonusMovement", "Movement (ft)"], ["bonusAttackRoll", "Attack Roll"], ["bonusSkillCheck", "Skill / Check Roll"],
  ["bonusResistanceRoll", "Resistance Roll"], ["damageReduction", "Damage Reduction"], ["armorPenetration", "Armor Penetration"], ["dtPenetration", "DT Penetration"],
] as const;
export type AbilityBonuses = Partial<Record<typeof BONUS_FIELDS[number][0], number | string>> & { resistances?: string; immunities?: string; vulnerabilities?: string; resistanceAttributes?: string[]; checkSkills?: string[] };
export function normalizeBonuses(bonuses: AbilityBonuses): AbilityBonuses {
  const copy = { ...bonuses };
  for (const [oldKey, key] of [["bonusHp", "hpBuff"], ["bonusMana", "manaBuff"], ["bonusDt", "dtBuff"]] as const) {
    const old = copy[oldKey]; const current = copy[key];
    if (old !== undefined && old !== "") copy[key] = current === undefined || current === "" ? old : `(${current})+(${old})`;
    delete copy[oldKey];
  }
  return copy;
}
export function readAbilityBonuses(value: object): AbilityBonuses {
  return normalizeBonuses(Object.fromEntries([...BONUS_FIELDS.map(([key]) => key), "resistances", "immunities", "vulnerabilities", "resistanceAttributes", "checkSkills"].flatMap(key => {
    const entry = (value as Record<string, unknown>)[key];
    return typeof entry === "string" || typeof entry === "number" || Array.isArray(entry) ? [[key, entry]] : [];
  })));
}
/** Recognize only our exact generated key/value summary, never prose or arbitrary descriptions. */
export function bonusesFromSummary(rules: string): AbilityBonuses | undefined {
  const fields = new Set<string>([...BONUS_FIELDS.map(([key]) => key), "resistances", "immunities", "vulnerabilities"]);
  const lines = rules.split("\n").filter(line => line.trim());
  if (!lines.length || lines.some(line => !fields.has(line.split(":")[0]))) return;
  return normalizeBonuses(Object.fromEntries(lines.map(line => { const split = line.indexOf(":"); return [line.slice(0, split), line.slice(split + 1).trim()]; })));
}
