import type { CriticalDie } from "./critical-continuation.ts";

interface StatRoll {
  total: number;
  breakdown: string;
  isCrit: boolean;
  criticalDice?: CriticalDie[];
}

const STAT_ALIASES = [
  ["power", "pow"], ["vitality", "vit"], ["spirit", "spi"], ["agility", "agi"],
  ["endurance", "end"], ["precision", "pre"], ["willpower", "wil"], ["charisma", "cha"],
] as const;
const STAT_KEYS = new Map<string, string>(STAT_ALIASES.flatMap(([key, prefix]) => [[key, key] as const, [prefix, key] as const]));
const STAT_PATTERN = new RegExp(`\\b(?:${[...STAT_KEYS.keys()].sort((a, b) => b.length - a.length).join("|")})(?:r)?\\b`, "gi");

export function requireStatValue(value: number | undefined, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`The ${name} stat is missing or invalid. Review the character or familiar before rolling.`);
  }
  return value;
}

export function formulaActorRank(actor: { rank?: string; className?: string }): string {
  const rank = actor.className ?? actor.rank;
  if (typeof rank !== "string" || !rank.trim()) {
    throw new Error("The rolling character or familiar has no valid rank.");
  }
  return rank;
}

/** Match complete aliases so Power cannot replace the end of Willpower. */
export function resolveStatExpression(
  expression: string,
  breakdown: string,
  stats: Record<string, number>,
  rollStat: (value: number, key: string) => StatRoll,
): { expression: string; breakdown: string; isCrit: boolean; criticalDice: CriticalDie[] } {
  const rolledStats = new Map<string, StatRoll>();
  let isCrit = false;
  const criticalDice: CriticalDie[] = [];
  const readToken = (token: string): { value: number; rolled?: StatRoll } => {
    const alias = token.toLowerCase();
    const key = STAT_KEYS.get(alias) ?? STAT_KEYS.get(alias.slice(0, -1))!;
    const value = requireStatValue(stats[key], key);
    if (STAT_KEYS.has(alias)) return { value };
    let rolled = rolledStats.get(key);
    if (!rolled) {
      rolled = rollStat(value, key);
      rolledStats.set(key, rolled);
      criticalDice.push(...(rolled.criticalDice ?? []));
      if (rolled.isCrit) isCrit = true;
    }
    return { value: rolled.total, rolled };
  };
  const resolved = expression.replace(STAT_PATTERN, token => String(readToken(token).value));
  const resolvedBreakdown = breakdown.replace(STAT_PATTERN, token => {
    const { value, rolled } = readToken(token);
    return rolled ? rolled.breakdown : String(value);
  });
  return { expression: resolved, breakdown: resolvedBreakdown, isCrit, criticalDice };
}
