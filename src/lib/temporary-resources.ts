export interface TemporaryResources { tempHp?: number; tempMana?: number; tempDt?: number }
export function spendTemporary<T extends TemporaryResources & { currentHp: number; currentMana: number; currentDt: number }>(previous: T, patch: Partial<T>): Partial<T> {
  const next = { ...patch };
  for (const [resource, temporary] of [["currentHp", "tempHp"], ["currentMana", "tempMana"], ["currentDt", "tempDt"]] as const) {
    if (patch[resource] === undefined || patch[temporary] !== undefined && patch[temporary] !== previous[temporary] || patch[resource]! >= previous[resource]) continue;
    const requested = previous[resource] - patch[resource]!;
    const absorbed = Math.min(previous[temporary] ?? 0, requested);
    Object.assign(next, { [resource]: Math.max(0, patch[resource]! + absorbed), [temporary]: Math.max(0, (previous[temporary] ?? 0) - absorbed) });
  }
  return next;
}
