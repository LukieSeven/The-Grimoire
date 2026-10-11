export interface InitiativeEntry { id: string; name: string; initiative: number; statuses: string[] }
export function upsertCharacterInitiative(entries: InitiativeEntry[], turn: number, characterId: number, name: string, total: number) {
  if (!Number.isFinite(total)) throw new Error("Initiative must be a finite number.");
  const activeId = entries[turn]?.id;
  const existing = entries.find(entry => entry.id === `character:${characterId}` || entry.name.trim().toLowerCase() === name.trim().toLowerCase());
  const entry = existing ? { ...existing, name, initiative: total } : { id: `character:${characterId}`, name, initiative: total, statuses: [] };
  const combatants = [...entries.filter(item => item.id !== existing?.id), entry].sort((a, b) => b.initiative - a.initiative);
  return { combatants, turn: activeId ? Math.max(0, combatants.findIndex(item => item.id === activeId)) : 0 };
}
