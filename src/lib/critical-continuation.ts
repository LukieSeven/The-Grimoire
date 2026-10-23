/** Continue the final rolled term, never a flat bonus/base-stat constant. */
export function getChainDie(formula: string): string {
  const rolledTerms = formula.match(/\b\d*d\d+\b|\b(?:power|pow|vitality|vit|spirit|spi|agility|agi|endurance|end|precision|pre|willpower|wil|charisma|cha)r\b/gi);
  const finalTerm = rolledTerms?.at(-1);
  if (!finalTerm) return formula.trim();
  return finalTerm.replace(/^\d+(?=d)/i, "").toLowerCase();
}
