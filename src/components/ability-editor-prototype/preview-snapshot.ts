import type { Ability, Character, Essence, Skill } from "../../lib/storage";

export interface PreviewSnapshot {
  character: Character | null;
  abilities: Ability[];
  essences: Essence[];
  skills: Skill[];
  error?: string;
}

/** Read a snapshot without the normal storage getters' initialization/migrations. */
export function readPreviewSnapshot(characterId: number): PreviewSnapshot {
  const empty: PreviewSnapshot = { character: null, abilities: [], essences: [], skills: [] };
  const read = <T,>(key: string): T[] => {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error(`The saved ${key.replace("aetherborne_", "")} collection is not an array.`);
    if (value.some(entry => !entry || typeof entry !== "object")) throw new Error(`The saved ${key.replace("aetherborne_", "")} collection has an invalid entry.`);
    return value as T[];
  };
  try {
    return {
      character: read<Character>("aetherborne_characters").find(entry => entry.id === characterId) ?? null,
      abilities: read<Ability>("aetherborne_abilities").filter(entry => entry.characterId === characterId),
      essences: read<Essence>("aetherborne_essences").filter(entry => entry.characterId === characterId),
      skills: read<Skill>("aetherborne_skills").filter(entry => entry.characterId === characterId),
    };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "The saved data could not be read." };
  }
}
