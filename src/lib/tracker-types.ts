/** Optional tracker metadata. Legacy records remain valid without these fields. */
export interface EffectTracking {
  targets?: ("self" | "allies" | "enemies")[];
  radius?: number;
  radiusUnit?: string;
  permanent?: boolean;
  requirements?: string;
  situations?: string[];
  unlockedByModifierId?: string;
}

export interface EffectApplication {
  stacks?: number;
  templateId?: string;
  id: string;
  abilityId: number;
  familiarId?: string | number;
  effectId: string;
  targetId: string;
  startedAt: string;
  duration?: string;
}

export interface EffectChange {
  effectId: string;
  radius?: number;
  duration?: string;
  description?: string;
  rollFormula?: string;
}

export interface TrackerEncounter {
  combatants: { id: string; name: string; initiative: number; statuses: string[] }[];
  turn: number;
}
