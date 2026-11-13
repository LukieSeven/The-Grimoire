import { mapDiceTerms, resolveDiceExpression, validateDiceExpression } from "./dice-expression.ts";
import type { CriticalDie } from "./critical-continuation.ts";
import { canonicalStatKey, formulaActorRank, mapStatTokens, requireStatValue, resolveStatExpression } from "./stat-expression.ts";

export interface RollContext {
  stats: Record<string, number>;
  rank: string;
  selectedStat?: string;
}

export interface RollResult {
  result: number;
  breakdown: string;
  isCrit: boolean;
  criticalDice: CriticalDie[];
}

export function getModifierForStat(value: number, rank = "Iron"): number {
  switch ((rank || "Iron").trim().toLowerCase()) {
    case "bronze": return Math.floor(value / 2);
    case "silver": return value;
    case "gold": return value * 2;
    case "diamond": return value * 3;
    default: return Math.floor(value / 3);
  }
}

function statDiceSizes(value: number): number[] {
  const sizes: number[] = [];
  let remaining = value;
  while (remaining > 20) {
    sizes.push(20);
    remaining -= 20;
  }
  sizes.push([4, 6, 8, 10, 12, 20].find(size => remaining <= size) ?? 20);
  return sizes;
}

export function getDiceLabel(value: number): string {
  return Number.isFinite(value) ? statDiceSizes(value).map(size => `d${size}`).join("+") : "—";
}

export function rollStatDice(value: number, random = Math.random): RollResult {
  requireStatValue(value, "selected");
  let result = 0;
  let remaining = value;
  const breakdown: string[] = [];
  const criticalDice: CriticalDie[] = [];
  for (const sides of statDiceSizes(value)) {
    const rolled = Math.floor(random() * sides) + 1;
    const target = Math.min(sides, remaining);
    if (rolled === target) criticalDice.push({ sides, target });
    result += Math.min(rolled, target);
    breakdown.push(rolled > target ? `${rolled}(${target})` : String(rolled));
    remaining -= sides;
  }
  return { result, breakdown: breakdown.join("+"), isCrit: criticalDice.length > 0, criticalDice };
}

export function normalizeRollFormula(formula: string): string {
  return (formula.split("=").at(-1) ?? "").replace(/[×x]/gi, "*").trim();
}

const selectedStatPattern = /\bSTAT([rm])?\b/gi;

export function needsSelectedStat(formula: string): boolean {
  return /\bSTAT[rm]?\b/i.test(normalizeRollFormula(formula).replace(/\s+/g, ""));
}

export function rollAttributeScope(formula: string, selectedStat?: string): string | undefined {
  const rolled = new Set<string>();
  mapStatTokens(normalizeRollFormula(formula).replace(/\s+/g, ""), (key, mode) => {
    if (mode === "roll") rolled.add(key);
    return "";
  });
  return rolled.size === 1 ? [...rolled][0] : rolled.size === 0 ? selectedStat : undefined;
}

export function linkedRollStats(stats: readonly string[]): string[] {
  return [...new Set(stats.flatMap(stat => {
    const key = canonicalStatKey(stat);
    return key ? [key] : [];
  }))];
}

/** Older sheets sometimes recorded a scoped bonus as prose in the roll field. */
export function legacyModifierNote(formula: string | undefined): { amount: string; scope: string } | undefined {
  const match = formula?.match(/^\s*([+-]\s*\d+(?:\.\d+)?)\s+to\s+([a-z][a-z0-9 '\-]*?)\s*$/i);
  return match ? { amount: match[1].replace(/\s+/g, ""), scope: match[2] } : undefined;
}

export function validateRollFormulaSyntax(formula: string): void {
  const expression = normalizeRollFormula(formula).replace(/\s+/g, "");
  let symbolic = false;
  const placeholder = () => { symbolic = true; return "(1)"; };
  const syntax = mapDiceTerms(mapStatTokens(expression.replace(selectedStatPattern, placeholder), placeholder), placeholder);
  if (symbolic) validateDiceExpression(syntax);
  else resolveDiceExpression(syntax, syntax, () => { throw new Error("Expected a deterministic formula."); });
}

/** Resolve the selected attribute and check syntax/actor data without rolling. */
export function prepareRollFormula(formula: string, context: RollContext): string {
  const selected = context.selectedStat ? canonicalStatKey(context.selectedStat) : undefined;
  const expression = normalizeRollFormula(formula).replace(/\s+/g, "").replace(selectedStatPattern, (_, suffix?: string) => {
    if (!selected) throw new Error("Choose a linked attribute before rolling STAT, STATr, or STATm.");
    return selected + (suffix ?? "");
  });
  let random = false;
  const withStats = mapStatTokens(expression, (key, mode) => {
    const score = requireStatValue(context.stats[key], key);
    const rank = mode === "score" ? undefined : formulaActorRank({ rank: context.rank });
    if (mode === "roll") { random = true; return "(1)"; }
    const value = mode === "modifier" ? getModifierForStat(score, rank) : score;
    return `(${value})`;
  });
  const placeholder = mapDiceTerms(withStats, () => { random = true; return "(1)"; });
  validateDiceExpression(placeholder);
  if (!random) resolveDiceExpression(placeholder, placeholder, () => { throw new Error("Expected a deterministic formula."); });
  return expression;
}

export function rollFormula(formula: string, context: RollContext, random = Math.random): RollResult {
  const expression = prepareRollFormula(formula, context);
  const modifierFor = (score: number) => getModifierForStat(score, context.rank);
  const statTerms = resolveStatExpression(expression, expression, context.stats, score => {
    const rolled = rollStatDice(score, random);
    const modifier = modifierFor(score);
    const text = modifier ? `${rolled.breakdown}${modifier < 0 ? "" : "+"}${modifier}` : rolled.breakdown;
    return {
      total: rolled.result + modifier,
      breakdown: modifier || rolled.breakdown.includes("+") ? `(${text})` : text,
      isCrit: rolled.isCrit,
      criticalDice: rolled.criticalDice,
    };
  }, modifierFor);
  const dice = resolveDiceExpression(statTerms.expression, statTerms.breakdown, sides => {
    const result = Math.floor(random() * sides) + 1;
    return { result, isCrit: result === sides };
  });
  return { ...dice, isCrit: statTerms.isCrit || dice.isCrit, criticalDice: [...statTerms.criticalDice, ...dice.criticalDice] };
}

export function weaponRollFormula(dice: string | undefined, modifier: number | string | undefined): string {
  if (!dice?.trim()) throw new Error("Enter the weapon's dice before rolling its strike.");
  const base = `(${normalizeRollFormula(dice)})`;
  const add = modifier === undefined || !String(modifier).trim() ? "POWr" : normalizeRollFormula(String(modifier));
  return add === "0" ? base : `${base}+(${add})`;
}

/** Keep the established Agility check for the default; custom formulas are complete rolls. */
export function customInitiativeFormula(saved: string | undefined): string | undefined {
  const formula = saved?.trim();
  return formula && canonicalStatKey(normalizeRollFormula(formula)) !== "agility" ? formula : undefined;
}
