/** One actual critical die, retaining a stat die's existing cap/critical target. */
export interface CriticalDie { sides: number; target?: number }

export function rollCriticalDie(die: CriticalDie, roll: (sides: number) => number) {
  const target = die.target ?? die.sides;
  if (!Number.isSafeInteger(die.sides) || die.sides <= 0 || !Number.isSafeInteger(target) || target <= 0 || target > die.sides) {
    throw new Error("Invalid critical die.");
  }
  const rolled = roll(die.sides);
  const isCrit = rolled === target;
  return {
    result: Math.min(rolled, target),
    breakdown: rolled > target ? `${rolled}(${target})` : String(rolled),
    isCrit,
    criticalDice: isCrit ? [{ ...die }] : [],
  };
}

export interface CriticalProgress { criticalIndex: number; chainCount: number; maxChainCount: number }
/** Exhaust this critical's repeats before advancing to the next original die. */
export function advanceCriticalQueue(progress: CriticalProgress, count: number, repeats: boolean) {
  const depth = progress.chainCount + (repeats ? 1 : 0);
  const criticalIndex = progress.criticalIndex + (repeats ? 0 : 1);
  return {
    criticalIndex,
    chainCount: repeats ? depth : 0,
    maxChainCount: Math.max(progress.maxChainCount, depth),
    complete: criticalIndex >= count,
  };
}

/** Continue the final rolled term, never a flat bonus/base-stat constant. */
export function getChainDie(formula: string): string {
  const rolledTerms = formula.match(/\b\d*d\d+\b|\b(?:power|pow|vitality|vit|spirit|spi|agility|agi|endurance|end|precision|pre|willpower|wil|charisma|cha)r\b/gi);
  const finalTerm = rolledTerms?.at(-1);
  if (!finalTerm) return formula.trim();
  return finalTerm.replace(/^\d+(?=d)/i, "").toLowerCase();
}
