export interface InitiativeEntry { id: string; name: string; initiative: number; statuses: string[] }

/** Manual tie order is the existing array order; never alter an initiative score. */
export function moveInitiativeWithinTie<T extends InitiativeEntry>(entries: T[], id: string, direction: "up" | "down"): T[] {
  const index = entries.findIndex(entry => entry.id === id);
  if (index < 0) return entries;
  const adjacent = index + (direction === "up" ? -1 : 1);
  if (!entries[adjacent] || entries[index].initiative !== entries[adjacent].initiative) return entries;
  const next = [...entries];
  [next[index], next[adjacent]] = [next[adjacent], next[index]];
  return next;
}

export function upsertCharacterInitiative(entries: InitiativeEntry[], turn: number, characterId: number, name: string, total: number) {
  if (!Number.isFinite(total)) throw new Error("Initiative must be a finite number.");
  const activeId = entries[turn]?.id;
  const existing = entries.find(entry => entry.id === `character:${characterId}` || entry.name.trim().toLowerCase() === name.trim().toLowerCase());
  const entry = existing ? { ...existing, name, initiative: total } : { id: `character:${characterId}`, name, initiative: total, statuses: [] };
  const updated = existing ? entries.map(item => item.id === existing.id ? entry : item) : [...entries, entry];
  const combatants = updated.sort((a, b) => b.initiative - a.initiative);
  return { combatants, turn: activeId ? Math.max(0, combatants.findIndex(item => item.id === activeId)) : 0 };
}
