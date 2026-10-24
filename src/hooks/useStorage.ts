import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatRollBreakdown } from "../lib/roll-display";
import { resolveDiceExpression } from "../lib/dice-expression";
import { rollCriticalDie, type CriticalDie } from "../lib/critical-continuation";
import { formulaActorRank, requireStatValue, resolveStatExpression } from "../lib/stat-expression";
import { getFamiliarAdjusted } from "../lib/familiar-values";
import { activeEffectModifier } from "../lib/active-effect-modifiers";
import type { RollPurpose } from "../lib/active-effect-modifiers";
import {
  storage,
  Character,
  Familiar,
  Equipment,
  Currency,
  InventoryItem,
  Essence,
  Ability,
  Skill,
  Roll,
  Note,
  getAdjustedStats,
  getModifierForStat,
  SessionRecap,
  CodexNote,
} from "../lib/storage";

// ── Query Keys ────────────────────────────────────────────
export const getGetCharacterQueryKey = (id: number) => ["characters", id];
export const getListCharacterRollsQueryKey = (charId: number) => ["rolls", charId];
export const getListNotesQueryKey = (charId?: number) => ["notes", charId];
export const getListRecentRollsQueryKey = () => ["recent_rolls"];
export const getListEquipmentQueryKey = (charId: number) => ["equipment", charId];
export const getListCurrenciesQueryKey = (charId: number) => ["currencies", charId];
export const getListInventoryQueryKey = (charId: number) => ["inventory", charId];
export const getListEssencesQueryKey = (charId: number) => ["essences", charId];
export const getListAbilitiesQueryKey = (charId: number) => ["abilities", charId];
export const getListSkillsQueryKey = (charId: number) => ["skills", charId];
export const getListRecapsQueryKey = () => ["recaps"];
export const getListCodexQueryKey = () => ["codex"];

// ── Characters ────────────────────────────────────────────

export function useListCharacters() {
  return useQuery<Character[]>({
    queryKey: ["characters"],
    queryFn: () => storage.getCharacters(),
  });
}

export function useGetCharacter(id: number, options?: any) {
  return useQuery<Character | null>({
    queryKey: getGetCharacterQueryKey(id),
    queryFn: () => storage.getCharacter(id),
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Character, "id" | "createdAt" | "updatedAt">) => {
      return Promise.resolve(storage.createCharacter(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data, resourceMode, consumeAbilityId }: { id: number; data: Partial<Omit<Character, "id" | "createdAt" | "updatedAt">>; resourceMode?: "reconcile" | "exact"; consumeAbilityId?: number }) => {
      return Promise.resolve(consumeAbilityId === undefined ? storage.updateCharacter(id, data, resourceMode) : storage.useAbility(id, consumeAbilityId, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(data.id) });
      queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(data.id) });
      queryClient.invalidateQueries({ queryKey: getListAbilitiesQueryKey(data.id) });
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey(data.id) });
    },
  });
}

export function useLongRestCharacter() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: number) => Promise.resolve(storage.longRestCharacter(id)), onSuccess: character => {
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(character.id) });
    queryClient.invalidateQueries({ queryKey: getListAbilitiesQueryKey(character.id) });
    queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(character.id) });
  } });
}
export function useDeleteCharacter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => {
      storage.deleteCharacter(id);
      return Promise.resolve();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(variables.id) });
      queryClient.invalidateQueries({ queryKey: getListRecentRollsQueryKey() });
    },
  });
}

export function useApplyDamage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { amount: number } }) => {
      const char = storage.getCharacter(id);
      if (!char) throw new Error("Character not found");
      
      const eq = storage.getEquipment(id);
      const ab = storage.getAbilities(id);
      const { maxDt } = getAdjustedStats(char, eq, ab);
      
      const amount = Math.max(0, data.amount - activeEffectModifier(char, ab, eq, "damageReduction"));
      const dt = char.currentDt + (char.tempDt ?? 0);
      
      const newDt = char.currentDt - 1;
      let hpLost = 0;
      let dtDropped = true;
      let absorbed = false;
      
      if (amount > dt) {
        hpLost = amount - dt;
        absorbed = false;
      } else {
        absorbed = true;
      }
      
      // Calculate current HP
      const newHp = char.currentHp - hpLost;
      
      const updated = storage.updateCharacter(id, {
        currentDt: newDt,
        currentHp: newHp,
      });

      // Write roll logs for historical reference
      storage.addRoll({
        characterId: id,
        diceType: "dt-log",
        result: -1,
        modifier: 0,
        total: -1,
        label: absorbed ? `DT: -1 (Damage ${amount} Absorbed)` : `DT: -1 (Damage ${amount} Exceeded DT)`,
        isCrit: false,
        critBonus: null,
      });

      if (hpLost > 0) {
        storage.addRoll({
          characterId: id,
          diceType: "hp-log",
          result: -hpLost,
          modifier: 0,
          total: -hpLost,
          label: "Health Lost (Hit)",
          isCrit: false,
          critBonus: null,
        });
      }
      
      return {
        dtDropped,
        hpLost,
        newDt: updated.currentDt,
        newHp: updated.currentHp,
        absorbed,
        maxDt: getAdjustedStats(updated, eq, ab).maxDt,
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(variables.id) });
      queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(variables.id) });
      queryClient.invalidateQueries({ queryKey: getListRecentRollsQueryKey() });
    },
  });
}

// ── Equipment ─────────────────────────────────────────────

export function useListEquipment(charId: number) {
  return useQuery<Equipment[]>({
    queryKey: getListEquipmentQueryKey(charId),
    queryFn: () => storage.getEquipment(charId),
    enabled: !!charId,
  });
}

export function useAddEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Equipment, "id">) => {
      return Promise.resolve(storage.addEquipment(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Equipment, "id" | "characterId">> }) => {
      return Promise.resolve(storage.updateEquipment(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteEquipment(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListEquipmentQueryKey(charId) });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(charId) });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });
}

// ── Currencies ────────────────────────────────────────────

export function useListCurrencies(charId: number) {
  return useQuery<Currency[]>({
    queryKey: getListCurrenciesQueryKey(charId),
    queryFn: () => storage.getCurrencies(charId),
    enabled: !!charId,
  });
}

export function useAddCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Currency, "id">) => {
      return Promise.resolve(storage.addCurrency(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListCurrenciesQueryKey(data.characterId) });
    },
  });
}

export function useUpdateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => {
      return Promise.resolve(storage.updateCurrency(id, amount));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListCurrenciesQueryKey(data.characterId) });
    },
  });
}

export function useDeleteCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteCurrency(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListCurrenciesQueryKey(charId) });
    },
  });
}

// ── General Inventory ─────────────────────────────────────

export function useListInventory(charId: number) {
  return useQuery<InventoryItem[]>({
    queryKey: getListInventoryQueryKey(charId),
    queryFn: () => storage.getInventory(charId),
    enabled: !!charId,
  });
}

export function useAddInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<InventoryItem, "id">) => {
      return Promise.resolve(storage.addInventoryItem(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey(data.characterId) });
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<InventoryItem, "id" | "characterId">> }) => {
      return Promise.resolve(storage.updateInventoryItem(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey(data.characterId) });
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteInventoryItem(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey(charId) });
    },
  });
}

// ── Essences ──────────────────────────────────────────────

export function useListEssences(charId: number) {
  return useQuery<Essence[]>({
    queryKey: getListEssencesQueryKey(charId),
    queryFn: () => storage.getEssences(charId),
    enabled: !!charId,
  });
}

export function useAddEssence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Essence, "id">) => {
      return Promise.resolve(storage.addEssence(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListEssencesQueryKey(data.characterId) });
    },
  });
}

export function useDeleteEssence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteEssence(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListEssencesQueryKey(charId) });
    },
  });
}

// ── Shaped Abilities ──────────────────────────────────────

export function useListAbilities(charId: number) {
  return useQuery<Ability[]>({
    queryKey: getListAbilitiesQueryKey(charId),
    queryFn: () => storage.getAbilities(charId),
    enabled: !!charId,
  });
}

export function useAddAbility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Ability, "id">) => {
      return Promise.resolve(storage.addAbility(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListAbilitiesQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(data.characterId) });
    },
  });
}

export function useUpdateAbility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Ability, "id" | "characterId">> }) => {
      return Promise.resolve(storage.updateAbility(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListAbilitiesQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(data.characterId) });
    },
  });
}

export function useDeleteAbility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteAbility(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListAbilitiesQueryKey(charId) });
      queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey(charId) });
      queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(charId) });
    },
  });
}

// ── Skills ────────────────────────────────────────────────

export function useListSkills(charId: number) {
  return useQuery<Skill[]>({
    queryKey: getListSkillsQueryKey(charId),
    queryFn: () => storage.getSkills(charId),
    enabled: !!charId,
  });
}

export function useAddSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Skill, "id">) => {
      return Promise.resolve(storage.addSkill(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey(data.characterId) });
    },
  });
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Skill, "id" | "characterId">> }) => {
      return Promise.resolve(storage.updateSkill(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey(data.characterId) });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId: number }) => {
      storage.deleteSkill(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListSkillsQueryKey(charId) });
    },
  });
}

// ── Notes ─────────────────────────────────────────────────

export function useListNotes(charId?: number) {
  return useQuery<Note[]>({
    queryKey: getListNotesQueryKey(charId),
    queryFn: () => storage.getNotes(charId),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Note, "id" | "createdAt" | "updatedAt">) => {
      return Promise.resolve(storage.addNote(data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(data.characterId) });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Note, "id" | "characterId" | "createdAt" | "updatedAt">> }) => {
      return Promise.resolve(storage.updateNote(id, data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(data.characterId) });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, charId }: { id: number; charId?: number }) => {
      storage.deleteNote(id);
      return Promise.resolve(charId);
    },
    onSuccess: (charId) => {
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(charId) });
    },
  });
}

// ── Rolls ─────────────────────────────────────────────────

export function useListCharacterRolls(charId: number, options?: any) {
  return useQuery<Roll[]>({
    queryKey: getListCharacterRollsQueryKey(charId),
    queryFn: () => storage.getRolls(charId),
    enabled: !!charId,
    ...options?.query,
  });
}

export function useListRecentRolls() {
  return useQuery<(Roll & { characterName: string })[]>({
    queryKey: getListRecentRollsQueryKey(),
    queryFn: () => storage.getRecentRolls(),
  });
}

export function useCreateRoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: number;
      data: {
        diceType: string;
        modifier?: number;
        label?: string;
        statValue?: number;
        familiarId?: string | number;
        rollPurpose?: RollPurpose;
        rollScope?: string;
        criticalContinuation?: boolean;
        criticalDie?: CriticalDie;
      };
    }) => {
      const charId = data.id;
      const { diceType, label, statValue, familiarId } = data.data;
      let modifier = data.data.modifier ?? 0;
      
      const char = storage.getCharacter(charId);
      if (!char) throw new Error("Character not found");

      let rollingEntity: Character | Familiar = char;
      let finalStats: Record<string, number> = {};

      if (familiarId !== undefined) {
        const fam = char.familiars?.find(f => f.id === familiarId);
        if (!fam) throw new Error("The familiar is no longer available. Record it before rolling its stats.");
        rollingEntity = fam;
        finalStats = getFamiliarAdjusted(fam).stats;
      } else {
        const equipment = storage.getEquipment(charId);
        const abilities = storage.getAbilities(charId);
        const adjusted = getAdjustedStats(char, equipment, abilities);
        rollingEntity = char;
        finalStats = adjusted.stats;
      }

      if (data.data.rollPurpose) {
        const key = data.data.rollPurpose === "attack" ? "bonusAttackRoll" : data.data.rollPurpose === "resistance" ? "bonusResistanceRoll" : "bonusSkillCheck";
        modifier += activeEffectModifier(rollingEntity, storage.getAbilities(charId), familiarId === undefined ? storage.getEquipment(charId) : [], key, data.data.rollScope);
      }
      function dieForValue(v: number): number {
        if (v <= 4) return 4;
        if (v <= 6) return 6;
        if (v <= 8) return 8;
        if (v <= 10) return 10;
        if (v <= 12) return 12;
        return 20;
      }

      function getStatDiceSides(s: number): number[] {
        if (s <= 20) return [dieForValue(s)];
        return [20, ...getStatDiceSides(s - 20)];
      }

      function rollOnce(sides: number): { result: number; isCrit: boolean } {
        const rolled = Math.floor(Math.random() * sides) + 1;
        return { result: rolled, isCrit: rolled === sides };
      }

      const rollStatDice = (statVal: number): { total: number; desc: string; isCrit: boolean; criticalDice: CriticalDie[] } => {
        requireStatValue(statVal, "selected");
        const diceSides = getStatDiceSides(statVal);
        let sum = 0;
        const rollDetails: string[] = [];
        let crit = false;
        const criticalDice: CriticalDie[] = [];
        let remainingStat = statVal;
        for (const sides of diceSides) {
          const rolled = Math.floor(Math.random() * sides) + 1;
          const dieTarget = Math.min(sides, remainingStat);

          if (rolled === dieTarget) {
            crit = true;
            criticalDice.push({ sides, target: dieTarget });
          }

          const cappedResult = Math.min(rolled, dieTarget);
          sum += cappedResult;

          if (rolled > dieTarget) {
            rollDetails.push(`${rolled}(${dieTarget})`);
          } else {
            rollDetails.push(`${rolled}`);
          }

          remainingStat -= sides;
        }
        const desc = rollDetails.join("+");
        return { total: sum, desc, isCrit: crit, criticalDice };
      };

      if (diceType === "hp-log" || diceType === "dt-log" || diceType === "mana-log" || diceType === "action-log") {
        const roll = storage.addRoll({
          characterId: charId,
          ...(familiarId !== undefined ? { familiarId } : {}),
          diceType,
          result: modifier,
          modifier: 0,
          total: modifier,
          label: label || "Vitals Update",
          isCrit: false,
          critBonus: null,
        });
        return Promise.resolve(roll);
      }

      let result = 0;
      let total = 0;
      let isCrit = false;
      let criticalDice: CriticalDie[] = [];
      let diceTypeStr = diceType;

      if (data.data.criticalDie) {
        const continuation = rollCriticalDie(data.data.criticalDie, sides => rollOnce(sides).result);
        result = continuation.result;
        total = result + modifier;
        isCrit = continuation.isCrit;
        criticalDice = continuation.criticalDice;
        diceTypeStr = continuation.breakdown;
      } else if (statValue === undefined) {
        // Advanced Math/Stat-Based formula parser
        let expression = diceType.replace(/\s+/g, "").toLowerCase();
        let breakdown = diceType;

        // 1. If formula contains '=', strip any description on the left-hand side
        if (expression.includes("=")) {
          expression = expression.split("=").pop() || expression;
          breakdown = breakdown.split("=").pop() || breakdown;
        }

        // 2. Replace multiplication symbols '×' and 'x' with standard asterisk '*'
        expression = expression.replace(/×/g, "*").replace(/x/g, "*");

        // A/B. Resolve complete base/rolled stat aliases using this actor's data.
        const statExpression = resolveStatExpression(expression, breakdown, finalStats, statVal => {
          const statMod = data.data.criticalContinuation ? 0 : getModifierForStat(statVal, formulaActorRank(rollingEntity));
          const rolled = rollStatDice(statVal);
          return {
            total: rolled.total + statMod,
            breakdown: statMod !== 0 ? `${rolled.desc}+${statMod}` : rolled.desc,
            isCrit: rolled.isCrit,
            criticalDice: rolled.criticalDice,
          };
        });
        expression = statExpression.expression;
        breakdown = statExpression.breakdown;
        if (statExpression.isCrit) isCrit = true;
        criticalDice.push(...statExpression.criticalDice);

        // C. Resolve every complete dice term, including its count, and evaluate.
        const resolved = resolveDiceExpression(expression, breakdown, rollOnce);
        if (resolved.isCrit) isCrit = true;
        criticalDice.push(...resolved.criticalDice);
        result = resolved.result;
        total = result + modifier;
        diceTypeStr = resolved.breakdown;
      } else {
        const { total: rolledSum, desc, isCrit: crit, criticalDice: statCriticals } = rollStatDice(statValue);
        result = rolledSum;
        total = rolledSum + modifier;
        isCrit = crit;
        criticalDice = statCriticals;
        diceTypeStr = desc;
      }

      const roll = storage.addRoll({
        characterId: charId,
        ...(familiarId !== undefined ? { familiarId } : {}),
        diceType: formatRollBreakdown(diceTypeStr),
        criticalDice,
        result,
        modifier,
        total,
        label: label || null,
        isCrit,
        critBonus: null,
      });

      return Promise.resolve(roll);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListCharacterRollsQueryKey(data.characterId) });
      queryClient.invalidateQueries({ queryKey: getListRecentRollsQueryKey() });
    },
  });
}

// ── Session Recaps ────────────────────────────────────────

export function useListRecaps() {
  return useQuery<SessionRecap[]>({
    queryKey: getListRecapsQueryKey(),
    queryFn: () => storage.getRecaps(),
  });
}

export function useCreateRecap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; content: string }) => {
      return Promise.resolve(storage.createRecap(data.title, data.content));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListRecapsQueryKey() });
    },
  });
}

export function useDeleteRecap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => {
      storage.deleteRecap(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListRecapsQueryKey() });
    },
  });
}

// ── Codex Notes ───────────────────────────────────────────

export function useListCodexNotes() {
  return useQuery<CodexNote[]>({
    queryKey: getListCodexQueryKey(),
    queryFn: () => storage.getCodexNotes(),
  });
}

export function useCreateCodexNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<CodexNote, "id" | "createdAt" | "updatedAt">) => {
      return Promise.resolve(storage.addCodexNote(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListCodexQueryKey() });
    },
  });
}

export function useUpdateCodexNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Omit<CodexNote, "id" | "createdAt" | "updatedAt">> }) => {
      return Promise.resolve(storage.updateCodexNote(id, data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListCodexQueryKey() });
    },
  });
}

export function useDeleteCodexNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => {
      storage.deleteCodexNote(id);
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListCodexQueryKey() });
    },
  });
}

// ── Passwords / Secrets ───────────────────────────────────

export const getUnlockedPasswordsQueryKey = () => ["unlocked_passwords"];

export function useListUnlockedPasswords() {
  return useQuery<string[]>({
    queryKey: getUnlockedPasswordsQueryKey(),
    queryFn: () => storage.getUnlockedPasswords(),
  });
}

export function useUnlockPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => {
      storage.unlockPassword(password);
      return Promise.resolve(password);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getUnlockedPasswordsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListCodexQueryKey() });
    },
  });
}

export function useLockPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => {
      storage.lockPassword(password);
      return Promise.resolve(password);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getUnlockedPasswordsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListCodexQueryKey() });
    },
  });
}
