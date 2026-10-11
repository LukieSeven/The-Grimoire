/** Removing a temporary maximum bonus also removes its contribution to the current pool. */
export function removeResourceBonus(current: number, previousMaximum: number, nextMaximum: number): number {
  if (nextMaximum === previousMaximum) return current;
  return Math.max(0, Math.min(nextMaximum, current + nextMaximum - previousMaximum));
}
