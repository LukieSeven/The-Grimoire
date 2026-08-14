// AEtherborne Standalone Browser Storage Engine
import initialCodex from "../data/initial_codex.json" with { type: "json" };
import {
  ARCHIVE_SCHEMA_VERSION,
  assertSupportedVersion,
  codexBackupSchema,
  fullArchiveSchema,
  grimoireBackupSchema,
  parseImportJson,
  validateArchiveRelationships,
} from "./archive-schema.ts";
import { commitStorageUpdates } from "./persistence.ts";

export interface FavoriteSlot {
  type: "weapon" | "item" | "ability" | "sub-ability" | "skill" | "familiar-ability" | "attribute" | "familiar-attribute";
  targetId: string | number;
  subId?: string;
  label: string;
  familiarId?: string | number;
}

export interface FamiliarAbility {
  id: number;
  name: string;
  nickname?: string;
  description: string;
  cost: number;
  cooldown: number;
  range: string;
  speed: string;
  rollFormula: string;
  linkedStats: string[];
  linkedStat?: string;
  assignedToQuickRolls: boolean;
  level?: number;
  active?: boolean;
  type?: string;
  essenceId?: number | null;
  equipmentId?: number | null;
  resistances?: string;
  immunities?: string;
  bonusPower?: number | string;
  bonusVitality?: number | string;
  bonusSpirit?: number | string;
  bonusAgility?: number | string;
  bonusEndurance?: number | string;
  bonusPrecision?: number | string;
  bonusWillpower?: number | string;
  bonusCharisma?: number | string;
  hpAdd?: number | string;
  hpBuff?: number | string;
  manaAdd?: number | string;
  manaBuff?: number | string;
  dtAdd?: number | string;
  dtBuff?: number | string;
  bonusInitiative?: number | string;
  subAbilities?: SubAbility[];
  sortOrder?: number;
}

export interface Familiar {
  id: string | number;
  name: string;
  className: string;
  race: string;
  level: number;
  speed: number;
  power: number;
  vitality: number;
  spirit: number;
  agility: number;
  endurance: number;
  precision: number;
  willpower: number;
  charisma: number;
  currentHp: number;
  currentMana: number;
  currentDt: number;
  dtBonus: number | string;
  hpFormula: string;
  manaFormula: string;
  dtFormula: string;
  abilities: FamiliarAbility[];
  resistances?: string;
  immunities?: string;
  avatar?: string;
}

export interface Character {
  id: number;
  name: string;
  rank: string;
  race: string;
  level: number;
  maxHp: number;
  currentHp: number;
  dtBonus: number | string;
  currentDt: number;
  speed: number;
  power: number;
  vitality: number;
  spirit: number;
  agility: number;
  endurance: number;
  precision: number;
  willpower: number;
  charisma: number;
  currentMana: number;
  background: string | null;
  backstory: string | null;
  hpFormula: string;
  manaFormula: string;
  dtFormula: string;
  initiativeFormula?: string;
  // Stat training values
  powerTraining: number;
  vitalityTraining: number;
  spiritTraining: number;
  agilityTraining: number;
  enduranceTraining: number;
  precisionTraining: number;
  willpowerTraining: number;
  charismaTraining: number;
  favorites?: (FavoriteSlot | null)[];
  familiars?: Familiar[];
  resistances?: string;
  immunities?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Equipment {
  id: number;
  characterId: number;
  name: string;
  description: string;
  equipped: boolean;
  assignedToQuickRolls: boolean;
  dtBonus: number | string;
  bonusInitiative?: number | string;
  statModifiers: Record<string, number | string>;
  diceType?: string;
  modifier?: string | number;
}

export interface Currency {
  id: number;
  characterId: number;
  name: string;
  amount: number;
}

export interface InventoryItem {
  id: number;
  characterId: number;
  name: string;
  description: string;
  quantity: number;
}

export interface Essence {
  id: number;
  characterId: number;
  name: string;
  description: string;
  slot: number; // 1-4
}

export interface SubAbility {
  id: string;
  name: string;
  nickname?: string;
  type?: string;
  description?: string;
  cost?: number;
  cooldown?: number;
  range?: string;
  speed?: string;
  rollFormula?: string;
  linkedStats?: string[];
  assignedToQuickRolls?: boolean;
  bonusPower?: number | string;
  bonusVitality?: number | string;
  bonusSpirit?: number | string;
  bonusAgility?: number | string;
  bonusEndurance?: number | string;
  bonusPrecision?: number | string;
  bonusWillpower?: number | string;
  bonusCharisma?: number | string;
  hpAdd?: number | string;
  hpBuff?: number | string;
  manaAdd?: number | string;
  manaBuff?: number | string;
  dtAdd?: number | string;
  dtBuff?: number | string;
  bonusInitiative?: number | string;
  resistances?: string;
  immunities?: string;
}

export function parseFormulaOrNum(val: number | string | undefined | null, vars: Record<string, number>): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  const str = String(val).trim();
  if (!str) return 0;
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  return evaluateFormula(str, vars);
}

export function hasStatModifiers(ability: Partial<Ability> | Partial<SubAbility>): boolean {
  const checkVal = (v: any) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") return v.trim().length > 0 && v.trim() !== "0";
    return false;
  };

  return !!(
    checkVal(ability.bonusPower) ||
    checkVal(ability.bonusVitality) ||
    checkVal(ability.bonusSpirit) ||
    checkVal(ability.bonusAgility) ||
    checkVal(ability.bonusEndurance) ||
    checkVal(ability.bonusPrecision) ||
    checkVal(ability.bonusWillpower) ||
    checkVal(ability.bonusCharisma) ||
    checkVal(ability.hpAdd) ||
    checkVal(ability.hpBuff) ||
    checkVal(ability.manaAdd) ||
    checkVal(ability.manaBuff) ||
    checkVal(ability.dtAdd) ||
    checkVal(ability.dtBuff) ||
    checkVal(ability.bonusInitiative) ||
    (ability.resistances && ability.resistances.trim().length > 0) ||
    (ability.immunities && ability.immunities.trim().length > 0)
  );
}

export interface ActiveModifierBadge {
  label: string;
  type: "stat" | "hp-add" | "hp-buff" | "mana-add" | "mana-buff" | "dt-add" | "dt-buff" | "init" | "resistance" | "immunity";
}

export function getAbilityActiveModifierBadges(ab: Partial<Ability> | Partial<SubAbility> | Partial<FamiliarAbility>): ActiveModifierBadge[] {
  const badges: ActiveModifierBadge[] = [];

  // 1. Primary Stat Boosts
  const stats: Array<[string, any]> = [
    ["POW", ab.bonusPower],
    ["VIT", ab.bonusVitality],
    ["SPI", ab.bonusSpirit],
    ["AGI", ab.bonusAgility],
    ["END", ab.bonusEndurance],
    ["PRE", ab.bonusPrecision],
    ["WIL", ab.bonusWillpower],
    ["CHA", ab.bonusCharisma],
  ];

  for (const [statLabel, val] of stats) {
    if (val !== undefined && val !== null && val !== "" && val !== 0 && val !== "0") {
      const formattedVal = typeof val === "number" ? (val > 0 ? `+${val}` : `${val}`) : (String(val).startsWith("+") || String(val).startsWith("-") ? val : `+${val}`);
      badges.push({ label: `${statLabel}: ${formattedVal}`, type: "stat" });
    }
  }

  // 2. Vital Additions (Base Max Increases)
  if (ab.hpAdd !== undefined && ab.hpAdd !== null && ab.hpAdd !== "" && ab.hpAdd !== 0 && ab.hpAdd !== "0") {
    badges.push({ label: `+${ab.hpAdd} HP Add`, type: "hp-add" });
  }
  if (ab.manaAdd !== undefined && ab.manaAdd !== null && ab.manaAdd !== "" && ab.manaAdd !== 0 && ab.manaAdd !== "0") {
    badges.push({ label: `+${ab.manaAdd} MP Add`, type: "mana-add" });
  }
  if (ab.dtAdd !== undefined && ab.dtAdd !== null && ab.dtAdd !== "" && ab.dtAdd !== 0 && ab.dtAdd !== "0") {
    badges.push({ label: `+${ab.dtAdd} DT Add`, type: "dt-add" });
  }

  // 3. Vital Buffs (Temporary Buffers)
  if (ab.hpBuff !== undefined && ab.hpBuff !== null && ab.hpBuff !== "" && ab.hpBuff !== 0 && ab.hpBuff !== "0") {
    badges.push({ label: `+${ab.hpBuff} HP Buff`, type: "hp-buff" });
  }
  if (ab.manaBuff !== undefined && ab.manaBuff !== null && ab.manaBuff !== "" && ab.manaBuff !== 0 && ab.manaBuff !== "0") {
    badges.push({ label: `+${ab.manaBuff} MP Buff`, type: "mana-buff" });
  }
  if (ab.dtBuff !== undefined && ab.dtBuff !== null && ab.dtBuff !== "" && ab.dtBuff !== 0 && ab.dtBuff !== "0") {
    badges.push({ label: `+${ab.dtBuff} DT Buff`, type: "dt-buff" });
  }

  // 4. Initiative
  if (ab.bonusInitiative !== undefined && ab.bonusInitiative !== null && ab.bonusInitiative !== "" && ab.bonusInitiative !== 0 && ab.bonusInitiative !== "0") {
    const initVal = typeof ab.bonusInitiative === "number" ? (ab.bonusInitiative > 0 ? `+${ab.bonusInitiative}` : `${ab.bonusInitiative}`) : String(ab.bonusInitiative);
    badges.push({ label: `Init: ${initVal}`, type: "init" });
  }

  // 5. Resistances & Immunities
  if (ab.resistances && ab.resistances.trim().length > 0) {
    badges.push({ label: `Resist: ${ab.resistances}`, type: "resistance" });
  }
  if (ab.immunities && ab.immunities.trim().length > 0) {
    badges.push({ label: `Immune: ${ab.immunities}`, type: "immunity" });
  }

  return badges;
}

export interface EvolutionModifier {
  id: string;
  name: string;
  rankLabel: string;
  requiredStat: number;
  effect: string;
}

export interface Ability {
  id: number;
  characterId: number;
  name: string;
  nickname?: string;
  description: string;
  cost: number;
  cooldown: number;
  range: string;
  speed: string;
  rollFormula: string;
  linkedStats: string[];
  linkedStat?: string;
  assignedToQuickRolls: boolean;
  level?: number;
  active?: boolean;
  primaryStat?: string;
  evolutionModifiers?: EvolutionModifier[];
  subAbilities?: SubAbility[];
  bonusPower?: number | string;
  bonusVitality?: number | string;
  bonusSpirit?: number | string;
  bonusAgility?: number | string;
  bonusEndurance?: number | string;
  bonusPrecision?: number | string;
  bonusWillpower?: number | string;
  bonusCharisma?: number | string;
  hpAdd?: number | string;
  hpBuff?: number | string;
  manaAdd?: number | string;
  manaBuff?: number | string;
  dtAdd?: number | string;
  dtBuff?: number | string;
  bonusInitiative?: number | string;
  essenceId?: number | null;
  isInnatePassive?: boolean;
  resistances?: string;
  immunities?: string;
  equipmentId?: number | null;
  inventoryItemId?: number | null;
  usageType?: string | null;
  maxCharges?: number | null;
  currentCharges?: number | null;
  sortOrder?: number;
  type?: string;
}

export interface Skill {
  id: number;
  characterId: number;
  name: string;
  value: number;
  training: number;
  category?: string | null;
}

export interface Roll {
  id: number;
  characterId: number;
  diceType: string;
  result: number;
  modifier: number | null;
  total: number;
  label: string | null;
  isCrit: boolean | null;
  critBonus: number | null;
  rolledAt: string;
  familiarId?: string | number;
}

export interface Note {
  id: number;
  characterId: number;
  title: string;
  content: string;
  category: string; // 'general', 'location', 'npc', 'item', 'lore', 'bestiary'
  tags: string[];
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CodexNote {
  id: number;
  title: string;
  content: string;
  category: string; // 'world', 'entities', 'bestiary', 'systems', 'items', 'maps', 'lore', 'glossary'
  subcategory: string; // e.g. 'world-cities', 'maps-dungeons'
  tags: string[];
  images?: string[];
  coordinates?: { x: number; y: number; label?: string } | null;
  secretPassword?: string | null;
  stateId?: number | null;
  parentBurgId?: number | null;
  isState?: boolean;
  isCapital?: boolean;
  population?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecap {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

// ── Math Formula Parser ───────────────────────────────────

export function evaluateFormula(formula: string, variables: Record<string, number>): number {
  try {
    let expression = formula.toLowerCase();

    // 1. If formula contains '=', strip any description on the left-hand side
    if (expression.includes("=")) {
      expression = expression.split("=").pop() || expression;
    }

    // 2. Replace multiplication symbols '×' and 'x' with standard asterisk '*'
    expression = expression.replace(/×/g, "*").replace(/x/g, "*");

    // Substitute variables, sorting descending by length to prevent partial matches
    const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);

    // First substitute rolled suffix versions (e.g. wilr -> 12) with base stat value using word boundary RegExp to avoid partial matches
    for (const key of sortedKeys) {
      const val = variables[key];
      const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp('\\b' + escapedKey + 'r\\b', 'g');
      expression = expression.replace(regex, String(val));
    }

    // Then substitute standard base stat keys (e.g. wil -> 12) using word boundary RegExp
    for (const key of sortedKeys) {
      const val = variables[key];
      const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp('\\b' + escapedKey + '\\b', 'g');
      expression = expression.replace(regex, String(val));
    }

    // Strip spaces now that variables replacement is done
    expression = expression.replace(/\s+/g, "");

    // 3. For static pool/recalculation formulas, replace standard dice (e.g. d6, d8) with their maximum value
    expression = expression.replace(/d(\d+)/g, "$1");

    // Security: Only allow mathematical operators, parentheses, digits, and decimals
    if (!/^[0-9+\-*/().]+$/.test(expression)) {
      return 0;
    }

    const result = new Function(`return (${expression})`)();
    return typeof result === "number" && !isNaN(result) ? Math.floor(result) : 0;
  } catch (err) {
    console.error("Formula parsing error:", formula, err);
    return 0;
  }
}

// ── Safe Storage Wrapper ───────────────────────────────────
class MemoryStorage {
  private data: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.data[key] || null;
  }
  setItem(key: string, value: string): void {
    this.data[key] = value;
  }
  removeItem(key: string): void {
    delete this.data[key];
  }
  clear(): void {
    this.data = {};
  }
}

let safeStorage: {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

try {
  const testKey = "__test_localstorage_access__";
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
  safeStorage = window.localStorage;
} catch (e) {
  console.warn("localStorage is blocked or unavailable (often due to iframe sandbox security). Falling back to memory storage.", e);
  safeStorage = new MemoryStorage();
}

// ── Raw Storage Getters/Setters ───────────────────────────

function getList<T>(key: string): T[] {
  try {
    const raw = safeStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setList<T>(key: string, list: T[]): void {
  commitStorageUpdates(safeStorage, { [key]: JSON.stringify(list) });
}

// Keys
const KEYS = {
  characters: "aetherborne_characters",
  equipment: "aetherborne_equipment",
  currencies: "aetherborne_currencies",
  inventory: "aetherborne_inventory",
  essences: "aetherborne_essences",
  abilities: "aetherborne_abilities",
  skills: "aetherborne_skills",
  rolls: "aetherborne_rolls",
  notes: "aetherborne_notes",
  recaps: "aetherborne_recaps",
  codex: "aetherborne_codex",
  unlocked_passwords: "aetherborne_unlocked_passwords",
};

// ── Computed Character Helper ─────────────────────────────

export function getModifierForStat(val: number, rank: string = "Iron"): number {
  const r = (rank || "Iron").trim().toLowerCase();
  if (r === "bronze") return Math.floor(val / 2);
  if (r === "silver") return val;
  if (r === "gold") return val * 2;
  if (r === "diamond") return val * 3;
  // Default to Iron (3:1 ratio)
  return Math.floor(val / 3);
}

export function getAdjustedStats(char: Character, equipment: Equipment[], abilities: Ability[] = []): {
  stats: Record<string, number>;
  modifiers: Record<string, number>;
  diceLabels: Record<string, string>;
  baseMaxHp: number;
  totalMaxHp: number;
  maxHp: number;
  baseMaxMana: number;
  totalMaxMana: number;
  maxMana: number;
  baseMaxDt: number;
  totalMaxDt: number;
  maxDt: number;
  maxInitiative: number;
  hpAddBonus: number;
  hpBuffBonus: number;
  manaAddBonus: number;
  manaBuffBonus: number;
  dtAddBonus: number;
  dtBuffBonus: number;
  abilityHpBonus: number;
  abilityManaBonus: number;
  abilityDtBonus: number;
  abilityInitiativeBonus: number;
} {
  // Sum equipped modifiers
  const equippedList = equipment.filter(e => e.characterId === char.id && e.equipped);
  
  const stats: Record<string, number> = {
    power: char.power,
    vitality: char.vitality,
    spirit: char.spirit,
    agility: char.agility,
    endurance: char.endurance,
    precision: char.precision,
    willpower: char.willpower,
    charisma: char.charisma,
  };

  // Add equipment modifiers
  for (const item of equippedList) {
    if (item.statModifiers) {
      for (const [stat, bonus] of Object.entries(item.statModifiers)) {
        const lowerStat = stat.toLowerCase();
        if (lowerStat in stats) {
          stats[lowerStat] += parseFormulaOrNum(bonus, {});
        }
      }
    }
  }

  // Calculate equipped armor DT bonus
  const armorDtBonus = equippedList.reduce((sum, item) => sum + parseFormulaOrNum(item.dtBonus, {}), 0);

  // Helper to build formula evaluation variables map
  const buildVars = (sMap: Record<string, number>) => ({
    power: sMap.power || 0,
    pow: sMap.power || 0,
    vitality: sMap.vitality || 0,
    vit: sMap.vitality || 0,
    spirit: sMap.spirit || 0,
    spi: sMap.spirit || 0,
    agility: sMap.agility || 0,
    agi: sMap.agility || 0,
    endurance: sMap.endurance || 0,
    end: sMap.endurance || 0,
    precision: sMap.precision || 0,
    pre: sMap.precision || 0,
    willpower: sMap.willpower || 0,
    wil: sMap.willpower || 0,
    charisma: sMap.charisma || 0,
    cha: sMap.charisma || 0,
    powr: getModifierForStat(sMap.power || 0, char.rank),
    vitr: getModifierForStat(sMap.vitality || 0, char.rank),
    spir: getModifierForStat(sMap.spirit || 0, char.rank),
    agir: getModifierForStat(sMap.agility || 0, char.rank),
    endr: getModifierForStat(sMap.endurance || 0, char.rank),
    prer: getModifierForStat(sMap.precision || 0, char.rank),
    wilr: getModifierForStat(sMap.willpower || 0, char.rank),
    char: getModifierForStat(sMap.charisma || 0, char.rank),
    dtbonus: parseFormulaOrNum(char.dtBonus, sMap) + armorDtBonus,
  });

  // Add active ability & sub-ability stat bonuses
  const activeAbilities = abilities.filter(a => a.active === true);
  for (const ability of activeAbilities) {
    const curVars = buildVars(stats);
    if (ability.bonusPower) stats.power += parseFormulaOrNum(ability.bonusPower, curVars);
    if (ability.bonusVitality) stats.vitality += parseFormulaOrNum(ability.bonusVitality, curVars);
    if (ability.bonusSpirit) stats.spirit += parseFormulaOrNum(ability.bonusSpirit, curVars);
    if (ability.bonusAgility) stats.agility += parseFormulaOrNum(ability.bonusAgility, curVars);
    if (ability.bonusEndurance) stats.endurance += parseFormulaOrNum(ability.bonusEndurance, curVars);
    if (ability.bonusPrecision) stats.precision += parseFormulaOrNum(ability.bonusPrecision, curVars);
    if (ability.bonusWillpower) stats.willpower += parseFormulaOrNum(ability.bonusWillpower, curVars);
    if (ability.bonusCharisma) stats.charisma += parseFormulaOrNum(ability.bonusCharisma, curVars);

    if (ability.subAbilities && ability.subAbilities.length > 0) {
      for (const sub of ability.subAbilities) {
        const subVars = buildVars(stats);
        if (sub.bonusPower) stats.power += parseFormulaOrNum(sub.bonusPower, subVars);
        if (sub.bonusVitality) stats.vitality += parseFormulaOrNum(sub.bonusVitality, subVars);
        if (sub.bonusSpirit) stats.spirit += parseFormulaOrNum(sub.bonusSpirit, subVars);
        if (sub.bonusAgility) stats.agility += parseFormulaOrNum(sub.bonusAgility, subVars);
        if (sub.bonusEndurance) stats.endurance += parseFormulaOrNum(sub.bonusEndurance, subVars);
        if (sub.bonusPrecision) stats.precision += parseFormulaOrNum(sub.bonusPrecision, subVars);
        if (sub.bonusWillpower) stats.willpower += parseFormulaOrNum(sub.bonusWillpower, subVars);
        if (sub.bonusCharisma) stats.charisma += parseFormulaOrNum(sub.bonusCharisma, subVars);
      }
    }
  }

  // Calculate auto-modifiers scaling with Rank (Iron 3:1, Bronze 2:1, Silver 1:1, Gold 1:2, Diamond 1:3)
  const modifiers: Record<string, number> = {};
  for (const [stat, val] of Object.entries(stats)) {
    modifiers[stat] = getModifierForStat(val, char.rank);
  }

  // Calculate dice labels
  const diceLabels: Record<string, string> = {};
  for (const [stat, val] of Object.entries(stats)) {
    diceLabels[stat] = getDiceLabel(val);
  }

  // Compute derived maximums using variables
  const variables = buildVars(stats);

  // Sum active ability & item resource bonuses (evaluating formulas like 2+wil)
  const hpAddBonus = activeAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.hpAdd, variables), 0);
  const hpBuffBonus = activeAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.hpBuff, variables), 0);
  const manaAddBonus = activeAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.manaAdd, variables), 0);
  const manaBuffBonus = activeAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.manaBuff, variables), 0);
  const dtAddBonus = activeAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.dtAdd, variables), 0);
  const dtBuffBonus = activeAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.dtBuff, variables), 0);
  const abilityInitiativeBonus = activeAbilities.reduce((sum, ab) => sum + parseFormulaOrNum(ab.bonusInitiative, variables), 0);
  const equipmentInitiativeBonus = equippedList.reduce((sum, eq) => sum + parseFormulaOrNum(eq.bonusInitiative, variables), 0);

  const rawHp = evaluateFormula(char.hpFormula || "Vitality * 10 + Endurance * 5", variables);
  const rawMana = evaluateFormula(char.manaFormula || "Spirit * 10 + Willpower * 5", variables);
  const rawDt = evaluateFormula(char.dtFormula || "Endurance * 2 + dtBonus", variables);
  const rawInitiative = evaluateFormula(char.initiativeFormula || "Agility", variables);

  const baseMaxHp = Math.max(1, (rawHp || 1) + hpAddBonus);
  const totalMaxHp = Math.max(1, baseMaxHp + hpBuffBonus);

  const baseMaxMana = Math.max(0, (rawMana || 0) + manaAddBonus);
  const totalMaxMana = Math.max(0, baseMaxMana + manaBuffBonus);

  const baseMaxDt = Math.max(0, (rawDt || 0) + dtAddBonus);
  const totalMaxDt = Math.max(0, baseMaxDt + dtBuffBonus);

  const maxInitiative = (rawInitiative || 0) + (abilityInitiativeBonus || 0) + (equipmentInitiativeBonus || 0);

  return {
    stats,
    modifiers,
    diceLabels,
    baseMaxHp,
    totalMaxHp,
    maxHp: totalMaxHp,
    baseMaxMana,
    totalMaxMana,
    maxMana: totalMaxMana,
    baseMaxDt,
    totalMaxDt,
    maxDt: totalMaxDt,
    maxInitiative: isNaN(maxInitiative) ? 0 : maxInitiative,
    hpAddBonus,
    hpBuffBonus,
    manaAddBonus,
    manaBuffBonus,
    dtAddBonus,
    dtBuffBonus,
    abilityHpBonus: hpAddBonus + hpBuffBonus,
    abilityManaBonus: manaAddBonus + manaBuffBonus,
    abilityDtBonus: dtAddBonus + dtBuffBonus,
    abilityInitiativeBonus: abilityInitiativeBonus + equipmentInitiativeBonus,
  };
}

function dieForValue(v: number): number {
  if (v <= 4) return 4;
  if (v <= 6) return 6;
  if (v <= 8) return 8;
  if (v <= 10) return 10;
  if (v <= 12) return 12;
  return 20;
}

function getStatDiceSizes(stat: number): number[] {
  if (stat <= 20) return [dieForValue(stat)];
  return [20, ...getStatDiceSizes(stat - 20)];
}

export function getDiceLabel(stat: number): string {
  return getStatDiceSizes(stat).map(d => `d${d}`).join("+");
}

// ── CRUD Methods ──────────────────────────────────────────

export const storage = {
  // Characters
  getCharacters(): Character[] {
    initializeDefaultSample();
    const chars = getList<Character>(KEYS.characters);
    let migrated = false;
    chars.forEach((c: any) => {
      // 1. className -> rank
      if (c.className !== undefined && c.rank === undefined) {
        c.rank = c.className === "Defender" || c.className === "Mage" || c.className === "Rogue" ? "Iron" : c.className;
        delete c.className;
        migrated = true;
      }
      if (!c.rank) {
        c.rank = "Iron";
        migrated = true;
      }
      // 2. single familiar -> familiars array
      if (c.familiar !== undefined && c.familiars === undefined) {
        c.familiars = c.familiar ? [{ ...c.familiar, id: Date.now() }] : [];
        delete c.familiar;
        migrated = true;
      }
      if (!c.familiars) {
        c.familiars = [];
        migrated = true;
      }
      // 3. resistances / immunities init
      if (c.resistances === undefined) {
        c.resistances = "";
        migrated = true;
      }
      if (c.immunities === undefined) {
        c.immunities = "";
        migrated = true;
      }
    });
    if (migrated) {
      setList(KEYS.characters, chars);
    }
    return chars;
  },

  getCharacter(id: number): Character | null {
    const chars = this.getCharacters();
    return chars.find(c => c.id === id) || null;
  },

  createCharacter(data: Omit<Character, "id" | "createdAt" | "updatedAt">): Character {
    const chars = this.getCharacters();
    const newId = chars.length > 0 ? Math.max(...chars.map(c => c.id)) + 1 : 1;
    const now = new Date().toISOString();
    const character: Character = {
      ...data,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    chars.push(character);
    setList(KEYS.characters, chars);

    // Auto-seed base campaign lore notes (places, characters, factions, bestiary)
    const list = getList<Note>(KEYS.notes);
    let noteId = list.length > 0 ? Math.max(...list.map(n => n.id)) + 1 : 1;
    const BASE_CAMPAIGN_NOTES = [
      { title: "Faction: The Wardens of AEther", content: "An elite order of knights and magi sworn to defend civilization against the corruption of the deep rift.", category: "lore", tags: ["factions", "wardens"] },
      { title: "Faction: The Riftstriders", content: "A loose syndicate of smugglers, explorers, and rogue scholars who venture deep into the rift to seek ancient relics.", category: "lore", tags: ["factions", "riftstriders"] },
      { title: "Aria, the Campfire Keeper", content: "A mysterious warden who tends the AEther flames. She speaks in riddles but offers guidance to travelers.", category: "npc", tags: ["keeper", "campfire"] },
      { title: "Commander Vane", content: "Leader of the Citadel Wardens. A battle-scarred veteran who distrusts magic but values survival.", category: "npc", tags: ["wardens", "citadel"] },
      { title: "The Campfire", content: "The safe haven of adventurers. A magical flame that wards off the shadows of the outer wilds.", category: "location", tags: ["safehaven", "campfire"] },
      { title: "AEtherpoint Citadel", content: "The last bastion of civilization. Built on the edge of the great rift, powered by condensed AEther crystals.", category: "location", tags: ["city", "citadel"] },
      { title: "The AEther Corruption", content: "A dark energy that leaks from the rift. It warps living creatures and twists thoughts, driving the weak-willed to madness.", category: "lore", tags: ["corruption", "rift"] },
      { title: "The Legend of AEtherborne", content: "Those born with the unique capability to channel AEther energy without succumbing to corruption are known as AEtherborne.", category: "lore", tags: ["legends", "aetherborne"] },
      { title: "Rift Wolf", content: "Pack hunters that roam the outer rims of the great rift. Their bodies glow with unstable AEther energy.", category: "bestiary", tags: ["beast", "monster", "wolf"] },
      { title: "AEther Stalker", content: "Insubstantial monstrosities that hide in shadows and feed on raw magic and psychic essence.", category: "bestiary", tags: ["beast", "monster", "stalker"] }
    ];
    BASE_CAMPAIGN_NOTES.forEach(note => {
      list.push({
        ...note,
        id: noteId++,
        characterId: newId,
        images: [],
        createdAt: now,
        updatedAt: now
      });
    });
    setList(KEYS.notes, list);

    return character;
  },

  updateCharacter(id: number, data: Partial<Omit<Character, "id" | "createdAt" | "updatedAt">>): Character {
    const chars = this.getCharacters();
    const idx = chars.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Character not found");

    const updated: Character = {
      ...chars[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    chars[idx] = updated;
    setList(KEYS.characters, chars);
    return updated;
  },

  deleteCharacter(id: number): void {
    let chars = this.getCharacters();
    chars = chars.filter(c => c.id !== id);
    setList(KEYS.characters, chars);

    // Delete cascade linked items
    setList(KEYS.equipment, getList<Equipment>(KEYS.equipment).filter(e => e.characterId !== id));
    setList(KEYS.currencies, getList<Currency>(KEYS.currencies).filter(c => c.characterId !== id));
    setList(KEYS.inventory, getList<InventoryItem>(KEYS.inventory).filter(i => i.characterId !== id));
    setList(KEYS.essences, getList<Essence>(KEYS.essences).filter(e => e.characterId !== id));
    setList(KEYS.abilities, getList<Ability>(KEYS.abilities).filter(a => a.characterId !== id));
    setList(KEYS.skills, getList<Skill>(KEYS.skills).filter(s => s.characterId !== id));
    setList(KEYS.rolls, getList<Roll>(KEYS.rolls).filter(r => r.characterId !== id));
    setList(KEYS.notes, getList<Note>(KEYS.notes).filter(n => n.characterId !== id));
  },

  // Equipment
  getEquipment(charId: number): Equipment[] {
    return getList<Equipment>(KEYS.equipment).filter(e => e.characterId === charId);
  },

  addEquipment(data: Omit<Equipment, "id">): Equipment {
    const list = getList<Equipment>(KEYS.equipment);
    const newId = list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1;
    const item: Equipment = { ...data, id: newId };
    list.push(item);
    setList(KEYS.equipment, list);
    return item;
  },

  updateEquipment(id: number, data: Partial<Omit<Equipment, "id" | "characterId">>): Equipment {
    const list = getList<Equipment>(KEYS.equipment);
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) throw new Error("Equipment not found");
    const updated = { ...list[idx], ...data };
    list[idx] = updated;
    setList(KEYS.equipment, list);
    return updated;
  },

  deleteEquipment(id: number): void {
    const list = getList<Equipment>(KEYS.equipment).filter(e => e.id !== id);
    setList(KEYS.equipment, list);
  },

  // Currencies
  getCurrencies(charId: number): Currency[] {
    return getList<Currency>(KEYS.currencies).filter(c => c.characterId === charId);
  },

  addCurrency(data: Omit<Currency, "id">): Currency {
    const list = getList<Currency>(KEYS.currencies);
    const newId = list.length > 0 ? Math.max(...list.map(c => c.id)) + 1 : 1;
    const item: Currency = { ...data, id: newId };
    list.push(item);
    setList(KEYS.currencies, list);
    return item;
  },

  updateCurrency(id: number, amount: number): Currency {
    const list = getList<Currency>(KEYS.currencies);
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) throw new Error("Currency not found");
    list[idx].amount = amount;
    setList(KEYS.currencies, list);
    return list[idx];
  },

  deleteCurrency(id: number): void {
    const list = getList<Currency>(KEYS.currencies).filter(c => c.id !== id);
    setList(KEYS.currencies, list);
  },

  // General Inventory
  getInventory(charId: number): InventoryItem[] {
    return getList<InventoryItem>(KEYS.inventory).filter(i => i.characterId === charId);
  },

  addInventoryItem(data: Omit<InventoryItem, "id">): InventoryItem {
    const list = getList<InventoryItem>(KEYS.inventory);
    const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    const item: InventoryItem = { ...data, id: newId };
    list.push(item);
    setList(KEYS.inventory, list);
    return item;
  },

  updateInventoryItem(id: number, data: Partial<Omit<InventoryItem, "id" | "characterId">>): InventoryItem {
    const list = getList<InventoryItem>(KEYS.inventory);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) throw new Error("Item not found");
    const updated = { ...list[idx], ...data };
    list[idx] = updated;
    setList(KEYS.inventory, list);
    return updated;
  },

  deleteInventoryItem(id: number): void {
    const list = getList<InventoryItem>(KEYS.inventory).filter(i => i.id !== id);
    setList(KEYS.inventory, list);
  },

  // Essences
  getEssences(charId: number): Essence[] {
    return getList<Essence>(KEYS.essences).filter(e => e.characterId === charId).sort((a,b) => a.slot - b.slot);
  },

  addEssence(data: Omit<Essence, "id">): Essence {
    const list = getList<Essence>(KEYS.essences);
    // Remove if there's already an essence in this slot
    const filtered = list.filter(e => !(e.characterId === data.characterId && e.slot === data.slot));
    const newId = list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1;
    const item: Essence = { ...data, id: newId };
    filtered.push(item);
    setList(KEYS.essences, filtered);
    return item;
  },

  deleteEssence(id: number): void {
    const list = getList<Essence>(KEYS.essences).filter(e => e.id !== id);
    setList(KEYS.essences, list);
  },

  // Shaped Abilities
  getAbilities(charId: number): Ability[] {
    return getList<Ability>(KEYS.abilities).filter(a => a.characterId === charId);
  },

  addAbility(data: Omit<Ability, "id">): Ability {
    const list = getList<Ability>(KEYS.abilities);
    const newId = list.length > 0 ? Math.max(...list.map(a => a.id)) + 1 : 1;
    const item: Ability = { ...data, id: newId };
    list.push(item);
    setList(KEYS.abilities, list);
    return item;
  },

  updateAbility(id: number, data: Partial<Omit<Ability, "id" | "characterId">>): Ability {
    const list = getList<Ability>(KEYS.abilities);
    const idx = list.findIndex(a => a.id === id);
    if (idx === -1) throw new Error("Ability not found");
    const updated = { ...list[idx], ...data };
    list[idx] = updated;
    setList(KEYS.abilities, list);
    return updated;
  },

  deleteAbility(id: number): void {
    const list = getList<Ability>(KEYS.abilities).filter(a => a.id !== id);
    setList(KEYS.abilities, list);
  },

  // Skills
  getSkills(charId: number): Skill[] {
    return getList<Skill>(KEYS.skills).filter(s => s.characterId === charId);
  },

  addSkill(data: Omit<Skill, "id">): Skill {
    const list = getList<Skill>(KEYS.skills);
    const newId = list.length > 0 ? Math.max(...list.map(s => s.id)) + 1 : 1;
    const item: Skill = { ...data, id: newId };
    list.push(item);
    setList(KEYS.skills, list);
    return item;
  },

  updateSkill(id: number, data: Partial<Omit<Skill, "id" | "characterId">>): Skill {
    const list = getList<Skill>(KEYS.skills);
    const idx = list.findIndex(s => s.id === id);
    if (idx === -1) throw new Error("Skill not found");
    const updated = { ...list[idx], ...data };
    list[idx] = updated;
    setList(KEYS.skills, list);
    return updated;
  },

  deleteSkill(id: number): void {
    const list = getList<Skill>(KEYS.skills).filter(s => s.id !== id);
    setList(KEYS.skills, list);
  },

  // Notes
  getNotes(charId?: number): Note[] {
    const list = getList<Note>(KEYS.notes);
    if (charId !== undefined) {
      return list.filter(n => n.characterId === charId);
    }
    return list;
  },

  addNote(data: Omit<Note, "id" | "createdAt" | "updatedAt">): Note {
    const list = getList<Note>(KEYS.notes);
    const newId = list.length > 0 ? Math.max(...list.map(n => n.id)) + 1 : 1;
    const now = new Date().toISOString();
    const note: Note = { ...data, id: newId, createdAt: now, updatedAt: now };
    list.push(note);
    setList(KEYS.notes, list);
    return note;
  },

  updateNote(id: number, data: Partial<Omit<Note, "id" | "characterId" | "createdAt" | "updatedAt">>): Note {
    const list = getList<Note>(KEYS.notes);
    const idx = list.findIndex(n => n.id === id);
    if (idx === -1) throw new Error("Note not found");
    const updated = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    list[idx] = updated;
    setList(KEYS.notes, list);
    return updated;
  },

  deleteNote(id: number): void {
    const list = getList<Note>(KEYS.notes).filter(n => n.id !== id);
    setList(KEYS.notes, list);
  },

  // Codex Notes
  getCodexNotes(): CodexNote[] {
    let list = getList<CodexNote>(KEYS.codex);
    if (list.length === 0) {
      list = initialCodex as CodexNote[];
      setList(KEYS.codex, list);
    } else {
      let modified = false;
      const initialCodexMap = new Map((initialCodex as CodexNote[]).map(ic => [ic.title.toLowerCase(), ic]));

      // 1. Deduplicate by title & align IDs with compiled entries to avoid sequence collisions
      const seen = new Set<string>();
      const dedupedList: CodexNote[] = [];
      list.forEach(n => {
        const lowerTitle = n.title.toLowerCase();
        if (!seen.has(lowerTitle)) {
          seen.add(lowerTitle);
          const initMatch = initialCodexMap.get(lowerTitle);
          if (initMatch && n.id !== initMatch.id) {
            modified = true;
            dedupedList.push({ ...n, id: initMatch.id });
          } else {
            dedupedList.push(n);
          }
        } else {
          modified = true;
        }
      });
      list = dedupedList;

      // 2. Sync updated fields for existing records
      list = list.map(n => {
        const initMatch = initialCodexMap.get(n.title.toLowerCase());
        if (initMatch) {
          if (
            n.stateId !== initMatch.stateId || 
            n.parentBurgId !== initMatch.parentBurgId || 
            n.isState !== initMatch.isState || 
            n.isCapital !== initMatch.isCapital ||
            n.population !== initMatch.population ||
            !n.subcategory
          ) {
            modified = true;
            return {
              ...n,
              stateId: initMatch.stateId,
              parentBurgId: initMatch.parentBurgId,
              isState: initMatch.isState,
              isCapital: initMatch.isCapital,
              population: initMatch.population,
              coordinates: initMatch.coordinates || n.coordinates,
              subcategory: initMatch.subcategory || n.subcategory,
              category: initMatch.category || n.category
            };
          }
        }
        
        if (!n.subcategory) {
          modified = true;
          const subcat = initMatch?.subcategory || (n.category === "location" ? "world-landmarks" : n.category === "npc" ? "entities-npcs" : n.category === "bestiary" ? "bestiary-monsters" : "lore-myths");
          return { ...n, subcategory: subcat };
        }
        return n;
      });

      // 3. Append new entries from initialCodex (like state pages, new landmarks)
      const existingTitles = new Set(list.map(n => n.title.toLowerCase()));
      (initialCodex as CodexNote[]).forEach(initNote => {
        if (!existingTitles.has(initNote.title.toLowerCase())) {
          list.push(initNote);
          modified = true;
        }
      });

      if (modified) {
        setList(KEYS.codex, list);
      }
    }
    return list;
  },

  addCodexNote(data: Omit<CodexNote, "id" | "createdAt" | "updatedAt">): CodexNote {
    const list = getList<CodexNote>(KEYS.codex);
    const newId = list.length > 0 ? Math.max(...list.map(n => n.id)) + 1 : 1;
    const now = new Date().toISOString();
    const note: CodexNote = { ...data, id: newId, createdAt: now, updatedAt: now };
    list.push(note);
    setList(KEYS.codex, list);
    return note;
  },

  updateCodexNote(id: number, data: Partial<Omit<CodexNote, "id" | "createdAt" | "updatedAt">>): CodexNote {
    const list = getList<CodexNote>(KEYS.codex);
    const idx = list.findIndex(n => n.id === id);
    if (idx === -1) throw new Error("Codex note not found");
    const updated = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    list[idx] = updated;
    setList(KEYS.codex, list);
    return updated;
  },

  deleteCodexNote(id: number): void {
    const list = getList<CodexNote>(KEYS.codex).filter(n => n.id !== id);
    setList(KEYS.codex, list);
  },

  getUnlockedPasswords(): string[] {
    const data = safeStorage.getItem(KEYS.unlocked_passwords);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  unlockPassword(password: string): void {
    const list = this.getUnlockedPasswords();
    const sanitize = (str: string) => 
      (str || "")
        .trim()
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“]/g, "")
        .replace(/\s+/g, " ");
    const cleanPw = sanitize(password);
    if (cleanPw && !list.includes(cleanPw)) {
      list.push(cleanPw);
      safeStorage.setItem(KEYS.unlocked_passwords, JSON.stringify(list));
    }
  },

  lockPassword(password: string): void {
    const sanitize = (str: string) => 
      (str || "")
        .trim()
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“]/g, "")
        .replace(/\s+/g, " ");
    const cleanPw = sanitize(password);
    const list = this.getUnlockedPasswords().filter(p => p !== cleanPw);
    safeStorage.setItem(KEYS.unlocked_passwords, JSON.stringify(list));
  },

  // Rolls log
  getRolls(charId: number): Roll[] {
    return getList<Roll>(KEYS.rolls).filter(r => r.characterId === charId).sort((a,b) => new Date(b.rolledAt).getTime() - new Date(a.rolledAt).getTime());
  },

  getRecentRolls(): (Roll & { characterName: string })[] {
    const rolls = getList<Roll>(KEYS.rolls);
    const chars = getList<Character>(KEYS.characters);
    return rolls
      .map(r => {
        const char = chars.find(c => c.id === r.characterId);
        return {
          ...r,
          characterName: char ? char.name : "Unknown Hero",
        };
      })
      .sort((a,b) => new Date(b.rolledAt).getTime() - new Date(a.rolledAt).getTime())
      .slice(0, 20);
  },

  addRoll(data: Omit<Roll, "id" | "rolledAt">): Roll {
    const list = getList<Roll>(KEYS.rolls);
    const newId = list.length > 0 ? Math.max(...list.map(r => r.id)) + 1 : 1;
    const roll: Roll = { ...data, id: newId, rolledAt: new Date().toISOString() };
    list.push(roll);
    setList(KEYS.rolls, list);
    return roll;
  },

  // Session Recaps
  getRecaps(): SessionRecap[] {
    initializeDefaultSample();
    return getList<SessionRecap>(KEYS.recaps).sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createRecap(title: string, content: string): SessionRecap {
    const list = getList<SessionRecap>(KEYS.recaps);
    const newId = list.length > 0 ? Math.max(...list.map(r => r.id)) + 1 : 1;
    const recap: SessionRecap = {
      id: newId,
      title,
      content,
      createdAt: new Date().toISOString()
    };
    list.push(recap);
    setList(KEYS.recaps, list);
    return recap;
  },

  deleteRecap(id: number): void {
    const list = getList<SessionRecap>(KEYS.recaps).filter(r => r.id !== id);
    setList(KEYS.recaps, list);
  },
};

// ── JSON Import / Export Functions ─────────────────────────

const DEFAULT_CHARACTER: Omit<Character, "id" | "name"> = {
  rank: "Iron",
  race: "Human",
  level: 1,
  maxHp: 20,
  currentHp: 20,
  dtBonus: 0,
  currentDt: 0,
  speed: 30,
  power: 10,
  vitality: 10,
  spirit: 10,
  agility: 10,
  endurance: 10,
  precision: 10,
  willpower: 10,
  charisma: 10,
  currentMana: 10,
  background: null,
  backstory: null,
  hpFormula: "Vitality * 8",
  manaFormula: "Spirit * 5",
  dtFormula: "Endurance * 1",
  powerTraining: 0,
  vitalityTraining: 0,
  spiritTraining: 0,
  agilityTraining: 0,
  enduranceTraining: 0,
  precisionTraining: 0,
  willpowerTraining: 0,
  charismaTraining: 0,
  favorites: Array(20).fill(null),
  familiars: [],
  resistances: "",
  immunities: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const DEFAULT_FAMILIAR: Omit<Familiar, "id" | "name"> = {
  className: "Companion",
  race: "Beast",
  level: 1,
  speed: 25,
  power: 10,
  vitality: 10,
  spirit: 10,
  agility: 10,
  endurance: 10,
  precision: 10,
  willpower: 10,
  charisma: 10,
  currentHp: 10,
  currentMana: 10,
  currentDt: 0,
  dtBonus: 0,
  hpFormula: "Vitality * 8",
  manaFormula: "Spirit * 5",
  dtFormula: "Endurance * 1",
  abilities: [],
  resistances: "",
  immunities: ""
};

const DEFAULT_EQUIPMENT: Omit<Equipment, "id" | "characterId" | "name"> = {
  description: "",
  equipped: false,
  assignedToQuickRolls: false,
  dtBonus: 0,
  statModifiers: {},
  diceType: "d8",
  modifier: 0
};

const DEFAULT_CURRENCY: Omit<Currency, "id" | "characterId" | "name"> = {
  amount: 0
};

const DEFAULT_INVENTORY_ITEM: Omit<InventoryItem, "id" | "characterId" | "name"> = {
  description: "",
  quantity: 1
};

const DEFAULT_ESSENCE: Omit<Essence, "id" | "characterId" | "name"> = {
  description: "",
  slot: 1
};

const DEFAULT_ABILITY: Omit<Ability, "id" | "characterId" | "name"> = {
  description: "",
  cost: 0,
  cooldown: 0,
  range: "Self",
  speed: "Instant",
  rollFormula: "",
  linkedStats: [],
  assignedToQuickRolls: false,
  level: 1,
  active: false,
  bonusPower: 0,
  bonusVitality: 0,
  bonusSpirit: 0,
  bonusAgility: 0,
  bonusEndurance: 0,
  bonusPrecision: 0,
  bonusWillpower: 0,
  bonusCharisma: 0,
  hpAdd: 0,
  hpBuff: 0,
  manaAdd: 0,
  manaBuff: 0,
  dtAdd: 0,
  dtBuff: 0,
  essenceId: null,
  resistances: "",
  immunities: "",
  equipmentId: null,
  inventoryItemId: null,
  usageType: "Permanent",
  maxCharges: 0,
  currentCharges: 0
};

const DEFAULT_SKILL: Omit<Skill, "id" | "characterId" | "name"> = {
  value: 3,
  training: 0,
  category: null
};

const DEFAULT_NOTE: Omit<Note, "id" | "characterId" | "createdAt" | "updatedAt"> = {
  title: "Untitled Note",
  content: "",
  category: "general",
  tags: [],
  images: []
};

export function exportCharacterJSON(charId: number): void {
  const char = storage.getCharacter(charId);
  if (!char) return;

  const data = {
    character: char,
    equipment: storage.getEquipment(charId),
    currencies: storage.getCurrencies(charId),
    inventory: storage.getInventory(charId),
    essences: storage.getEssences(charId),
    abilities: storage.getAbilities(charId),
    skills: storage.getSkills(charId),
    notes: storage.getNotes(charId)
  };

  const filename = `${char.name.toLowerCase().replace(/\s+/g, "_")}_sheet.soul`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importCharacterJSON(jsonString: string): Character {
  const data = JSON.parse(jsonString);
  if (!data.character || !data.character.name) {
    throw new Error("Invalid character data structure");
  }

  const chars = storage.getCharacters();
  const nextCharId = chars.length > 0 ? Math.max(...chars.map(c => c.id)) + 1 : 1;

  // Merge legacy or missing character properties with DEFAULT_CHARACTER
  const mergedCharacter = {
    ...DEFAULT_CHARACTER,
    ...data.character
  };

  // Merge familiars if array exists
  if (Array.isArray(mergedCharacter.familiars)) {
    mergedCharacter.familiars = mergedCharacter.familiars.map((fam: any) => ({
      ...DEFAULT_FAMILIAR,
      ...fam,
      id: fam.id || Date.now() + Math.random(),
      name: fam.name || "Companion",
      abilities: Array.isArray(fam.abilities)
        ? fam.abilities.map((ab: any) => ({
            id: ab.id || Date.now() + Math.random(),
            name: ab.name || "Ability",
            description: ab.description || "",
            cost: ab.cost || 0,
            cooldown: ab.cooldown || 0,
            range: ab.range || "Melee",
            speed: ab.speed || "Standard",
            rollFormula: ab.rollFormula || "",
            linkedStat: ab.linkedStat || "power",
            assignedToQuickRolls: !!ab.assignedToQuickRolls
          }))
        : []
    }));
  }

  // Insert character with new ID
  let nameToUse = mergedCharacter.name;
  if (chars.some(c => c.name.toLowerCase() === mergedCharacter.name.toLowerCase())) {
    nameToUse = `${mergedCharacter.name} (Copy)`;
  }

  const importedChar: Character = {
    ...mergedCharacter,
    name: nameToUse,
    id: nextCharId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  chars.push(importedChar);
  setList(KEYS.characters, chars);

  // Helper to remap IDs for nested lists defensively merging with default schemas
  const equipmentIdMap: Record<number, number> = {};
  if (Array.isArray(data.equipment)) {
    const list = getList<Equipment>(KEYS.equipment);
    let nextId = list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1;
    data.equipment.forEach((item: any) => {
      const newId = nextId++;
      if (item.id) {
        equipmentIdMap[item.id] = newId;
      }
      list.push({
        ...DEFAULT_EQUIPMENT,
        ...item,
        id: newId,
        characterId: nextCharId
      });
    });
    setList(KEYS.equipment, list);
  }

  if (Array.isArray(data.currencies)) {
    const list = getList<Currency>(KEYS.currencies);
    let nextId = list.length > 0 ? Math.max(...list.map(c => c.id)) + 1 : 1;
    data.currencies.forEach((item: any) => {
      list.push({
        ...DEFAULT_CURRENCY,
        ...item,
        id: nextId++,
        characterId: nextCharId
      });
    });
    setList(KEYS.currencies, list);
  }

  const inventoryIdMap: Record<number, number> = {};
  if (Array.isArray(data.inventory)) {
    const list = getList<InventoryItem>(KEYS.inventory);
    let nextId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1;
    data.inventory.forEach((item: any) => {
      const newId = nextId++;
      if (item.id) {
        inventoryIdMap[item.id] = newId;
      }
      list.push({
        ...DEFAULT_INVENTORY_ITEM,
        ...item,
        id: newId,
        characterId: nextCharId
      });
    });
    setList(KEYS.inventory, list);
  }

  const essenceIdMap: Record<number, number> = {};
  if (Array.isArray(data.essences)) {
    const list = getList<Essence>(KEYS.essences);
    let nextId = list.length > 0 ? Math.max(...list.map(e => e.id)) + 1 : 1;
    data.essences.forEach((item: any) => {
      const newId = nextId++;
      if (item.id) {
        essenceIdMap[item.id] = newId;
      }
      list.push({
        ...DEFAULT_ESSENCE,
        ...item,
        id: newId,
        characterId: nextCharId
      });
    });
    setList(KEYS.essences, list);
  }

  if (Array.isArray(data.abilities)) {
    const list = getList<Ability>(KEYS.abilities);
    let nextId = list.length > 0 ? Math.max(...list.map(a => a.id)) + 1 : 1;
    data.abilities.forEach((item: any) => {
      const oldEssId = item.essenceId;
      const newEssId = oldEssId && essenceIdMap[oldEssId] ? essenceIdMap[oldEssId] : null;

      const oldEqId = item.equipmentId;
      const newEqId = oldEqId && equipmentIdMap[oldEqId] ? equipmentIdMap[oldEqId] : null;

      const oldInvItemId = item.inventoryItemId;
      const newInvItemId = oldInvItemId && inventoryIdMap[oldInvItemId] ? inventoryIdMap[oldInvItemId] : null;

      // Handle legacy linkedStat rekeying defensively
      let mappedStats = item.linkedStats;
      if (!mappedStats && item.linkedStat) {
        mappedStats = [item.linkedStat];
      } else if (!mappedStats) {
        mappedStats = [];
      }

      list.push({
        ...DEFAULT_ABILITY,
        ...item,
        id: nextId++,
        characterId: nextCharId,
        essenceId: newEssId,
        equipmentId: newEqId,
        inventoryItemId: newInvItemId,
        linkedStats: mappedStats
      });
    });
    setList(KEYS.abilities, list);
  }

  if (Array.isArray(data.skills)) {
    const list = getList<Skill>(KEYS.skills);
    let nextId = list.length > 0 ? Math.max(...list.map(s => s.id)) + 1 : 1;
    data.skills.forEach((item: any) => {
      list.push({
        ...DEFAULT_SKILL,
        ...item,
        id: nextId++,
        characterId: nextCharId
      });
    });
    setList(KEYS.skills, list);
  }

  if (Array.isArray(data.notes)) {
    const list = getList<Note>(KEYS.notes);
    let nextId = list.length > 0 ? Math.max(...list.map(n => n.id)) + 1 : 1;
    data.notes.forEach((item: any) => {
      list.push({
        ...DEFAULT_NOTE,
        ...item,
        id: nextId++,
        characterId: nextCharId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
    setList(KEYS.notes, list);
  }

  return importedChar;
}

// Legacy export/import kept for reference / safety
export function exportBackupJSON(): void {
  exportGrimoireBackup();
}

export function importBackupJSON(jsonString: string): { type: "backup" | "character"; count?: number; character?: Character } {
  const data = JSON.parse(jsonString);
  if (data.backup === true || data.grimoireBackup === true) {
    const res = importGrimoireBackup(jsonString);
    return { type: "backup", count: res.count };
  } else if (data.character) {
    const character = importCharacterJSON(jsonString);
    return { type: "character", character };
  } else {
    throw new Error("Invalid backup or character sheet file format");
  }
}

// 1. Full Archive Backup (.archive) - Exports/imports EVERYTHING
export function exportFullBackup(): void {
  const data = {
    fullArchive: true,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    characters: getList<Character>(KEYS.characters),
    equipment: getList<Equipment>(KEYS.equipment),
    currencies: getList<Currency>(KEYS.currencies),
    inventory: getList<InventoryItem>(KEYS.inventory),
    essences: getList<Essence>(KEYS.essences),
    abilities: getList<Ability>(KEYS.abilities),
    skills: getList<Skill>(KEYS.skills),
    notes: getList<Note>(KEYS.notes),
    rolls: getList<any>(KEYS.rolls),
    codex: getList<CodexNote>(KEYS.codex),
    unlockedPasswords: storage.getUnlockedPasswords()
  };

  const filename = `campaign_archive_${new Date().toISOString().slice(0, 10)}.archive`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importFullBackup(jsonString: string): { count: number } {
  const raw = parseImportJson(jsonString) as Record<string, unknown>;
  const data = fullArchiveSchema.parse({ ...raw, fullArchive: raw.fullArchive === true || raw.backup === true });
  assertSupportedVersion(data.schemaVersion);
  validateArchiveRelationships(data);
  commitStorageUpdates(safeStorage, {
    [KEYS.characters]: JSON.stringify(data.characters),
    [KEYS.equipment]: JSON.stringify(data.equipment),
    [KEYS.currencies]: JSON.stringify(data.currencies),
    [KEYS.inventory]: JSON.stringify(data.inventory),
    [KEYS.essences]: JSON.stringify(data.essences),
    [KEYS.abilities]: JSON.stringify(data.abilities),
    [KEYS.skills]: JSON.stringify(data.skills),
    [KEYS.notes]: JSON.stringify(data.notes),
    [KEYS.rolls]: JSON.stringify(data.rolls),
    [KEYS.codex]: JSON.stringify(data.codex),
    [KEYS.unlocked_passwords]: JSON.stringify(data.unlockedPasswords),
    aetherborne_initialized: "true",
  });
  return { count: data.characters.length };
}

// 2. Codex Registry Backup (.codex) - Exports/imports ONLY codex + passwords
export function exportCodexBackup(): void {
  const data = {
    codexBackup: true,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    codex: getList<CodexNote>(KEYS.codex),
    unlockedPasswords: storage.getUnlockedPasswords()
  };

  const filename = `world_lore_${new Date().toISOString().slice(0, 10)}.codex`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importCodexBackup(jsonString: string): { count: number } {
  const raw = parseImportJson(jsonString) as Record<string, unknown>;
  const data = codexBackupSchema.parse({
    ...raw,
    codexBackup: raw.codexBackup === true || raw.backup === true || raw.fullArchive === true,
  });
  assertSupportedVersion(data.schemaVersion);
  commitStorageUpdates(safeStorage, {
    [KEYS.codex]: JSON.stringify(data.codex),
    [KEYS.unlocked_passwords]: JSON.stringify(data.unlockedPasswords),
  });
  return { count: data.codex.length };
}

// 3. Grimoire Roster Backup (.grimoire) - Exports/imports ONLY characters & sheets
export function exportGrimoireBackup(): void {
  const data = {
    grimoireBackup: true,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    characters: getList<Character>(KEYS.characters),
    equipment: getList<Equipment>(KEYS.equipment),
    currencies: getList<Currency>(KEYS.currencies),
    inventory: getList<InventoryItem>(KEYS.inventory),
    essences: getList<Essence>(KEYS.essences),
    abilities: getList<Ability>(KEYS.abilities),
    skills: getList<Skill>(KEYS.skills),
    notes: getList<Note>(KEYS.notes),
    rolls: getList<any>(KEYS.rolls)
  };

  const filename = `roster_sheets_${new Date().toISOString().slice(0, 10)}.grimoire`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importGrimoireBackup(jsonString: string): { count: number } {
  const raw = parseImportJson(jsonString) as Record<string, unknown>;
  const data = grimoireBackupSchema.parse({
    ...raw,
    grimoireBackup: raw.grimoireBackup === true || raw.backup === true || raw.fullArchive === true,
  });
  assertSupportedVersion(data.schemaVersion);
  validateArchiveRelationships(data);
  commitStorageUpdates(safeStorage, {
    [KEYS.characters]: JSON.stringify(data.characters),
    [KEYS.equipment]: JSON.stringify(data.equipment),
    [KEYS.currencies]: JSON.stringify(data.currencies),
    [KEYS.inventory]: JSON.stringify(data.inventory),
    [KEYS.essences]: JSON.stringify(data.essences),
    [KEYS.abilities]: JSON.stringify(data.abilities),
    [KEYS.skills]: JSON.stringify(data.skills),
    [KEYS.notes]: JSON.stringify(data.notes),
    [KEYS.rolls]: JSON.stringify(data.rolls),
    aetherborne_initialized: "true",
  });
  return { count: data.characters.length };
}

// ── Default Mock Database Initialization ──────────────────

function initializeDefaultSample(): void {
  const initialized = safeStorage.getItem("aetherborne_initialized");
  if (initialized === "true") return;

  // Insert Garrick
  const char: Character = {
    id: 1,
    name: "Garrick the Shieldbearer",
    rank: "Iron",
    race: "Human",
    level: 5,
    maxHp: 150,
    currentHp: 150,
    dtBonus: 0,
    currentDt: 14,
    speed: 30,
    power: 14,
    vitality: 15,
    spirit: 8,
    agility: 10,
    endurance: 14,
    precision: 11,
    willpower: 12,
    charisma: 10,
    currentMana: 50,
    background: "Captain of the Outer Walls",
    backstory: "Garrick stood guard during the Siege of Blackwood Forest, single-handedly holding the eastern gate shield line against a horde of wild mythical beasts. He lives by a simple code: shields high, protectors firm.",
    hpFormula: "Vitality * 10 + Endurance * 5",
    manaFormula: "Spirit * 10 + Willpower * 5",
    dtFormula: "Endurance * 2 + dtBonus",
    powerTraining: 4,
    vitalityTraining: 2,
    spiritTraining: 0,
    agilityTraining: 1,
    enduranceTraining: 8,
    precisionTraining: 0,
    willpowerTraining: 3,
    charismaTraining: 0,
    resistances: "Slash, Bludgeon",
    immunities: "Fear",
    familiars: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  setList(KEYS.characters, [char]);

  // Equipment
  const equipment: Equipment[] = [
    {
      id: 1,
      characterId: 1,
      name: "Iron Longsword",
      description: "A standard-issue military blade, heavy but reliable.",
      equipped: true,
      assignedToQuickRolls: true,
      dtBonus: 0,
      statModifiers: { precision: 1 },
      diceType: "d8",
      modifier: 0,
    },
    {
      id: 2,
      characterId: 1,
      name: "Steel Tower Shield",
      description: "An enormous rectangular shield engraved with fortress walls. Absorbs massive impacts.",
      equipped: true,
      assignedToQuickRolls: false,
      dtBonus: 6,
      statModifiers: {},
    },
  ];
  setList(KEYS.equipment, equipment);

  // Currencies
  const currencies: Currency[] = [
    { id: 1, characterId: 1, name: "Gold", amount: 150 },
    { id: 2, characterId: 1, name: "Silver", amount: 30 },
  ];
  setList(KEYS.currencies, currencies);

  // Inventory Items
  const inventory: InventoryItem[] = [
    { id: 1, characterId: 1, name: "Hempen Rope (50ft)", description: "Coiled rope, tough and useful.", quantity: 1 },
    { id: 2, characterId: 1, name: "Iron Rations", description: "Hard tack and dried meat slices.", quantity: 5 },
  ];
  setList(KEYS.inventory, inventory);

  // Essences
  const essences: Essence[] = [
    { id: 1, characterId: 1, name: "Aegis", description: "Shielding energies of ancient steel.", slot: 1 },
    { id: 2, characterId: 1, name: "Earthguard", description: "Defensive solid earth attunement.", slot: 2 },
    { id: 3, characterId: 1, name: "Stoneform", description: "Hardening skin like heavy bedrock.", slot: 3 },
    { id: 4, characterId: 1, name: "Confluence: Bastion of Gaia", description: "Ultimate earth defense alignment.", slot: 4 },
  ];
  setList(KEYS.essences, essences);

  // Abilities
  const abilities: Ability[] = [
    {
      id: 1,
      characterId: 1,
      name: "Stone Aegis",
      description: "Shapes stone armor around yourself. Increases current DT by +6.",
      cost: 10,
      cooldown: 3,
      range: "Self",
      speed: "Instant",
      rollFormula: "d6",
      linkedStat: "willpower",
      linkedStats: ["willpower"],
      assignedToQuickRolls: true,
      level: 1,
    },
    {
      id: 2,
      characterId: 1,
      name: "Earthbreaker Strike",
      description: "Slams your heavy weapon down. Deals bonus earth damage and knocks the target back.",
      cost: 15,
      cooldown: 5,
      range: "Melee",
      speed: "Standard",
      rollFormula: "2d6",
      linkedStat: "power",
      linkedStats: ["power"],
      assignedToQuickRolls: true,
      level: 1,
    },
  ];
  setList(KEYS.abilities, abilities);

  // Skills
  const skills: Skill[] = [
    { id: 1, characterId: 1, name: "Beast Handling", value: 3, training: 0 },
    { id: 2, characterId: 1, name: "Basic Wilderness Knowledge", value: 3, training: 0 },
    { id: 3, characterId: 1, name: "Athletics", value: 6, training: 0 },
  ];
  setList(KEYS.skills, skills);

  // Notes
  const notes: Note[] = [
    {
      id: 1,
      characterId: 1,
      title: "The Blackwood Forest ruins",
      content: "Innkeepers speak of goblins gathering near the ruins in the eastern quadrant. They seem to be looking for shaped artifacts.",
      category: "lore",
      tags: ["Blackwood", "Goblin"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  setList(KEYS.notes, notes);

  // Recaps
  const recaps: SessionRecap[] = [
    {
      id: 1,
      title: "Session 1: Siege of the Blackwood Forest",
      content: "The party successfully defended the eastern gate ruins from a wild night beast raid. Garrick held the gate line with his tower shield. The campfire burns low...",
      createdAt: new Date().toISOString(),
    },
  ];
  setList(KEYS.recaps, recaps);

  safeStorage.setItem("aetherborne_initialized", "true");
}

// ── Ability Evolution Constants & Helpers ──────────────────────────

export const EVOLUTION_THRESHOLDS_TABLE = [
  { index: 0, rankLabel: "Iron 2", requiredStat: 4 },
  { index: 1, rankLabel: "Iron 3", requiredStat: 6 },
  { index: 2, rankLabel: "Iron 4", requiredStat: 8 },
  { index: 3, rankLabel: "Iron 5", requiredStat: 10 },
  { index: 4, rankLabel: "Bronze 1", requiredStat: 12 },
  { index: 5, rankLabel: "Bronze 2", requiredStat: 13 },
  { index: 6, rankLabel: "Bronze 3", requiredStat: 14 },
  { index: 7, rankLabel: "Bronze 4", requiredStat: 15 },
  { index: 8, rankLabel: "Bronze 5", requiredStat: 16 },
  { index: 9, rankLabel: "Silver 1", requiredStat: 17 },
  { index: 10, rankLabel: "Silver 2", requiredStat: 18 },
  { index: 11, rankLabel: "Silver 3", requiredStat: 19 },
  { index: 12, rankLabel: "Silver 4", requiredStat: 20 },
  { index: 13, rankLabel: "Silver 5", requiredStat: 21 },
  { index: 14, rankLabel: "Gold 1", requiredStat: 22 },
  { index: 15, rankLabel: "Gold 2", requiredStat: 23 },
  { index: 16, rankLabel: "Gold 3", requiredStat: 24 },
  { index: 17, rankLabel: "Gold 4", requiredStat: 25 },
  { index: 18, rankLabel: "Gold 5", requiredStat: 26 },
  { index: 19, rankLabel: "Diamond 1", requiredStat: 27 },
  { index: 20, rankLabel: "Diamond 2", requiredStat: 28 },
  { index: 21, rankLabel: "Diamond 3", requiredStat: 29 },
  { index: 22, rankLabel: "Diamond 4", requiredStat: 30 },
  { index: 23, rankLabel: "Diamond 5", requiredStat: 31 },
];

export function getRankForStatValue(val: number): { rank: string; subLevel: number; label: string; index: number } {
  if (val >= 31) return { rank: "Diamond", subLevel: 5, label: "Diamond 5", index: 24 };
  if (val >= 30) return { rank: "Diamond", subLevel: 4, label: "Diamond 4", index: 23 };
  if (val >= 29) return { rank: "Diamond", subLevel: 3, label: "Diamond 3", index: 22 };
  if (val >= 28) return { rank: "Diamond", subLevel: 2, label: "Diamond 2", index: 21 };
  if (val >= 27) return { rank: "Diamond", subLevel: 1, label: "Diamond 1", index: 20 };
  if (val >= 26) return { rank: "Gold", subLevel: 5, label: "Gold 5", index: 19 };
  if (val >= 25) return { rank: "Gold", subLevel: 4, label: "Gold 4", index: 18 };
  if (val >= 24) return { rank: "Gold", subLevel: 3, label: "Gold 3", index: 17 };
  if (val >= 23) return { rank: "Gold", subLevel: 2, label: "Gold 2", index: 16 };
  if (val >= 22) return { rank: "Gold", subLevel: 1, label: "Gold 1", index: 15 };
  if (val >= 21) return { rank: "Silver", subLevel: 5, label: "Silver 5", index: 14 };
  if (val >= 20) return { rank: "Silver", subLevel: 4, label: "Silver 4", index: 13 };
  if (val >= 19) return { rank: "Silver", subLevel: 3, label: "Silver 3", index: 12 };
  if (val >= 18) return { rank: "Silver", subLevel: 2, label: "Silver 2", index: 11 };
  if (val >= 17) return { rank: "Silver", subLevel: 1, label: "Silver 1", index: 10 };
  if (val >= 16) return { rank: "Bronze", subLevel: 5, label: "Bronze 5", index: 9 };
  if (val >= 15) return { rank: "Bronze", subLevel: 4, label: "Bronze 4", index: 8 };
  if (val >= 14) return { rank: "Bronze", subLevel: 3, label: "Bronze 3", index: 7 };
  if (val >= 13) return { rank: "Bronze", subLevel: 2, label: "Bronze 2", index: 6 };
  if (val >= 12) return { rank: "Bronze", subLevel: 1, label: "Bronze 1", index: 5 };
  if (val >= 10) return { rank: "Iron", subLevel: 5, label: "Iron 5", index: 4 };
  if (val >= 8) return { rank: "Iron", subLevel: 4, label: "Iron 4", index: 3 };
  if (val >= 6) return { rank: "Iron", subLevel: 3, label: "Iron 3", index: 2 };
  if (val >= 4) return { rank: "Iron", subLevel: 2, label: "Iron 2", index: 1 };
  return { rank: "Iron", subLevel: 1, label: "Iron 1", index: 0 };
}

export function getAbilityHighestRank(ability: Ability, finalStats: Record<string, number>): { rank: string; subLevel: number; label: string; index: number } {
  const statsToCheck: string[] = [];
  if (ability.primaryStat && ability.primaryStat.trim()) {
    statsToCheck.push(ability.primaryStat.trim());
  }
  if (ability.linkedStats && Array.isArray(ability.linkedStats)) {
    statsToCheck.push(...ability.linkedStats);
  } else if (ability.linkedStat) {
    statsToCheck.push(ability.linkedStat);
  }

  if (statsToCheck.length === 0) {
    return { rank: "Iron", subLevel: 1, label: "Iron 1", index: 0 };
  }

  let highest = { rank: "Iron", subLevel: 1, label: "Iron 1", index: 0 };

  for (const s of statsToCheck) {
    const normKey = s.toLowerCase();
    let fullKey = normKey;
    if (normKey === "pow") fullKey = "power";
    if (normKey === "vit") fullKey = "vitality";
    if (normKey === "spi") fullKey = "spirit";
    if (normKey === "agi") fullKey = "agility";
    if (normKey === "end") fullKey = "endurance";
    if (normKey === "pre") fullKey = "precision";
    if (normKey === "wil") fullKey = "willpower";
    if (normKey === "cha") fullKey = "charisma";

    const statVal = finalStats[fullKey] ?? finalStats[normKey] ?? 0;
    const currentRankObj = getRankForStatValue(statVal);
    if (currentRankObj.index > highest.index) {
      highest = currentRankObj;
    }
  }

  return highest;
}

export function getHighestStatValueForAbility(ability: Ability, finalStats: Record<string, number>): { statKey: string; statVal: number } {
  const statsToCheck: string[] = [];
  if (ability.linkedStats && Array.isArray(ability.linkedStats) && ability.linkedStats.length > 0) {
    statsToCheck.push(...ability.linkedStats);
  } else if (ability.linkedStat) {
    statsToCheck.push(ability.linkedStat);
  }

  if (statsToCheck.length === 0) {
    return { statKey: "power", statVal: 0 };
  }

  let maxStatKey = statsToCheck[0];
  let maxVal = -1;

  for (const s of statsToCheck) {
    const normKey = s.toLowerCase();
    let fullKey = normKey;
    if (normKey === "pow") fullKey = "power";
    if (normKey === "vit") fullKey = "vitality";
    if (normKey === "spi") fullKey = "spirit";
    if (normKey === "agi") fullKey = "agility";
    if (normKey === "end") fullKey = "endurance";
    if (normKey === "pre") fullKey = "precision";
    if (normKey === "wil") fullKey = "willpower";
    if (normKey === "cha") fullKey = "charisma";

    const v = finalStats[fullKey] ?? finalStats[normKey] ?? 0;
    if (v > maxVal) {
      maxVal = v;
      maxStatKey = fullKey;
    }
  }

  return { statKey: maxStatKey, statVal: Math.max(0, maxVal) };
}

export interface EvolutionCalculationResult {
  primaryStatKey: string;
  primaryStatVal: number;
  maxRankSlots: number;
  earnedSlotCount: number;
  isDormant: boolean;
  activeModifiers: EvolutionModifier[];
  earnedDormantModifiers: EvolutionModifier[];
  lockedModifiers: EvolutionModifier[];
  nextLockedModifier: EvolutionModifier | null;
}

export function calculateAbilityEvolutions(
  ability: Ability,
  rank?: string,
  finalStats?: Record<string, number>
): EvolutionCalculationResult {
  const r = (rank || "Iron").trim().toLowerCase();
  
  const { statKey: primaryStatKey, statVal } = finalStats 
    ? getHighestStatValueForAbility(ability, finalStats)
    : { statKey: (ability.primaryStat || "power").toLowerCase(), statVal: 0 };

  const mods = ability.evolutionModifiers || [];

  let maxRankSlots = 0;
  if (r === "bronze") maxRankSlots = 9;
  else if (r === "silver") maxRankSlots = 14;
  else if (r === "gold") maxRankSlots = 19;
  else if (r === "diamond") maxRankSlots = 24;
  else maxRankSlots = 0; // Iron = 0 active modifiers

  const isDormant = r === "iron";
  const earnedStatIndex = getRankForStatValue(statVal).index;
  const earnedSlotCount = isDormant ? 0 : Math.min(maxRankSlots, earnedStatIndex);

  const activeModifiers: EvolutionModifier[] = [];
  const earnedDormantModifiers: EvolutionModifier[] = [];
  const lockedModifiers: EvolutionModifier[] = [];

  mods.forEach((mod, idx) => {
    const meetsStat = statVal >= mod.requiredStat;

    if (isDormant) {
      if (meetsStat && idx < 4) {
        earnedDormantModifiers.push(mod);
      } else {
        lockedModifiers.push(mod);
      }
    } else {
      if (meetsStat && idx < earnedSlotCount) {
        activeModifiers.push(mod);
      } else {
        lockedModifiers.push(mod);
      }
    }
  });

  const nextLockedModifier = lockedModifiers.length > 0 ? lockedModifiers[0] : null;

  return {
    primaryStatKey,
    primaryStatVal: statVal,
    maxRankSlots,
    earnedSlotCount,
    isDormant,
    activeModifiers,
    earnedDormantModifiers,
    lockedModifiers,
    nextLockedModifier,
  };
}
