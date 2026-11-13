import type { CriticalDie } from "./critical-continuation.ts";

interface DieRoll {
  result: number;
  isCrit: boolean;
}

export interface DiceTerm {
  count: number;
  sides: number;
}

export function mapDiceTerms(expression: string, replace: (term: DiceTerm) => string): string {
  return expression.replace(/(\d*)d(\d+)/gi, (notation: string, countText: string, sidesText: string, offset: number) => {
    const before = expression[offset - 1] ?? "";
    const after = expression[offset + notation.length] ?? "";
    if (/[a-z\d_.]/i.test(before) || /[a-z\d_.]/i.test(after)) {
      throw new Error(`Invalid dice notation: ${notation}`);
    }
    const count = countText ? Number(countText) : 1;
    const sides = Number(sidesText);
    if (!Number.isSafeInteger(count) || count <= 0 || !Number.isSafeInteger(sides) || sides <= 0) {
      throw new Error("Dice counts and sides must be positive whole numbers.");
    }
    return replace({ count, sides });
  });
}

function compileArithmetic(expression: string): () => unknown {
  if (!expression.trim() || !/^[0-9+\-*/().\s]+$/.test(expression)) {
    throw new Error("Invalid roll formula. Use dice, character stats, and arithmetic operators.");
  }
  if (/[\d.)]\s*\(/.test(expression)) throw new Error("Use * to multiply terms in a roll formula.");
  try {
    return new Function(`return (${expression})`) as () => unknown;
  } catch {
    throw new Error("Invalid arithmetic in roll formula.");
  }
}

export function validateDiceExpression(expression: string): void {
  compileArithmetic(mapDiceTerms(expression, () => "(1)"));
}

/** Resolve complete dice terms after the caller has substituted character stats. */
export function resolveDiceExpression(
  expression: string,
  breakdown: string,
  rollDie: (sides: number) => DieRoll,
): { result: number; breakdown: string; isCrit: boolean; criticalDice: CriticalDie[] } {
  const terms: DiceTerm[] = [];
  compileArithmetic(mapDiceTerms(expression, term => {
    terms.push(term);
    return "(1)";
  }));

  let isCrit = false;
  const criticalDice: CriticalDie[] = [];
  let termIndex = 0;
  const rolledTerms: string[] = [];
  const resolved = expression.replace(/(\d*)d(\d+)/gi, () => {
    const { count, sides } = terms[termIndex++];
    let total = 0;
    const rolls: number[] = [];
    for (let die = 0; die < count; die++) {
      const rolled = rollDie(sides);
      total += rolled.result;
      rolls.push(rolled.result);
      if (rolled.isCrit) { isCrit = true; criticalDice.push({ sides }); }
    }
    rolledTerms.push(rolls.length === 1 ? String(total) : `(${rolls.join("+")})`);
    return String(total);
  });

  const result = compileArithmetic(resolved)();
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Roll formula must produce a finite number.");
  }

  let breakdownIndex = 0;
  const resolvedBreakdown = breakdown.replace(/(\d*)\s*d\s*(\d+)/gi, () => rolledTerms[breakdownIndex++]);
  return { result: Math.floor(result), breakdown: resolvedBreakdown, isCrit, criticalDice };
}
