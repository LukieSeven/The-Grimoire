/** Presentation only: temporary pools remain separate in character storage and resource actions. */
export function resourceDisplay(current: number, temporary?: number) {
  const pool = Math.max(0, temporary ?? 0);
  return { total: current + pool, temporary: pool, hasTemporary: pool > 0 };
}
