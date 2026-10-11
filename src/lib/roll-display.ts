/** Presentation only: never split multi-digit values or change roll arithmetic. */
export function formatRollBreakdown(value: string): string {
  return value.replace(/\s*([+\-*/])\s*/g, " $1 ").trim();
}
