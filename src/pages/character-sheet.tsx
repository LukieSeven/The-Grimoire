import { CompactResources } from "@/components/compact-resources";
import { resourceDisplay } from "@/lib/resource-display";
import { HistoryList } from "@/components/history-list";
import { DieButton } from "@/components/die-button";
import { DiceToolLayout } from "@/components/dice-tool-layout";
import { customRollTitle } from "@/lib/custom-roll-title";
import { getChainDie } from "@/lib/critical-continuation";
import { FavoritesGrid } from "@/components/favorites-grid";
import { WorkspaceProvider, WorkspaceCanvas, DockableTool, revealWorkspaceTool } from "@/components/dockable-workspace";
import React, { useState, useEffect, useRef } from "react";
import { upsertCharacterInitiative } from "@/lib/initiative-entry";
import { CurrencyAdjustments } from "@/components/currency-adjustments";
import { formatRollBreakdown } from "@/lib/roll-display";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Shield, ArrowLeft, Loader2, Trash2, Heart, Dice5,
  RotateCcw, Swords, Sparkles, Plus, Edit2, Upload, Download,
  Coins, Package, Hammer, Layers, Flame, BookText, UserCheck, X,
  Palette, Clock, ExternalLink, ChevronDown, ChevronRight, Lock, Zap
} from "lucide-react";
import { format } from "date-fns";

// Storage Hooks & Helpers
import {
  useGetCharacter, useUpdateCharacter, useDeleteCharacter, useApplyDamage, useLongRestCharacter,
  useCreateRoll, useListCharacterRolls,
  useListEquipment, useUpdateEquipment, useDeleteEquipment,
  useListCurrencies, useUpdateCurrency, useDeleteCurrency,
  useListInventory, useUpdateInventoryItem, useDeleteInventoryItem,
  useListEssences, useAddEssence, useDeleteEssence,
  useListAbilities, useUpdateAbility, useDeleteAbility,
  useListSkills, useUpdateSkill,
  useListNotes, useCreateNote, useUpdateNote, useDeleteNote,
  getGetCharacterQueryKey, getListCharacterRollsQueryKey, getListNotesQueryKey
} from "@/hooks/useStorage";
import { 
  getAdjustedStats, getDiceLabel, exportCharacterJSON, importCharacterJSON, getModifierForStat,
  Ability, Character, Equipment, Skill, FavoriteSlot, Familiar, FamiliarAbility, evaluateFormula,
  getAbilityHighestRank, calculateAbilityEvolutions, hasStatModifiers, parseFormulaOrNum,
  getAbilityActiveModifierBadges, ActiveModifierBadge, isAbilityTriggerActive
} from "@/lib/storage";

import { RollGuideDialog } from "@/components/dialogs/roll-guide-dialog";
import { EditFamiliarDialog } from "@/components/dialogs/edit-familiar-dialog";

// Dialog Modals
import { EditCharacterDialog } from "@/components/dialogs/edit-character-dialog";
import { EditAbilitiesDialog } from "@/components/dialogs/edit-abilities-dialog";
import { EditSkillsDialog } from "@/components/dialogs/edit-skills-dialog";
import { EditInventoryDialog } from "@/components/dialogs/edit-inventory-dialog";
import { CustomizeToolDialog } from "@/components/dialogs/customize-tool-dialog";
import { TrackerPanel } from "@/components/tracker-panel";
import { AbilityResultList } from "@/components/ability-result-list";
import { AbilityOptionsFields } from "@/components/dialogs/ability-options";
import { mergeOptions, flattenInputs } from "@/lib/ability-input";
import { restedFamiliar, getFamiliarMaxValues, getFamiliarAdjusted, familiarAsCharacter, familiarAbilityAsAbility } from "@/lib/familiar-values";
import { spendTemporary } from "@/lib/temporary-resources";
import { activeEffectModifier } from "@/lib/active-effect-modifiers";
import { expireEffectApplications } from "@/lib/effect-stacking";
import { resolveTrackerEffects, isEffectApplied } from "@/lib/tracker";
import { favoriteRollChoices } from "@/lib/favorite-rolls";
import { removeResourceBonus } from "@/lib/resource-bonus-transition";
import { shouldEndAbilityOnUse } from "@/lib/ability-use-action";
import { AbilityComponentList } from "@/components/ability-component-list";
import { EditItemAbilityDialog } from "@/components/dialogs/edit-item-ability-dialog";

const STATS = [
  { key: "power",     label: "POW" },
  { key: "vitality",  label: "VIT" },
  { key: "agility",   label: "AGI" },
  { key: "endurance", label: "END" },
  { key: "spirit",    label: "SPI" },
  { key: "precision", label: "PRE" },
  { key: "willpower", label: "WIL" },
  { key: "charisma",  label: "CHA" },
];

const CRIT_TIERS = [
  { name: "Common",    color: "#e8e8e8" },
  { name: "Uncommon",  color: "#1eff00" },
  { name: "Rare",      color: "#0070ff" },
  { name: "Epic",      color: "#a335ee" },
  { name: "Legendary", color: "#ffd700" },
  { name: "Artifact",  color: "#ff8000" },
  { name: "Heirloom",  color: "#ff3030" },
];

// Helper to parse Markdown description cards
function parseMarkdown(text: string): string {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/^### (.*?)$/gm, '<h4 class="font-serif text-sm font-bold text-primary mt-2 mb-0.5">$1</h4>');
  html = html.replace(/^- (.*?)$/gm, '<li class="ml-4 list-disc text-muted-foreground">$1</li>');
  html = html.split("\n").join("<br />");
  return html;
}

function ResourceBar({ current, max, color }: { current: number; max: number; color: string }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const isOverMax = current > max;
  return (
    <div className={`resource-meter w-full bg-accent/50 h-2 rounded-none overflow-hidden relative ${isOverMax ? "ring-1 ring-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]" : ""}`}>
      <div
        className={`h-full rounded-none transition-all duration-300 ${isOverMax ? "animate-pulse" : ""}`}
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

// Favorites Migration/Getter Helper
const getFavorites = (char: any, eq: any[], ab: any[]): (FavoriteSlot | null)[] => {
  if (char && char.favorites && Array.isArray(char.favorites)) {
    if (char.favorites.length === 20) {
      return char.favorites;
    }
    if (char.favorites.length === 10) {
      return [...char.favorites, ...Array(10).fill(null)];
    }
  }
  const slots: (FavoriteSlot | null)[] = Array(20).fill(null);
  let idx = 0;
  eq.filter(e => e.equipped && e.assignedToQuickRolls).forEach(e => {
    if (idx < 20) slots[idx++] = { type: "weapon", targetId: e.id, label: e.name };
  });
  ab.filter(a => a.assignedToQuickRolls).forEach(a => {
    if (idx < 20) slots[idx++] = { type: "ability", targetId: a.id, label: a.name };
  });
  return slots;
};

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  statuses: string[];
}

function compressImage(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxW) {
            height *= maxW / width;
            width = maxW;
          }
        } else {
          if (height > maxH) {
            width *= maxH / height;
            height = maxH;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

const RANKS_ORDER = ["Iron", "Bronze", "Silver", "Gold", "Diamond"];

function getRankStyle(_rank?: string): string {
  return "bg-primary/10 border-primary/40 text-primary shadow-sm";
}

function canRankUp(currentRank?: string): boolean {
  const cur = (currentRank || "Iron").trim();
  const idx = RANKS_ORDER.findIndex(r => r.toLowerCase() === cur.toLowerCase());
  return idx !== -1 && idx < RANKS_ORDER.length - 1;
}

function getNextRank(currentRank?: string): string | null {
  const cur = (currentRank || "Iron").trim();
  const idx = RANKS_ORDER.findIndex(r => r.toLowerCase() === cur.toLowerCase());
  if (idx !== -1 && idx < RANKS_ORDER.length - 1) {
    return RANKS_ORDER[idx + 1];
  }
  return null;
}

function getPassiveCapacity(rank?: string): number {
  const r = (rank || "Iron").trim().toLowerCase();
  if (r === "bronze") return 1;
  if (r === "silver") return 2;
  if (r === "gold") return 3;
  if (r === "diamond") return 4;
  return 0;
}

export default function CharacterSheet() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: character, isLoading } = useGetCharacter(id);
  const { data: rolls, isLoading: loadingRolls } = useListCharacterRolls(id);
  const { data: equipment = [] } = useListEquipment(id);
  const { data: currencies = [] } = useListCurrencies(id);
  const { data: inventory = [] } = useListInventory(id);
  const { data: essences = [] } = useListEssences(id);
  const { data: abilities = [] } = useListAbilities(id);
  const { data: skills = [] } = useListSkills(id);
  const { data: notes = [] } = useListNotes(id);

  // Mutations
  const deleteAbility = useDeleteAbility();
  const updateChar = useUpdateCharacter();
  const longRestMut = useLongRestCharacter();
  const deleteChar = useDeleteCharacter();
  const createRoll = useCreateRoll();
  const applyDamageMut = useApplyDamage();

  // Equipment mutators for toggling equipped/quick status
  const updateEq = useUpdateEquipment();
  const deleteEq = useDeleteEquipment();

  // Inventory mutators
  const updateInvItem = useUpdateInventoryItem();
  const deleteInvItem = useDeleteInventoryItem();

  // Notes mutators
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const updateNote = useUpdateNote();

  // Essences mutators
  const addEssence = useAddEssence();
  const deleteEssence = useDeleteEssence();

  // Skills mutator
  const updateSkillMut = useUpdateSkill();

  // Abilities mutator
  const updateAbilityMut = useUpdateAbility();

  // Collapsible skill category state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedEssences, setExpandedEssences] = useState<Record<number, boolean>>({});
  const [wideRows, setWideRows] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWideRows(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const hasAllFourEssences = [1, 2, 3, 4].every(s => essences.some(e => e.slot === s));

  const handlePromoteRank = () => {
    const nextRank = getNextRank(character?.rank);
    if (nextRank && character) {
      updateChar.mutate({ id, data: { rank: nextRank } }, {
        onSuccess: () => toast.success(`Hero Rank promoted to ${nextRank}! Stat & skill modifiers updated!`)
      });
    }
  };

  // ── Tab State ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"stats" | "skills" | "inventory" | "abilities" | "notes" | "familiar" | "settings">("stats");

  // ── Resource state ────────────────────────────────────────
  const [hp, setHp] = useState<number | null>(null);
  const [mana, setMana] = useState<number | null>(null);
  const [currentDt, setCurrentDt] = useState<number | null>(null);

  // ── Combat Tracker State ──────────────────────────────────
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentTurnIdx, setCurrentTurnIdx] = useState<number>(0);
  const [loadedEncounterId, setLoadedEncounterId] = useState<number | null>(null);
  const [recentCombatants, setRecentCombatants] = useState<Omit<Combatant, "id">[]>([]);

  useEffect(() => {
    if (character) {
      if (hp === null) setHp(character.currentHp);
      if (mana === null) setMana(character.currentMana);
      if (currentDt === null) setCurrentDt(character.currentDt);
    }
  }, [character]);

  // Sync state changes from parent queries
  useEffect(() => {
    if (character) {
      setHp(character.currentHp);
      setMana(character.currentMana);
      setCurrentDt(character.currentDt);
    }
  }, [character?.currentHp, character?.currentMana, character?.currentDt]);

  // ── Combat Tracker LocalStorage Persistence ───────────────
  useEffect(() => {
    if (id && character) {
      try {
        const savedCombatants = localStorage.getItem(`aetherborne_combatants_${id}`);
        setCombatants(savedCombatants ? JSON.parse(savedCombatants) : character.trackerEncounter?.combatants ?? []);
        const savedTurnIdx = localStorage.getItem(`aetherborne_combatants_turn_${id}`);
        setCurrentTurnIdx(savedTurnIdx ? Number(savedTurnIdx) : character.trackerEncounter?.turn ?? 0);
        const savedRecents = localStorage.getItem(`aetherborne_combatants_recents_${id}`);
        if (savedRecents) setRecentCombatants(JSON.parse(savedRecents));
      } catch (e) {
        console.error("Failed to load combat tracker state", e);
      }
      setLoadedEncounterId(id);
    }
  }, [id, character?.id]);

  useEffect(() => {
    if (id && loadedEncounterId === id) {
      localStorage.setItem(`aetherborne_combatants_${id}`, JSON.stringify(combatants));
      localStorage.setItem(`aetherborne_combatants_turn_${id}`, String(currentTurnIdx));
      localStorage.setItem(`aetherborne_combatants_recents_${id}`, JSON.stringify(recentCombatants));
    }
  }, [id, loadedEncounterId, combatants, currentTurnIdx, recentCombatants]);

  // Retroactive Auto-Conversion of Existing Items to Notes
  const hasSyncedItemsRef = useRef(false);
  useEffect(() => {
    if (character && notes && equipment && inventory && currencies && !hasSyncedItemsRef.current) {
      hasSyncedItemsRef.current = true;

      const existingNoteTitles = new Set(
        notes
          .filter(n => n.category === "item")
          .map(n => n.title.toLowerCase().trim())
      );

      const syncMissingItem = (name: string, desc: string, itemType: string, extraFields?: any) => {
        const titleKey = name.toLowerCase().trim();
        if (titleKey && !existingNoteTitles.has(titleKey)) {
          let noteContent = `Description: ${desc || "None"}`;
          if (itemType === "equipment" && extraFields) {
            noteContent += `\nDice: ${extraFields.diceType || "None"}`;
            noteContent += `\nModifier: ${extraFields.modifier || "None"}`;
            noteContent += `\nDT Bonus: ${extraFields.dtBonus || 0}`;
            noteContent += `\nStat Modifiers: ${JSON.stringify(extraFields.statModifiers || {})}`;
          }

          createNote.mutate({
            characterId: id,
            title: name,
            category: "item",
            content: noteContent,
            tags: ["auto-imported"],
            images: []
          });
        }
      };

      equipment.forEach(eq => {
        syncMissingItem(eq.name, eq.description || "", "equipment", {
          diceType: eq.diceType,
          modifier: eq.modifier,
          dtBonus: eq.dtBonus,
          statModifiers: eq.statModifiers
        });
      });

      inventory.forEach(item => {
        syncMissingItem(item.name, item.description || "", "item");
      });

      currencies.forEach(cur => {
        syncMissingItem(cur.name, `Currency amount: ${cur.amount}`, "currency");
      });
    }
  }, [character, notes, equipment, inventory, currencies, id]);

  // ── Familiar Release States ──────────────────────────────
  const [releasingFamId, setReleasingFamId] = useState<number | string | null>(null);
  const [isReleaseConfirmOpen, setIsReleaseConfirmOpen] = useState(false);
  const [isReleaseDoubleConfirmOpen, setIsReleaseDoubleConfirmOpen] = useState(false);

  // ── Long Rest State & Action ───────────────────────────────
  const [isLongRestConfirmOpen, setIsLongRestConfirmOpen] = useState(false);

  const handleLongRest = () => {
    if (!character || longRestMut.isPending) return;
    longRestMut.mutate(id, { onSuccess: rested => {
      setHp(rested.currentHp); setMana(rested.currentMana); setCurrentDt(rested.currentDt);
      toast.success("Long Rest completed. Abilities reset and resources fully restored.");
      setIsLongRestConfirmOpen(false);
    }, onError: error => toast.error(error.message) });
  };
  // ── Dedicated HUD Inputs State ─────────────────────────────
  const [hpAdd, setHpAdd] = useState("");
  const [hpRemove, setHpRemove] = useState("");
  const [hpBuff, setHpBuff] = useState("");

  const [dtAdd, setDtAdd] = useState("");
  const [dtRemove, setDtRemove] = useState("");
  const [dtBuff, setDtBuff] = useState("");
  const [damageAmount, setDamageAmount] = useState("");

  const [manaAdd, setManaAdd] = useState("");
  const [manaRemove, setManaRemove] = useState("");
  const [manaBuff, setManaBuff] = useState("");

  // ── Familiar Inputs State (Creation) ───────────────────────
  const [famName, setFamName] = useState("");
  const [famClassName, setFamClassName] = useState("Iron"); // Used for Rank select dropdown!
  const [famRace, setFamRace] = useState("");
  const [famSpeed, setFamSpeed] = useState(25);
  const [famPower, setFamPower] = useState(10);
  const [famVitality, setFamVitality] = useState(10);
  const [famSpirit, setFamSpirit] = useState(10);
  const [famAgility, setFamAgility] = useState(10);
  const [famEndurance, setFamEndurance] = useState(10);
  const [famPrecision, setFamPrecision] = useState(10);
  const [famWillpower, setFamWillpower] = useState(10);
  const [famCharisma, setFamCharisma] = useState(10);
  const [famHpFormula, setFamHpFormula] = useState("Vitality * 8");
  const [famManaFormula, setFamManaFormula] = useState("Spirit * 5");
  const [famDtFormula, setFamDtFormula] = useState("Endurance * 1");
  const [famResistances, setFamResistances] = useState("");
  const [famImmunities, setFamImmunities] = useState("");
  const [isAddingFamiliar, setIsAddingFamiliar] = useState(false);

  // ── Multiple Familiars HUD & Expansion State ───────────────
  const [expandedFamiliars, setExpandedFamiliars] = useState<Record<string | number, boolean>>({});
  const [expandedAbilities, setExpandedAbilities] = useState<Record<number, boolean>>({});
  const [famDtFlashes, setFamDtFlashes] = useState<Record<string | number, "hit" | "restore" | null>>({});
  const [famDamageResults, setFamDamageResults] = useState<Record<string | number, { hpLost: number; absorbed: boolean } | null>>({});
  const [famInputs, setFamInputs] = useState<Record<string | number, {
    hpAdd?: string;
    hpRemove?: string;
    hpBuff?: string;
    dtAdd?: string;
    dtRemove?: string;
    dtBuff?: string;
    manaAdd?: string;
    manaRemove?: string;
    manaBuff?: string;
    damageAmount?: string;
  }>>({});

  const updateFamInput = (famId: string | number, field: string, value: string) => {
    setFamInputs(prev => ({
      ...prev,
      [famId]: {
        ...(prev[famId] || {}),
        [field]: value
      }
    }));
  };



  // ── Notes Import Ref ──
  const notesFileInputRef = React.useRef<HTMLInputElement>(null);

  // ── Drag and Drop States ──
  const [draggedAbilityId, setDraggedAbilityId] = useState<number | null>(null);
  const [draggedFamAbIdx, setDraggedFamAbIdx] = useState<number | null>(null);

  // ── Notes Filter & Search ──────────────────────────────────
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteCategoryFilter, setNoteCategoryFilter] = useState("all");

  // ── Favorites Hotbar State ─────────────────────────────────
  const [assigningSlotIndex, setAssigningSlotIndex] = useState<number | null>(null);

  const [dtFlash, setDtFlash] = useState<"hit" | "restore" | null>(null);
  const [famDtFlash, setFamDtFlash] = useState<"hit" | "restore" | null>(null);
  const [damageResult, setDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);
  const [famDamageResult, setFamDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);

  // ── New Features State ──
  const [favoriteRollPicker, setFavoriteRollPicker] = useState<{ abilityId: number; inputId: string } | null>(null);
  const [familiarRollPicker, setFamiliarRollPicker] = useState<{ familiarId: string | number; abilityId: number; inputId: string } | null>(null);
  const [discardItem, setDiscardItem] = useState<any | null>(null);
  const [discardCount, setDiscardCount] = useState<number>(1);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [noteImages, setNoteImages] = useState<string[]>([]);
  const [expandedSubAbilities, setExpandedSubAbilities] = useState<Record<string, boolean>>({});
  const [isEditAbilitiesOpen, setIsEditAbilitiesOpen] = useState(false);
  const [editingAbilityId, setEditingAbilityId] = useState<number | null>(null);

  // ── Inventory Dialog Trigger State ────────────────────────
  const [isInvOpen, setIsInvOpen] = useState(false);
  const [invMode, setInvMode] = useState<"add" | "edit">("add");
  const [invType, setInvType] = useState<"currency" | "equipment" | "item">("item");
  const [invInitialData, setInvInitialData] = useState<any>(null);

  // ── Item Ability Dialog State ──
  const [isItemAbOpen, setIsItemAbOpen] = useState(false);
  const [itemAbEquipmentId, setItemAbEquipmentId] = useState<number | null>(null);
  const [itemAbInventoryItemId, setItemAbInventoryItemId] = useState<number | null>(null);
  const [itemAbInitialData, setItemAbInitialData] = useState<any>(null);

  // ── Essence input State ───────────────────────────────────
  const [essenceSlotInput, setEssenceSlotInput] = useState<number | null>(null);
  const [essenceName, setEssenceName] = useState("");
  const [essenceDesc, setEssenceDesc] = useState("");

  // ── Campaign Notes input State ────────────────────────────
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteCat, setNoteCat] = useState<string>("general");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // ── Roll state ────────────────────────────────────────────
  const [rollingDice, setRollingDice] = useState<string | null>(null);
  const [customFormula, setCustomFormula] = useState("");

  const [critChain, setCritChain] = useState<{
    chainCount: number;
    chainDie: string;
    runningDiceTotal: number;
    modifier: number;
    label: string;
    lastRolledValue: number;
    onRollTotal?: (total: number) => void;
    statValue?: number;
    familiarId?: string | number;
    rolls: { label: string; breakdown: string; total: number }[];
  } | null>(null);

  const [lastRoll, setLastRoll] = useState<{
    rawRoll: number;
    modifier: number;
    total: number;
    hadCrit: boolean;
    maxChainCount: number;
    diceType: string;
    label: string;
    rolls?: { label: string; breakdown: string; total: number }[];
  } | null>(null);

  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);
  const autoScrollRolls = character?.uiPreferences?.autoScrollRolls ?? true;
  const previousRollEvent = useRef({ rollingDice, lastRoll, critChain });
  useEffect(() => {
    if (!pendingScrollTarget) return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(pendingScrollTarget);
      if (element) {
        element.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
        element.classList.add("ring-2", "ring-primary");
        setTimeout(() => element.classList.remove("ring-2", "ring-primary"), 2000);
      }
      setPendingScrollTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingScrollTarget, activeTab]);

  useEffect(() => {
    const previous = previousRollEvent.current;
    previousRollEvent.current = { rollingDice, lastRoll, critChain };
    if (previous.rollingDice === rollingDice && previous.lastRoll === lastRoll && previous.critChain === critChain) return;
    if (!autoScrollRolls || (!rollingDice && !lastRoll && !critChain)) return;
    const visibleReadout = () => Array.from(document.querySelectorAll<HTMLElement>("[data-dice-readout]")).find(node => node.getClientRects().length > 0);
    if (!visibleReadout()) revealWorkspaceTool("stats");
    const frame = requestAnimationFrame(() => visibleReadout()?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center",
    }));
    return () => cancelAnimationFrame(frame);
  }, [rollingDice, lastRoll, critChain, autoScrollRolls]);

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!character) return <div className="p-8 text-center text-muted-foreground">Character not found</div>;

  // ── Recalculate adjusted stats from equipment & active abilities ─────────────
  const adjustedStats = getAdjustedStats(character, equipment, abilities);
  const { 
    stats: finalStats, 
    modifiers: autoModifiers, 
    diceLabels, 
    speed,
    baseSpeed,
    maxHp, 
    maxMana, 
    maxDt, 
    baseMaxHp,
    baseMaxMana,
    baseMaxDt,
    hpBuffBonus,
    manaBuffBonus,
    dtBuffBonus,
  } = adjustedStats;

  // ── Derived max values for familiar ───────────────────────

  const getSlotDetails = (slot: FavoriteSlot) => {
    let name = slot.label;
    let costStr = "";
    let statStr = "";

    if (slot.type === "attribute") {
      name = STATS.find(s => s.key === slot.targetId)?.label || String(slot.targetId).toUpperCase();
      statStr = `${finalStats[slot.targetId as string] || 0} (${autoModifiers[slot.targetId as string] >= 0 ? "+" : ""}${autoModifiers[slot.targetId as string]})`;
    } else if (slot.type === "weapon" || slot.type === "item") {
      const eq = equipment.find(e => e.id === Number(slot.targetId));
      const invItem = inventory.find(i => i.id === Number(slot.targetId));
      if (eq) {
        name = eq.name;
        costStr = eq.equipped ? "Equipped" : "Gear";
        statStr = eq.diceType || "Item";
      } else if (invItem) {
        name = invItem.name;
        const linkedAb = abilities.find(a => a.inventoryItemId === invItem.id);
        if (linkedAb) {
          statStr = linkedAb.rollFormula || linkedAb.name;
          costStr = linkedAb.cost > 0 ? `${linkedAb.cost} MP (x${invItem.quantity})` : `x${invItem.quantity}`;
        } else {
          costStr = `x${invItem.quantity}`;
          statStr = "Item";
        }
      }
    } else if (slot.type === "ability") {
      const ability = abilities.find(a => a.id === Number(slot.targetId));
      if (ability) {
        const eq = ability.equipmentId ? equipment.find(e => e.id === ability.equipmentId) : null;
        const invItem = ability.inventoryItemId ? inventory.find(i => i.id === ability.inventoryItemId) : null;
        const parent = eq || invItem;
        name = parent ? `${parent.name}: ${ability.name}` : ability.name;
        costStr = `${ability.cost} MP`;
        if (ability.linkedStats && ability.linkedStats.length > 0) {
          statStr = ability.linkedStats.map(s => s.toUpperCase().substring(0, 3)).join(", ");
        } else if (ability.rollFormula) {
          statStr = ability.rollFormula;
        } else {
          statStr = "SPI";
        }
      }
    } else if (slot.type === "ability-result") {
      const ability = abilities.find(entry => entry.id === Number(slot.targetId));
      const node = ability?.definition ? flattenInputs(ability.definition).find(input => input.results.some(result => result.id === slot.subId)) : undefined;
      const result = node?.results.find(result => result.id === slot.subId);
      if (result) { name = node!.name; costStr = node!.manaCost === undefined ? "" : `${node!.manaCost} MP`; statStr = result.formula; }
    } else if (slot.type === "sub-ability") {
      const ability = abilities.find(a => a.id === Number(slot.targetId));
      if (ability && ability.subAbilities) {
        const subIndex = ability.subAbilities.findIndex(s => s.id === slot.subId);
        const sub = subIndex !== -1 ? ability.subAbilities[subIndex] : null;
        if (sub) {
          name = sub.name?.trim() ? sub.name.trim() : `${ability.name} (${subIndex + 2})`;
          costStr = sub.cost ? `${sub.cost} MP` : "0 MP";
          statStr = sub.rollFormula || "Sub-Effect";
        }
      }
    } else if (slot.type === "skill") {
      const skill = skills.find(s => s.id === Number(slot.targetId));
      if (skill) {
        name = skill.name;
        costStr = `Val: ${skill.value}`;
        statStr = `+${Math.floor((Number(skill.value) || 0) / 3) + (Number(skill.training) || 0)}`;
      }
    } else if (slot.type === "familiar-attribute") {
      const fam = character.familiars?.find(f => f.id === slot.familiarId);
      if (fam) {
        const val = (fam as any)[slot.targetId] as number;
        name = `${fam.name}: ${String(slot.targetId).toUpperCase().substring(0, 3)}`;
        statStr = `${val} (+${Math.floor(val/3)})`;
      }
    } else if (slot.type === "familiar-ability") {
      const fam = character.familiars?.find(f => f.id === slot.familiarId);
      if (fam) {
        const ab = fam.abilities.find(a => a.id === Number(slot.targetId));
        if (ab) {
          name = `${fam.name}: ${ab.name}`;
          costStr = `${ab.cost} MP`;
          if (ab.linkedStats && ab.linkedStats.length > 0) {
            statStr = ab.linkedStats.map(s => s.toUpperCase().substring(0, 3)).join(", ");
          } else if (ab.rollFormula) {
            statStr = ab.rollFormula;
          } else {
            statStr = "";
          }
        }
      }
    }

    return { name, costStr, statStr };
  };

  const cleanLogReadoutLabel = (label?: string | null) => {
    if (!label) return "";
    let str = label.trim();
    if (/long rest/i.test(str)) return "Long Rest";
    str = str.replace(/\s+(Restore|Heal|Shield|Cost|Update)$/i, "");
    str = str.replace(/\s*\((DT|HP|Mana|MP)\)/gi, "");
    return str.trim();
  };

  // famMax is calculated dynamically per-familiar

  // Storage consumes temporary pools before base resources. Always display the
  // returned base values, including when spending changes only a temporary pool.
  const syncResourceState = (updated: Pick<Character, "currentHp" | "currentMana" | "currentDt">) => {
    setHp(updated.currentHp);
    setMana(updated.currentMana);
    setCurrentDt(updated.currentDt);
  };

  // ── HP Adjustments ────────────────────────────────────────
  const handleHpAdd = (override?: string) => {
    const amount = parseInt(override ?? hpAdd) || 1;
    const cur = hp ?? character.currentHp;
    const limit = maxHp;
    const next = Math.min(limit, cur + amount);
    setHpAdd("");
    updateChar.mutate({ id, data: { currentHp: next } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: next - cur, label: "Healed HP" } });
  };

  const handleHpRemove = (override?: string) => {
    const amount = parseInt(override ?? hpRemove) || 1;
    const cur = hp ?? character.currentHp;
    const next = Math.max(0, cur - amount);
    const diff = next - cur !== 0 ? next - cur : -amount;
    setHpRemove("");
    updateChar.mutate({ id, data: { currentHp: cur - amount } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: diff, label: "Direct DMG" } });
  };

  const handleHpBuff = (override?: string) => {
    const amount = Number(override ?? hpBuff);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setHpBuff("");
    updateChar.mutate({ id, data: { tempHp: (character.tempHp ?? 0) + amount } });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: amount, label: "Added temporary HP" } });
  };

  const handleFullRestoreHp = () => {
    const cur = hp ?? character.currentHp;
    const limit = maxHp;
    updateChar.mutate({ id, data: { currentHp: limit } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: limit - cur, label: "Full Restore HP" } });
  };

  // ── DT Adjustments ────────────────────────────────────────
  const handleApplyDamage = () => {
    const amount = parseInt(damageAmount) || 1;
    applyDamageMut.mutate({ id, data: { amount } }, {
      onSuccess: (data) => {
        setCurrentDt(data.newDt);
        setHp(data.newHp);
        setDamageResult({ hpLost: data.hpLost, absorbed: data.absorbed });
        setDtFlash("hit");
        setDamageAmount("");
        setTimeout(() => setDtFlash(null), 600);
        if (data.absorbed) {
          toast.info("Damage fully absorbed by Damage Threshold!");
        } else {
          toast.error(`Took ${data.hpLost} damage after DT absorption!`);
        }
      }
    });
  };

  const handleDtRemoveDirect = (override?: string) => {
    const amount = parseInt(override ?? dtRemove) || 1;
    const cur = currentDt ?? character.currentDt;
    setDtRemove("");
    updateChar.mutate({ id, data: { currentDt: cur - amount } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: -amount, label: "Manual DT Reduction" } });
    toast.success(`Deducted ${amount} from DT directly.`);
  };

  const handleDtAdd = (override?: string) => {
    const amount = parseInt(override ?? dtAdd) || 1;
    const cur = currentDt ?? character.currentDt;
    const limit = maxDt;
    const next = Math.min(limit, cur + amount);
    setDtAdd("");
    updateChar.mutate({ id, data: { currentDt: next } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: next - cur, label: "Added DT" } });
  };

  const handleDtBuff = (override?: string) => {
    const amount = Number(override ?? dtBuff);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setDtBuff("");
    updateChar.mutate({ id, data: { tempDt: (character.tempDt ?? 0) + amount } });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: amount, label: "Added temporary DT" } });
  };

  const handleRestoreDt = () => {
    const cur = currentDt ?? character.currentDt;
    const limit = maxDt;
    setDtFlash("restore");
    setDamageResult(null);
    setTimeout(() => setDtFlash(null), 600);
    updateChar.mutate({ id, data: { currentDt: limit } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: limit - cur, label: "Restore DT" } });
  };

  // ── Mana Adjustments ──────────────────────────────────────
  const handleManaAdd = (override?: string) => {
    const amount = parseInt(override ?? manaAdd) || 1;
    const cur = mana ?? character.currentMana;
    const limit = maxMana;
    const next = Math.min(limit, cur + amount);
    setManaAdd("");
    updateChar.mutate({ id, data: { currentMana: next } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: next - cur, label: "Restored Mana" } });
  };

  const handleManaRemove = (override?: string) => {
    const amount = parseInt(override ?? manaRemove) || 1;
    const cur = mana ?? character.currentMana;
    const next = Math.max(0, cur - amount);
    const diff = next - cur !== 0 ? next - cur : -amount;
    setManaRemove("");
    updateChar.mutate({ id, data: { currentMana: cur - amount } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: diff, label: "Spent Mana" } });
  };

  const handleManaBuff = (override?: string) => {
    const amount = Number(override ?? manaBuff);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setManaBuff("");
    updateChar.mutate({ id, data: { tempMana: (character.tempMana ?? 0) + amount } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: amount, label: "Added temporary Mana" } });
  };

  const handleFullRestoreMana = () => {
    const cur = mana ?? character.currentMana;
    const limit = maxMana;
    updateChar.mutate({ id, data: { currentMana: limit } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: limit - cur, label: "Full Restore Mana" } });
  };

  // ── Multiple Familiars Adjustments Mutator Helper ───────────
  const updateFamiliarData = (famId: string | number, updatedFam: Familiar | null) => {
    const list = character.familiars ? [...character.familiars] : [];
    if (updatedFam === null) {
      // Release familiar
      const filtered = list.filter(f => f.id !== famId);
      updateChar.mutate({ id, data: { familiars: filtered } });
      toast.success("Familiar released.");
    } else {
      // Save familiar modifications
      const idx = list.findIndex(f => f.id === famId);
      if (idx !== -1) {
        list[idx] = updatedFam;
        updateChar.mutate({ id, data: { familiars: list } });
      }
    }
  };

  const handleFamStatTrain = (fam: Familiar, statKey: string, direction: "up" | "down" = "up") => {
    const baseVal = (fam as any)[statKey] as number;
    const trainingKey = `${statKey}Training`;
    const curTraining = ((fam as any)[trainingKey] as number) || 0;

    if (direction === "up") {
      const nextTraining = curTraining + 1;
      if (nextTraining >= baseVal) {
        const nextBaseVal = baseVal + 1;
        updateFamiliarData(fam.id, {
          ...fam,
          [statKey]: nextBaseVal,
          [trainingKey]: 0,
        });
        toast.success(`${fam.name}'s ${statKey.toUpperCase()} increased to ${nextBaseVal}!`);
      } else {
        updateFamiliarData(fam.id, {
          ...fam,
          [trainingKey]: nextTraining,
        });
      }
    } else {
      if (curTraining > 0) {
        updateFamiliarData(fam.id, {
          ...fam,
          [trainingKey]: curTraining - 1,
        });
      } else if (baseVal > 0) {
        const nextBaseVal = baseVal - 1;
        const nextTraining = Math.max(0, nextBaseVal - 1);
        updateFamiliarData(fam.id, {
          ...fam,
          [statKey]: nextBaseVal,
          [trainingKey]: nextTraining,
        });
        toast.info(`${fam.name}'s ${statKey.toUpperCase()} decreased to ${nextBaseVal} (${nextTraining}/${nextBaseVal} Training).`);
      }
    }
  };

  // ── Familiar HP Adjustments ───────────────────────────────
  const handleFamHpAdd = (fam: Familiar, value?: string) => {
    const inputVal = value ?? famInputs[fam.id]?.hpAdd ?? "";
    const amount = parseInt(inputVal) || 1;
    const fMax = getFamiliarMaxValues(fam);
    const next = Math.min(fMax.maxHp, fam.currentHp + amount);
    updateFamiliarData(fam.id, { ...fam, currentHp: next });
    updateFamInput(fam.id, "hpAdd", "");
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: next - fam.currentHp, label: `Fam: ${fam.name} Heal`, familiarId: fam.id } });
  };

  const handleFamHpRemove = (fam: Familiar, value?: string) => {
    const inputVal = value ?? famInputs[fam.id]?.hpRemove ?? "";
    const amount = parseInt(inputVal) || 1;
    const spent = spendTemporary(fam, { currentHp: fam.currentHp - amount });
    const change = (spent.currentHp ?? fam.currentHp) - fam.currentHp + (spent.tempHp ?? fam.tempHp ?? 0) - (fam.tempHp ?? 0);
    updateFamiliarData(fam.id, { ...fam, currentHp: fam.currentHp - amount });
    updateFamInput(fam.id, "hpRemove", "");
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: change, label: `Fam: ${fam.name} DMG`, familiarId: fam.id } });
  };

  const handleFamHpBuff = (fam: Familiar, value?: string) => {
    const amount = Number(value ?? famInputs[fam.id]?.hpBuff);
    if (!Number.isFinite(amount) || amount <= 0) return;
    updateFamiliarData(fam.id, { ...fam, tempHp: (fam.tempHp ?? 0) + amount });
    updateFamInput(fam.id, "hpBuff", "");
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: amount, label: "Added temporary HP", familiarId: fam.id } });
  };

  const handleFamFullRestoreHp = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    const next = fMax.maxHp;
    updateFamiliarData(fam.id, { ...fam, currentHp: next });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: next - fam.currentHp, label: `Fam: ${fam.name} Full Restore`, familiarId: fam.id } });
  };

  // ── Familiar DT Adjustments ───────────────────────────────
  const handleFamApplyDamage = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.damageAmount || "";
    const amount = Math.max(0, (parseInt(inputVal) || 1) - activeEffectModifier(fam, [], [], "damageReduction"));

    let dtVal = fam.currentDt + (fam.tempDt ?? 0);
    let hpVal = fam.currentHp;
    let hpLost = 0;
    let absorbed = true;

    const newDtVal = fam.currentDt - 1;
    if (amount > dtVal) {
      hpLost = amount - dtVal;
      hpVal -= hpLost;
      dtVal = newDtVal;
      absorbed = false;
    } else {
      dtVal = newDtVal;
      absorbed = true;
    }

    setFamDamageResults(prev => ({
      ...prev,
      [fam.id]: { hpLost, absorbed }
    }));

    setFamDtFlashes(prev => ({
      ...prev,
      [fam.id]: "hit" as const
    }));

    updateFamiliarData(fam.id, { ...fam, currentHp: hpVal, currentDt: dtVal });
    updateFamInput(fam.id, "damageAmount", "");

    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: dtVal - fam.currentDt, label: `Fam: ${fam.name} Took DMG`, familiarId: fam.id } });
    if (hpLost > 0) {
      createRoll.mutate({ id, data: { diceType: "hp-log", modifier: -hpLost, label: `Fam: ${fam.name} Took HP DMG`, familiarId: fam.id } });
    }
  };

  const handleFamDtRemoveDirect = (fam: Familiar, value?: string) => {
    const inputVal = value ?? famInputs[fam.id]?.dtRemove ?? "";
    const amount = parseInt(inputVal) || 1;
    const spent = spendTemporary(fam, { currentDt: fam.currentDt - amount });
    const change = (spent.currentDt ?? fam.currentDt) - fam.currentDt + (spent.tempDt ?? fam.tempDt ?? 0) - (fam.tempDt ?? 0);
    updateFamiliarData(fam.id, { ...fam, currentDt: fam.currentDt - amount });
    updateFamInput(fam.id, "dtRemove", "");
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: change, label: `Fam: ${fam.name} Manual DT Deduct`, familiarId: fam.id } });
    toast.success(`Deducted ${amount} from ${fam.name}'s DT directly.`);
  };

  const handleFamDtAdd = (fam: Familiar, value?: string) => {
    const inputVal = value ?? famInputs[fam.id]?.dtAdd ?? "";
    const amount = parseInt(inputVal) || 1;
    const fMax = getFamiliarMaxValues(fam);
    const next = Math.min(fMax.maxDt, fam.currentDt + amount);
    updateFamiliarData(fam.id, { ...fam, currentDt: next });
    updateFamInput(fam.id, "dtAdd", "");
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: next - fam.currentDt, label: `Fam: ${fam.name} DT Add`, familiarId: fam.id } });
  };

  const handleFamDtRemove = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.dtRemove || "";
    const amount = parseInt(inputVal) || 1;

    let dtVal = fam.currentDt;
    let hpVal = fam.currentHp;
    let hpLost = 0;
    let absorbed = true;

    const newDtVal = Math.max(0, dtVal - 1);
    if (amount > dtVal) {
      hpLost = amount - dtVal;
      hpVal = Math.max(0, hpVal - hpLost);
      dtVal = newDtVal;
      absorbed = false;
    } else {
      dtVal = newDtVal;
      absorbed = true;
    }

    setFamDamageResults(prev => ({
      ...prev,
      [fam.id]: { hpLost, absorbed }
    }));

    setFamDtFlashes(prev => ({
      ...prev,
      [fam.id]: "hit" as const
    }));

    updateFamiliarData(fam.id, { ...fam, currentHp: hpVal, currentDt: dtVal });
    updateFamInput(fam.id, "dtRemove", "");

    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: dtVal - fam.currentDt, label: `Fam: ${fam.name} Took DMG`, familiarId: fam.id } });
    if (hpLost > 0) {
      createRoll.mutate({ id, data: { diceType: "hp-log", modifier: -hpLost, label: `Fam: ${fam.name} Took HP DMG`, familiarId: fam.id } });
    }

    setTimeout(() => {
      setFamDtFlashes(prev => ({
        ...prev,
        [fam.id]: null
      }));
    }, 600);
  };

  const handleFamDtBuff = (fam: Familiar, value?: string) => {
    const amount = Number(value ?? famInputs[fam.id]?.dtBuff);
    if (!Number.isFinite(amount) || amount <= 0) return;
    updateFamiliarData(fam.id, { ...fam, tempDt: (fam.tempDt ?? 0) + amount });
    updateFamInput(fam.id, "dtBuff", "");
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: amount, label: "Added temporary DT", familiarId: fam.id } });
  };

  const handleFamRestoreDt = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    setFamDtFlashes(prev => ({
      ...prev,
      [fam.id]: "restore" as const
    }));
    setFamDamageResults(prev => {
      const copy = { ...prev };
      delete copy[fam.id];
      return copy;
    });
    const next = fMax.maxDt;
    updateFamiliarData(fam.id, { ...fam, currentDt: next });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: next - fam.currentDt, label: `Fam: ${fam.name} DT Restore`, familiarId: fam.id } });
    setTimeout(() => {
      setFamDtFlashes(prev => ({
        ...prev,
        [fam.id]: null
      }));
    }, 600);
  };

  // ── Familiar Mana Adjustments ─────────────────────────────
  const handleFamManaAdd = (fam: Familiar, value?: string) => {
    const inputVal = value ?? famInputs[fam.id]?.manaAdd ?? "";
    const amount = parseInt(inputVal) || 1;
    const fMax = getFamiliarMaxValues(fam);
    const next = Math.min(fMax.maxMana, fam.currentMana + amount);
    updateFamiliarData(fam.id, { ...fam, currentMana: next });
    updateFamInput(fam.id, "manaAdd", "");
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: next - fam.currentMana, label: `Fam: ${fam.name} Mana Add`, familiarId: fam.id } });
  };

  const handleFamManaRemove = (fam: Familiar, value?: string) => {
    const inputVal = value ?? famInputs[fam.id]?.manaRemove ?? "";
    const amount = parseInt(inputVal) || 1;
    const spent = spendTemporary(fam, { currentMana: fam.currentMana - amount });
    const change = (spent.currentMana ?? fam.currentMana) - fam.currentMana + (spent.tempMana ?? fam.tempMana ?? 0) - (fam.tempMana ?? 0);
    updateFamiliarData(fam.id, { ...fam, currentMana: fam.currentMana - amount });
    updateFamInput(fam.id, "manaRemove", "");
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: change, label: `Fam: ${fam.name} Spent Mana`, familiarId: fam.id } });
  };

  const handleFamManaBuff = (fam: Familiar, value?: string) => {
    const amount = Number(value ?? famInputs[fam.id]?.manaBuff);
    if (!Number.isFinite(amount) || amount <= 0) return;
    updateFamiliarData(fam.id, { ...fam, tempMana: (fam.tempMana ?? 0) + amount });
    updateFamInput(fam.id, "manaBuff", "");
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: amount, label: "Added temporary Mana", familiarId: fam.id } });
  };

  const handleFamFullRestoreMana = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    const next = fMax.maxMana;
    updateFamiliarData(fam.id, { ...fam, currentMana: next });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: next - fam.currentMana, label: `Fam: ${fam.name} Mana Restore`, familiarId: fam.id } });
  };

  // ── Delete character (Styled Trigger) ─────────────────────
  const handleDelete = () => {
    setIsDeleteOpen(true);
  };

  // ── Dice rolling handlers ─────────────────────────────────
  const handleRoll = (diceType: string, label?: string, statValue?: number, autoModifier?: number, familiarId?: string | number, rollPurpose?: "attack" | "check" | "resistance", rollScope?: string, onResolved?: () => void, onRollTotal?: (total: number) => void) => {
    if (familiarId !== undefined && !character.familiars?.some(familiar => familiar.id === familiarId)) { toast.error("Record this familiar in Familiars before rolling its imported abilities."); return; }
    const rollKey = label || diceType;
    const modifier = autoModifier ?? 0;
    setRollingDice(rollKey);
    setLastRoll(null);
    setCritChain(null);

    createRoll.mutate(
      { id, data: { diceType, modifier, rollPurpose, rollScope, label: label || diceType, ...(statValue !== undefined ? { statValue } : {}), ...(familiarId !== undefined ? { familiarId } : {}) } },
      {
        onSuccess: (data) => {
          onResolved?.();
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const chainDie = getChainDie(diceType);
            const lbl = label || diceType;

            const rawDiceStr = String(data.diceType || "");
            const breakdownStr = (/^d\d+$/i.test(rawDiceStr) || !rawDiceStr) ? String(rolled) : rawDiceStr;

            if (wasCrit) {
              setCritChain({
                chainCount: 0,
                onRollTotal,
                chainDie,
                runningDiceTotal: rolled,
                modifier: data.modifier ?? data.total - rolled,
                label: lbl,
                lastRolledValue: rolled,
                statValue,
                familiarId,
                rolls: [{ label: "Roll 1", breakdown: breakdownStr, total: rolled }]
              });
            } else {
              onRollTotal?.(data.total);
              setLastRoll({
                rawRoll: rolled,
                modifier: data.modifier ?? data.total - rolled,
                total: data.total,
                hadCrit: false,
                maxChainCount: -1,
                diceType: data.diceType,
                label: lbl,
                rolls: [{ label: "Roll 1", breakdown: breakdownStr, total: rolled }]
              });
            }
            setRollingDice(null);
          }, 600);
        },
        onError: error => {
          setRollingDice(null);
          toast.error(error.message || "Unable to resolve this roll formula.");
        },
      }
    );
  };

  const handleCustomFormulaRoll = () => {
    if (!customFormula.trim()) return;
    handleRoll(customFormula.trim(), customRollTitle(customFormula), undefined, 0);
  };


  const handleChainRoll = () => {
    if (!critChain) return;
    const { chainDie, runningDiceTotal, modifier, label, chainCount, statValue, familiarId, rolls: prevRolls, onRollTotal } = critChain;
    setRollingDice("chain");

    createRoll.mutate(
      { id, data: { diceType: chainDie, modifier: 0, criticalContinuation: true, label, ...(statValue !== undefined ? { statValue } : {}), ...(familiarId !== undefined ? { familiarId } : {}) } },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const newTotal = runningDiceTotal + rolled;

            const rawDiceStr = String(data.diceType || "");
            const breakdownStr = (/^d\d+$/i.test(rawDiceStr) || !rawDiceStr) ? String(rolled) : rawDiceStr;
            const rollTotal = rolled;
            const newRolls = [...prevRolls, { label: `Roll ${chainCount + 2}`, breakdown: breakdownStr, total: rollTotal }];

            if (wasCrit) {
              setCritChain({ chainCount: chainCount + 1, chainDie, runningDiceTotal: newTotal, modifier, label, lastRolledValue: rolled, statValue, familiarId, rolls: newRolls, onRollTotal });
            } else {
              onRollTotal?.(newTotal + modifier);
              setLastRoll({ rawRoll: newTotal, modifier, total: newTotal + modifier, hadCrit: true, maxChainCount: chainCount, diceType: chainDie, label, rolls: newRolls });
              setCritChain(null);
            }
            setRollingDice(null);
          }, 600);
        },
        onError: () => setRollingDice(null),
      }
    );
  };

  const handleAbilityResultRoll = (formula: string, label: string, familiar?: Familiar, onResolved?: () => void) => {
    handleRoll(formula, label, undefined, familiar ? 0 : undefined, familiar?.id, undefined, undefined, onResolved);
  };
  const handleAbilityManaPayment = (amount: number, label: string, familiar?: Familiar) => {
    if (familiar) {
      const current = character.familiars?.find(entry => entry.id === familiar.id);
      if (!current) { toast.error("Record this familiar in Familiars before paying its mana cost."); return; }
      if (amount > current.currentMana + (current.tempMana ?? 0)) { toast.error("Not enough familiar mana; adjust its resource manually if your table permits it."); return; }
      updateFamiliarData(current.id, { ...current, currentMana: current.currentMana - amount });
      createRoll.mutate({ id, data: { diceType: "mana-log", modifier: -amount, label: `${current.name}: ${label}`, familiarId: current.id } });
      return;
    }
    const current = mana ?? character.currentMana;
    if (amount > current + (character.tempMana ?? 0)) { toast.error("Not enough mana; adjust the resource manually if your table permits it."); return; }
    updateChar.mutate({ id, data: { currentMana: current - amount } }, { onSuccess: syncResourceState });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: -amount, label } });
  };

  const handleStatRoll = (statKey: string, statLabel: string) => {
    const statValue = finalStats[statKey];
    const modifier = autoModifiers[statKey];
    handleRoll(diceLabels[statKey], `${statLabel} Roll`, statValue, modifier, undefined, "check", statKey);
  };

  const handleSkillRoll = (skill: Skill) => {
    const val = Number(skill.value) || 0;
    const train = Number(skill.training) || 0;
    const modifier = getModifierForStat(val, character?.rank) + train;
    handleRoll(getDiceLabel(val), `${skill.name} Skill Roll`, val, modifier, undefined, "check", skill.name);
  };

  const handleWeaponRoll = (item: Equipment) => {
    const dice = item.diceType || "d8";
    let formula = dice;
    let flatMod = 0;

    if (item.modifier !== undefined && String(item.modifier).trim() !== "") {
      const modStr = String(item.modifier).trim();
      const hasLetters = /[a-zA-Z]/.test(modStr);
      if (hasLetters) {
        formula = `${dice} + ${modStr}`;
      } else {
        flatMod = parseInt(modStr, 10) || 0;
      }
    } else {
      formula = `${dice} + powr`;
    }

    handleRoll(formula, `${item.name} Strike`, undefined, flatMod, undefined, "attack");
  };

  const changeAbilityApplications = (effectApplications: NonNullable<typeof character.effectApplications>) => {
    updateChar.mutate({ id, data: { effectApplications } }, { onSuccess: updated => {
      setHp(updated.currentHp); setMana(updated.currentMana); setCurrentDt(updated.currentDt);
    }, onError: error => toast.error(error.message) });
  };
  const executeFavoriteResult = (entry: ReturnType<typeof resolveTrackerEffects>[number], toggle = true) => {
    if (entry.applicability !== "available" && !isEffectApplied(entry, "self", character.effectApplications ?? [])) { toast.info("This ability's resource requirements are not currently met."); return; }
    if (!entry.input || rollingDice || updateChar.isPending) return;
    const node = entry.input;
    if (node.durationType === "When Triggered" && node.trigger.conditions.some(condition => condition.kind === "resource") && !isEffectApplied(entry, "self", character.effectApplications ?? [])) { toast.info("This ability is activated only by its resource trigger while its parent is active."); return; }
    const parentRecorded = (character.effectApplications ?? []).some(application => application.abilityId === entry.ability.id && application.effectId === node.id && application.targetId === "self");
    if (shouldEndAbilityOnUse(parentRecorded, node.durationType, toggle)) {
      changeAbilityApplications((character.effectApplications ?? []).filter(application => !(application.abilityId === entry.ability.id && application.effectId === node.id && application.targetId === "self")));
      return;
    }
    const actor = entry.familiar ? character.familiars?.find(familiar => familiar.id === entry.familiar!.id) : undefined;
    if (entry.familiar && !actor) { toast.error("Record this familiar before using its ability."); return; }
    const cost = node.manaCost ?? 0;
    if (cost > (actor ? actor.currentMana + (actor.tempMana ?? 0) : (mana ?? character.currentMana) + (character.tempMana ?? 0))) { toast.error("Not enough mana to use this ability."); return; }
    const effectApplications = [...(character.effectApplications ?? [])];
    if (!["Instant", "When Triggered"].includes(node.durationType) && !entry.permanent && !effectApplications.some(application => application.abilityId === entry.ability.id && application.effectId === node.id && application.targetId === "self")) {
      effectApplications.push({ id: crypto.randomUUID(), abilityId: entry.ability.id, effectId: node.id, targetId: "self", startedAt: new Date().toISOString(), duration: entry.effect.duration });
    }
    const data = actor ? { familiars: character.familiars!.map(familiar => familiar.id === actor.id ? { ...familiar, currentMana: familiar.currentMana - cost } : familiar), effectApplications } : { currentMana: (mana ?? character.currentMana) - cost, effectApplications };
    updateChar.mutate({ id, data, consumeAbilityId: actor ? undefined : entry.ability.id }, { onSuccess: updated => {
      setHp(updated.currentHp); setMana(updated.currentMana); setCurrentDt(updated.currentDt);
      if (cost > 0) createRoll.mutate({ id, data: { diceType: "mana-log", modifier: -cost, label: node.name, ...(actor ? { familiarId: actor.id } : {}) } });
      if (entry.effect.rollFormula) handleAbilityResultRoll(entry.effect.rollFormula, node.name, actor, entry.effect.duration?.startsWith("Until Used") ? () => changeAbilityApplications((updated.effectApplications ?? []).filter(application => !(application.abilityId === entry.ability.id && application.targetId === "self" && (application.effectId === entry.effect.id || application.effectId === node.id)))) : undefined);
      else { createRoll.mutate({ id, data: { diceType: "action-log", modifier: 0, label: `Activated ${node.name}`, ...(actor ? { familiarId: actor.id } : {}) } }); toast.success(`Used ${node.name}`); }
    }, onError: error => toast.error(error.message) });
  };
  const handleAbilityRoll = (ability: Ability, chosenStat?: string, inputId?: string) => {
    if (ability.definition) {
      const entries = resolveTrackerEffects([ability], character.rank, finalStats, { hp: hp ?? character.currentHp, maxHp, mana: mana ?? character.currentMana, maxMana, dt: currentDt ?? character.currentDt, maxDt }, character.triggerConfirmations ?? {}, character.familiars);
      const selectedId = inputId ?? ability.definition.id;
      const parent = entries.find(entry => entry.input?.id === selectedId && !entry.result);
      if (parent && !parent.permanent && (character.effectApplications ?? []).some(application => application.abilityId === ability.id && application.effectId === selectedId && application.targetId === "self") && !["Instant", "When Triggered"].includes(parent.input!.durationType)) { executeFavoriteResult(parent); return; }
      const choices = favoriteRollChoices(entries, ability.id, selectedId);
      if (choices.length === 1) executeFavoriteResult(choices[0]);
      else if (choices.length > 1) setFavoriteRollPicker({ abilityId: ability.id, inputId: selectedId });
      else { const parent = entries.find(entry => entry.input?.id === selectedId && !entry.result); if (parent) executeFavoriteResult(parent); }
      return;
    }
    // Ending a legacy buff does not consume charges or mana, or roll again.
    if (ability.active && hasStatModifiers(ability)) { toggleAbilityActive(ability); return; }
    let effectiveCost = ability.cost;
    let effectiveRollFormula = ability.rollFormula;
    const curMana = mana ?? character.currentMana;

    for (const trig of ability.triggers ?? []) {
      if (trig && trig.triggerAction === "update_attached" && isAbilityTriggerActive(trig, {
        hp: hp ?? character.currentHp, maxHp,
        mana: curMana, maxMana,
        dt: currentDt ?? character.currentDt, maxDt,
      })) {
        if (trig.updatedCost !== undefined) effectiveCost = trig.updatedCost;
        if (trig.updatedRollFormula) effectiveRollFormula = trig.updatedRollFormula;
      }
    }
    const availableMana = curMana + (character.tempMana ?? 0);
    if (availableMana < effectiveCost) {
      toast.error(`Not enough Mana! Requires ${effectiveCost} MP (Have ${availableMana} MP)`);
      return;
    }

    // Validate every prerequisite before consuming charges, inventory or mana.
    // 1. Rechargeable charges check
    if (ability.usageType === "rechargeable") {
      const curCharges = ability.currentCharges ?? ability.maxCharges ?? 0;
      if (curCharges <= 0) {
        toast.error(`Out of charges! "${ability.name}" cannot be activated.`);
        // Dispatch error event to trigger CSS shake animation on the card
        const event = new CustomEvent(`ability-error-${ability.id}`);
        window.dispatchEvent(event);
        return;
      }
      // Decrement charges
      updateAbilityMut.mutate({
        id: ability.id,
        data: { currentCharges: curCharges - 1 }
      });
    }

    // 2. One time use check
    if (ability.usageType === "one-time") {
      if (ability.inventoryItemId) {
        const parentItem = inventory.find(i => i.id === ability.inventoryItemId);
        if (!parentItem || parentItem.quantity <= 0) {
          toast.error(`No item quantity left to consume for "${ability.name}"!`);
          const event = new CustomEvent(`ability-error-${ability.id}`);
          window.dispatchEvent(event);
          return;
        }

        const nextQty = parentItem.quantity - 1;
        if (nextQty <= 0) {
          // Delete item and ability
          deleteInvItem.mutate({ id: parentItem.id, charId: id }, {
            onSuccess: () => {
              deleteAbility.mutate({ id: ability.id, charId: id });
              toast.success(`Used last of "${parentItem.name}". Item and ability consumed!`);
            }
          });
        } else {
          updateInvItem.mutate({ id: parentItem.id, data: { quantity: nextQty } });
          toast.success(`Used 1 of "${parentItem.name}". Remaining quantity: ${nextQty}`);
        }
      }
    }

    const nextMana = curMana - effectiveCost;

    const updates: Record<string, number> = { currentMana: nextMana };

    if (effectiveCost > 0) {
      createRoll.mutate({ id, data: { diceType: "mana-log", modifier: -effectiveCost, label: `${ability.name} Cost` } });
    }

    // Toggle active state for stat-modifying or pool-modifying abilities
    const parentAb = abilities.find(a => a.id === ability.id);
    if (parentAb && hasStatModifiers(ability)) {
      toggleAbilityActive(parentAb, effectiveCost);
      if (parentAb.active) return; // Deactivating does not roll formula
    } else if (Object.keys(updates).length > 0) {
      updateChar.mutate({ id, data: updates }, { onSuccess: syncResourceState });
    }

    if (effectiveRollFormula) {
      let rollFormulaToUse = effectiveRollFormula;
      let statMod = 0;

      if (chosenStat) {
        // Substitute shorthand "STAT" and "STATr" with the selected stat (e.g., "pow" / "powr")
        const prefix = chosenStat.substring(0, 3).toLowerCase();
        rollFormulaToUse = rollFormulaToUse
          .replace(/STATr/g, `${prefix}r`)
          .replace(/statr/g, `${prefix}r`)
          .replace(/STAT/g, prefix)
          .replace(/stat/g, prefix);

        statMod = autoModifiers[chosenStat] || 0;
      }

      // Sum all equipped equipment flat modifiers (e.g. +6 Mace)
      const vars: Record<string, number> = {
        power: finalStats.power,
        vitality: finalStats.vitality,
        spirit: finalStats.spirit,
        agility: finalStats.agility,
        endurance: finalStats.endurance,
        precision: finalStats.precision,
        willpower: finalStats.willpower,
        charisma: finalStats.charisma,
        pow: finalStats.power,
        vit: finalStats.vitality,
        spi: finalStats.spirit,
        agi: finalStats.agility,
        end: finalStats.endurance,
        pre: finalStats.precision,
        wil: finalStats.willpower,
        cha: finalStats.charisma,
        powr: autoModifiers.power,
        vitr: autoModifiers.vitality,
        spir: autoModifiers.spirit,
        agir: autoModifiers.agility,
        endr: autoModifiers.endurance,
        prer: autoModifiers.precision,
        wilr: autoModifiers.willpower,
        char: autoModifiers.charisma,
      };

      const eqMod = equipment
        .filter(e => e.equipped)
        .reduce((sum, item) => {
          let modVal = 0;
          if (item.modifier !== undefined && String(item.modifier).trim() !== "") {
            const modStr = String(item.modifier).trim();
            const hasLetters = /[a-zA-Z]/.test(modStr);
            if (hasLetters) {
              modVal = evaluateFormula(modStr, vars);
            } else {
              modVal = parseInt(modStr, 10) || 0;
            }
          }
          return sum + modVal;
        }, 0);

      const totalMod = statMod + eqMod;
      handleRoll(rollFormulaToUse, `${ability.name} Cast`, undefined, totalMod);
    } else {
      toast.success(`${ability.name} activated! (-${effectiveCost} MP)`);
    }
  };

  const handleAbilityLevelChange = (abilityId: number, direction: "up" | "down") => {
    const targetAb = abilities.find(a => a.id === abilityId);
    if (!targetAb) return;
    const curLevel = targetAb.level || 1;
    const nextLevel = direction === "up" ? curLevel + 1 : Math.max(1, curLevel - 1);
    updateAbilityMut.mutate({
      id: abilityId,
      data: { level: nextLevel }
    });
  };

  const toggleAbilityActive = (ability: Ability, manaCost = 0) => {
    const nextActive = !ability.active;
    const prevStats = getAdjustedStats(character, equipment, abilities);
    const updatedAbilities = abilities.map(a => a.id === ability.id ? { ...a, active: nextActive } : a);
    const newStats = getAdjustedStats(character, equipment, updatedAbilities);

    const evalVars = {
      power: newStats.stats.power, pow: newStats.stats.power,
      vitality: newStats.stats.vitality, vit: newStats.stats.vitality,
      spirit: newStats.stats.spirit, spi: newStats.stats.spirit,
      agility: newStats.stats.agility, agi: newStats.stats.agility,
      endurance: newStats.stats.endurance, end: newStats.stats.endurance,
      precision: newStats.stats.precision, pre: newStats.stats.precision,
      willpower: newStats.stats.willpower, wil: newStats.stats.willpower,
      charisma: newStats.stats.charisma, cha: newStats.stats.charisma,
    };

    // Calculate ability (and sub-abilities) Add vs Buff totals
    let valHpAdd = parseFormulaOrNum(ability.hpAdd, evalVars);
    let valHpBuff = parseFormulaOrNum(ability.hpBuff, evalVars);
    let valManaAdd = parseFormulaOrNum(ability.manaAdd, evalVars);
    let valManaBuff = parseFormulaOrNum(ability.manaBuff, evalVars);
    let valDtAdd = parseFormulaOrNum(ability.dtAdd, evalVars);
    let valDtBuff = parseFormulaOrNum(ability.dtBuff, evalVars);

    if (ability.subAbilities && ability.subAbilities.length > 0) {
      for (const sub of ability.subAbilities) {
        valHpAdd += parseFormulaOrNum(sub.hpAdd, evalVars);
        valHpBuff += parseFormulaOrNum(sub.hpBuff, evalVars);
        valManaAdd += parseFormulaOrNum(sub.manaAdd, evalVars);
        valManaBuff += parseFormulaOrNum(sub.manaBuff, evalVars);
        valDtAdd += parseFormulaOrNum(sub.dtAdd, evalVars);
        valDtBuff += parseFormulaOrNum(sub.dtBuff, evalVars);
      }
    }

    const curHp = hp ?? character.currentHp;
    const spent = spendTemporary(character, { currentMana: (mana ?? character.currentMana) - manaCost });
    const curMana = spent.currentMana ?? (mana ?? character.currentMana);
    const curDt = currentDt ?? character.currentDt;

    let newHp = curHp;
    let newMana = curMana;
    let newDt = curDt;

    if (nextActive) {
      // Activating: If pool was full or gains an increase, fill current pool to new max
      const isHpFull = curHp >= prevStats.totalMaxHp;
      const isManaFull = curMana >= prevStats.totalMaxMana;
      const isDtFull = curDt >= prevStats.totalMaxDt;

      newHp = isHpFull ? newStats.totalMaxHp : Math.min(newStats.totalMaxHp, curHp + valHpAdd + valHpBuff);
      newMana = isManaFull ? newStats.totalMaxMana : Math.min(newStats.totalMaxMana, curMana + valManaAdd + valManaBuff);
      newDt = isDtFull ? newStats.totalMaxDt : Math.min(newStats.totalMaxDt, curDt + valDtAdd + valDtBuff);
    } else {
      // Remove the source's remaining contribution without spending temporary pools.
      newHp = removeResourceBonus(curHp, prevStats.totalMaxHp, newStats.totalMaxHp);
      newMana = removeResourceBonus(curMana, prevStats.totalMaxMana, newStats.totalMaxMana);
      newDt = removeResourceBonus(curDt, prevStats.totalMaxDt, newStats.totalMaxDt);
    }

    updateAbilityMut.mutate({
      id: ability.id,
      data: { active: nextActive }
    }, {
      onSuccess: () => {
        updateChar.mutate({
          id,
          // Source changes are already reconciled by storage. These are final
          // pool values, not damage that should spend temporary HP/DT again.
          resourceMode: "exact",
          data: {
            currentHp: newHp,
            currentMana: newMana,
            currentDt: newDt,
            ...(manaCost > 0 ? { tempMana: spent.tempMana ?? character.tempMana ?? 0 } : {})
          }
        }, {
          onSuccess: updated => {
            syncResourceState(updated);
            toast.success(`${ability.name} ${nextActive ? "activated" : "deactivated"}`);
          }
        });
      }
    });
  };

  // ── Familiar Rolls ────────────────────────────────────────
  const handleFamiliarStatRoll = (famId: string | number, statKey: string, statLabel: string, val: number) => {
    const actor = character.familiars?.find(familiar => familiar.id === famId);
    if (!actor) return;
    const numericVal = getFamiliarAdjusted(actor).stats[statKey] ?? Number(val);
    const mod = getModifierForStat(numericVal, actor.className);
    const dice = getDiceLabel(numericVal);
    setRollingDice(`fam-${famId}-${statLabel}`);
    setLastRoll(null);
    setCritChain(null);

    createRoll.mutate(
      { 
        id, 
        data: { 
          diceType: dice, 
          modifier: mod, 
          label: `Fam: ${statLabel} Roll`, 
          familiarId: famId,
          rollPurpose: "check",
          rollScope: statKey,
          statValue: numericVal
        } 
      },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const rawDiceStr = String(data.diceType || "");
            const breakdownStr = (/^d\d+$/i.test(rawDiceStr) || !rawDiceStr) ? String(rolled) : rawDiceStr;
            if (wasCrit) {
              setCritChain({ chainCount: 0, chainDie: dice, runningDiceTotal: rolled, modifier: data.modifier ?? data.total - rolled, label: `Fam: ${statLabel} Roll`, lastRolledValue: rolled, statValue: numericVal, familiarId: famId, rolls: [{ label: "Roll 1", breakdown: breakdownStr, total: rolled }] });
            } else {
              setLastRoll({ rawRoll: rolled, modifier: data.modifier ?? data.total - rolled, total: data.total, hadCrit: false, maxChainCount: -1, diceType: dice, label: `Fam: ${statLabel} Roll`, rolls: [{ label: "Roll 1", breakdown: breakdownStr, total: rolled }] });
            }
            setRollingDice(null);
          }, 600);
        },
        onError: () => setRollingDice(null)
      }
    );
  };

  const ownedAbilityActive = (ability: Ability, familiar?: Familiar) => {
    if (!ability.definition) return !!ability.active;
    const values = familiar ? getFamiliarAdjusted(familiar) : adjustedStats;
    const context = familiar ? { hp: familiar.currentHp, maxHp: values.maxHp, mana: familiar.currentMana, maxMana: values.maxMana, dt: familiar.currentDt, maxDt: values.maxDt } : { hp: hp ?? character.currentHp, maxHp, mana: mana ?? character.currentMana, maxMana, dt: currentDt ?? character.currentDt, maxDt };
    const parent = resolveTrackerEffects([ability], familiar?.className ?? character.rank, values.stats, context, familiar?.triggerConfirmations ?? character.triggerConfirmations ?? {}).find(entry => !entry.result && entry.input?.id === ability.definition!.id);
    return !!parent && isEffectApplied(parent, "self", familiar?.effectApplications ?? character.effectApplications ?? []);
  };
  const renderOwnedAbilityDetails = (ability: Ability, familiar?: Familiar) => {
    if (!ability.definition) return null;
    const values = familiar ? getFamiliarAdjusted(familiar) : adjustedStats;
    const context = familiar ? { hp: familiar.currentHp, maxHp: values.maxHp, mana: familiar.currentMana, maxMana: values.maxMana, dt: familiar.currentDt, maxDt: values.maxDt } : { hp: hp ?? character.currentHp, maxHp, mana: mana ?? character.currentMana, maxMana, dt: currentDt ?? character.currentDt, maxDt };
    return <AbilityResultList ability={ability} rank={familiar?.className ?? character.rank} stats={values.stats} vitals={context} confirmations={familiar?.triggerConfirmations ?? character.triggerConfirmations ?? {}} applications={familiar?.effectApplications ?? character.effectApplications ?? []}
      onApplicationsChange={applications => {
        if (!familiar) { changeAbilityApplications(applications); return; }
        const next = { ...familiar, effectApplications: applications }; const after = getFamiliarAdjusted(next);
        next.currentHp = removeResourceBonus(familiar.currentHp, values.maxHp, after.maxHp); next.currentMana = removeResourceBonus(familiar.currentMana, values.maxMana, after.maxMana); next.currentDt = removeResourceBonus(familiar.currentDt, values.maxDt, after.maxDt);
        updateChar.mutate({ id, resourceMode: "exact", data: { familiars: character.familiars!.map(entry => entry.id === familiar.id ? next : entry) } });
      }} onRoll={(formula, label) => handleAbilityResultRoll(formula, label, familiar)} onUse={nodeId => familiar ? handleFamiliarAbilityRoll(familiar, ability as FamiliarAbility, nodeId) : handleAbilityRoll(ability, undefined, nodeId)}
      onUseResult={resultId => { const entry = resolveTrackerEffects([ability], familiar?.className ?? character.rank, values.stats, context, familiar?.triggerConfirmations ?? character.triggerConfirmations ?? {}).find(entry => entry.effect.id === resultId); if (!entry) return; if (familiar) handleFamiliarAbilityRoll(familiar, ability as FamiliarAbility, entry.input?.id, resultId); else executeFavoriteResult(entry, false); }}
      onPayMana={(amount, label) => handleAbilityManaPayment(amount, label, familiar)} movementSpeed={values.speed} familiars={familiar ? [] : character.familiars} timing={familiar?.abilityTiming ?? character.abilityTiming}
      onTimingChange={(nodeId, patch) => familiar ? updateFamiliarData(familiar.id, { ...familiar, abilityTiming: { ...familiar.abilityTiming, [nodeId]: { ...familiar.abilityTiming?.[nodeId], ...patch } } }) : updateChar.mutate({ id, data: { abilityTiming: { ...character.abilityTiming, [nodeId]: { ...character.abilityTiming?.[nodeId], ...patch } } } })}/>
  };
  const handleFamiliarAbilityRoll = (fam: Familiar, ability: FamiliarAbility, inputId?: string, resultId?: string) => {
    if (ability.definition) {
      const current = character.familiars?.find(entry => entry.id === fam.id);
      if (!current || updateChar.isPending || rollingDice) return;
      const before = getFamiliarAdjusted(current);
      const entries = resolveTrackerEffects([familiarAbilityAsAbility(ability)], current.className, before.stats, { hp: current.currentHp, maxHp: before.maxHp, mana: current.currentMana, maxMana: before.maxMana, dt: current.currentDt, maxDt: before.maxDt }, current.triggerConfirmations ?? {});
      const nodeId = inputId ?? ability.definition.id;
      const parent = entries.find(entry => !entry.result && entry.input?.id === nodeId);
      if (!parent) return;
      const applications = current.effectApplications ?? [];
      const recorded = applications.some(application => application.abilityId === ability.id && application.effectId === nodeId && application.targetId === "self");
      const ending = !resultId && shouldEndAbilityOnUse(recorded, parent.input!.durationType, true);
      if (!ending && parent.applicability !== "available") { toast.info("This familiar ability's resource condition is not met."); return; }
      if (parent.input!.durationType === "When Triggered" && parent.input!.trigger.conditions.some(condition => condition.kind === "resource") && !isEffectApplied(parent, "self", applications)) return;
      const choices = favoriteRollChoices(entries, ability.id, nodeId);
      if (!ending && !resultId && choices.length > 1) { setFamiliarRollPicker({ familiarId: current.id, abilityId: ability.id, inputId: nodeId }); return; }
      const result = resultId ? entries.find(entry => entry.effect.id === resultId) : choices[0] ?? parent;
      if (!result) return;
      if (!ending && (result.applicability !== "available" || result.triggerParent && !isEffectApplied(result.triggerParent, "self", applications))) { toast.info("This result's resource requirements are not currently met."); return; }
      const cost = ending ? 0 : parent.input!.manaCost ?? 0;
      if (current.currentMana + (current.tempMana ?? 0) < cost) { toast.error("Not enough familiar mana."); return; }
      const nextApplications = ending ? applications.filter(application => !(application.abilityId === ability.id && application.effectId === nodeId && application.targetId === "self")) : recorded || parent.permanent || ["Instant", "When Triggered"].includes(parent.input!.durationType) ? applications : [...applications, { id: crypto.randomUUID(), abilityId: ability.id, effectId: nodeId, targetId: "self", startedAt: new Date().toISOString() }];
      const next = { ...current, ...spendTemporary(current, { effectApplications: nextApplications, currentMana: current.currentMana - cost }) };
      const after = getFamiliarAdjusted(next);
      next.currentHp = removeResourceBonus(current.currentHp, before.maxHp, after.maxHp);
      next.currentMana = removeResourceBonus(next.currentMana, before.maxMana, after.maxMana);
      next.currentDt = removeResourceBonus(current.currentDt, before.maxDt, after.maxDt);
      updateChar.mutate({ id, resourceMode: "exact", data: { familiars: character.familiars!.map(familiar => familiar.id === next.id ? next : familiar) } }, { onSuccess: () => {
        createRoll.mutate({ id, data: { diceType: "action-log", modifier: 0, label: `${ending ? "Ended" : "Used"} ${parent.input!.name}`, familiarId: current.id } });
        for (const [key, diceType] of [["currentHp", "hp-log"], ["currentMana", "mana-log"], ["currentDt", "dt-log"]] as const) {
          const delta = next[key] - current[key] + (key === "currentMana" ? Math.max(0, cost - (current.tempMana ?? 0)) : 0);
          if (delta) createRoll.mutate({ id, data: { diceType, modifier: delta, label: `${parent.input!.name}: bonus/debuff source changed`, familiarId: current.id } });
        }
        if (cost) createRoll.mutate({ id, data: { diceType: "mana-log", modifier: -cost, label: parent.input!.name, familiarId: current.id } });
        if (!ending && result.effect.rollFormula) handleAbilityResultRoll(result.effect.rollFormula, parent.input!.name, next, result.effect.duration?.startsWith("Until Used") ? () => updateChar.mutate({ id, data: { familiars: character.familiars!.map(familiar => familiar.id === next.id ? { ...next, effectApplications: (next.effectApplications ?? []).filter(application => !(application.abilityId === ability.id && (application.effectId === result.effect.id || application.effectId === nodeId))) } : familiar) } }) : undefined);
      }, onError: error => toast.error(error.message) });
      return;
    }
    const curMana = fam.currentMana;
    if (curMana + (fam.tempMana ?? 0) < ability.cost) {
      toast.error(`${fam.name} not enough Mana! Requires ${ability.cost} MP`);
      return;
    }
    const nextMana = curMana - ability.cost;

    const fMax = getFamiliarMaxValues(fam);
    const updates: Partial<Familiar> = { currentMana: nextMana };
    const changes: string[] = [];

    if (ability.cost > 0) {
      createRoll.mutate({ id, data: { diceType: "mana-log", modifier: -ability.cost, label: `Fam: ${ability.name} Cost`, familiarId: fam.id } });
    }

    const valHpAdd = parseFormulaOrNum(ability.hpAdd, fMax);
    const valManaAdd = parseFormulaOrNum(ability.manaAdd, fMax);
    const valDtAdd = parseFormulaOrNum(ability.dtAdd, fMax);

    if (valHpAdd > 0) {
      const nextHp = Math.min(fMax.maxHp, fam.currentHp + valHpAdd);
      updates.currentHp = nextHp;
      changes.push(`+${valHpAdd} HP`);
      createRoll.mutate({ id, data: { diceType: "hp-log", modifier: nextHp - fam.currentHp, label: `Fam: ${ability.name} Heal`, familiarId: fam.id } });
    }
    if (valManaAdd > 0) {
      const nextM = Math.min(fMax.maxMana, nextMana + valManaAdd);
      updates.currentMana = nextM;
      changes.push(`+${valManaAdd} MP`);
      createRoll.mutate({ id, data: { diceType: "mana-log", modifier: nextM - nextMana, label: `Fam: ${ability.name} Restore`, familiarId: fam.id } });
    }
    if (valDtAdd > 0) {
      const nextDt = Math.min(fMax.maxDt, fam.currentDt + valDtAdd);
      updates.currentDt = nextDt;
      changes.push(`+${valDtAdd} DT`);
      createRoll.mutate({ id, data: { diceType: "dt-log", modifier: nextDt - fam.currentDt, label: `Fam: ${ability.name} Shield`, familiarId: fam.id } });
    }

    updateFamiliarData(fam.id, { ...fam, ...updates });
    const vitalsMsg = changes.length > 0 ? ` Restored ${changes.join(", ")}.` : "";

    if (changes.length > 0) {
      toast.success(`${fam.name} activated ${ability.name}!${vitalsMsg}`);
    }

    if (ability.rollFormula) {
      setRollingDice(`fam-ability-${ability.id}`);
      setLastRoll(null);
      setCritChain(null);

      createRoll.mutate(
        { 
          id, 
          data: { 
            diceType: ability.rollFormula, 
            modifier: 0, 
            label: `Fam: ${ability.name} Cast`, 
            familiarId: fam.id 
          } 
        },
        {
          onSuccess: (data) => {
            setTimeout(() => {
              const rolled = data.result ?? 0;
              const wasCrit = (data as any).isCrit ?? false;
              const chainDie = getChainDie(ability.rollFormula);
              const rawDiceStr = String(data.diceType || "");
              const breakdownStr = (/^d\d+$/i.test(rawDiceStr) || !rawDiceStr) ? String(rolled) : rawDiceStr;
              if (wasCrit) {
                setCritChain({ chainCount: 0, chainDie, runningDiceTotal: rolled, modifier: data.modifier ?? data.total - rolled, label: `Fam: ${ability.name} Cast`, lastRolledValue: rolled, familiarId: fam.id, rolls: [{ label: "Roll 1", breakdown: breakdownStr, total: rolled }] });
              } else {
                setLastRoll({ rawRoll: rolled, modifier: data.modifier ?? data.total - rolled, total: data.total, hadCrit: false, maxChainCount: -1, diceType: data.diceType, label: `Fam: ${ability.name} Cast`, rolls: [{ label: "Roll 1", breakdown: breakdownStr, total: rolled }] });
              }
              setRollingDice(null);
            }, 600);
          },
          onError: () => setRollingDice(null)
        }
      );
    } else if (changes.length === 0) {
      toast.success(`${fam.name} used ${ability.name}!`);
    }
  };

  // ── Favorites Hotbar Executer ─────────────────────────────
  const handleExecuteFavorite = (slot: FavoriteSlot) => {
    if (slot.type === "ability-result") {
      const ability = abilities.find(entry => entry.id === Number(slot.targetId));
      if (!ability) { toast.error("Ability no longer exists."); return; }
      const entry = resolveTrackerEffects([ability], character.rank, finalStats, { hp: hp ?? character.currentHp, maxHp, mana: mana ?? character.currentMana, maxMana, dt: currentDt ?? character.currentDt, maxDt }, character.triggerConfirmations ?? {}, character.familiars).find(result => result.effect.id === slot.subId);
      if (!entry?.effect.rollFormula) { toast.error("This result no longer has a roll."); return; }
      if (entry.applicability !== "available" && !isEffectApplied(entry, "self", character.effectApplications ?? [])) { toast.info("This result's resource requirements are not currently met."); return; }
      executeFavoriteResult(entry);
      return;
    }
    if (slot.type === "sub-ability") {
      const ability = abilities.find(entry => entry.id === Number(slot.targetId));
      if (ability?.definition) { handleAbilityRoll(ability, undefined, slot.subId); return; }
    }
    if (slot.type === "attribute") {
      const statLabel = STATS.find(s => s.key === slot.targetId)?.label || String(slot.targetId).toUpperCase();
      handleStatRoll(slot.targetId as string, statLabel);
    } else if (slot.type === "weapon" || slot.type === "item") {
      const eq = equipment.find(e => e.id === Number(slot.targetId));
      const invItem = inventory.find(i => i.id === Number(slot.targetId));

      if (eq) {
        handleWeaponRoll(eq);
      } else if (invItem) {
        const linkedAb = abilities.find(a => a.inventoryItemId === invItem.id);
        if (linkedAb) {
          handleAbilityRoll(linkedAb);
        } else {
          if (invItem.quantity <= 0) {
            toast.error(`Out of "${invItem.name}"!`);
            return;
          }
          const nextQty = invItem.quantity - 1;
          if (nextQty <= 0) {
            deleteInvItem.mutate({ id: invItem.id, charId: id }, {
              onSuccess: () => toast.success(`Used last of "${invItem.name}". Item consumed!`)
            });
          } else {
            updateInvItem.mutate({ id: invItem.id, data: { quantity: nextQty } });
            toast.success(`Used 1 of "${invItem.name}". Remaining: ${nextQty}`);
          }
        }
      } else {
        toast.error("Item no longer found in inventory");
      }
    } else if (slot.type === "ability") {
      const ability = abilities.find(a => a.id === Number(slot.targetId));
      if (ability) handleAbilityRoll(ability);
      else toast.error("Ability not found");
    } else if (slot.type === "sub-ability") {
      const ability = abilities.find(a => a.id === Number(slot.targetId));
      if (ability && ability.subAbilities) {
        const subIndex = ability.subAbilities.findIndex(s => s.id === slot.subId);
        const sub = subIndex !== -1 ? ability.subAbilities[subIndex] : null;
        if (sub) {
          const subTitle = sub.name?.trim() ? sub.name.trim() : `${ability.name} (${subIndex + 2})`;
          const subAsAbility: Ability = {
            ...ability,
            name: subTitle,
            cost: sub.cost ?? 0,
            cooldown: sub.cooldown ?? 0,
            range: sub.range || "",
            speed: sub.speed || "",
            type: sub.type || "",
            rollFormula: sub.rollFormula || ability.rollFormula,
            linkedStats: sub.linkedStats || ability.linkedStats,
            bonusPower: sub.bonusPower ?? 0,
            bonusVitality: sub.bonusVitality ?? 0,
            bonusSpirit: sub.bonusSpirit ?? 0,
            bonusAgility: sub.bonusAgility ?? 0,
            bonusEndurance: sub.bonusEndurance ?? 0,
            bonusPrecision: sub.bonusPrecision ?? 0,
            bonusWillpower: sub.bonusWillpower ?? 0,
            bonusCharisma: sub.bonusCharisma ?? 0,
            hpAdd: sub.hpAdd ?? 0,
            hpBuff: sub.hpBuff ?? 0,
            manaAdd: sub.manaAdd ?? 0,
            manaBuff: sub.manaBuff ?? 0,
            dtAdd: sub.dtAdd ?? 0,
            dtBuff: sub.dtBuff ?? 0,
            bonusInitiative: sub.bonusInitiative ?? 0,
            resistances: sub.resistances || "",
            immunities: sub.immunities || "",
          };
          handleAbilityRoll(subAsAbility);
        }
      }
    } else if (slot.type === "skill") {
      const skill = skills.find(s => s.id === Number(slot.targetId));
      if (skill) handleSkillRoll(skill);
      else toast.error("Skill not found");
    } else if (slot.type === "familiar-attribute" && slot.familiarId !== undefined) {
      const fam = character.familiars?.find(f => f.id === slot.familiarId);
      if (fam) {
        const statVal = (fam as any)[slot.targetId] as number;
        handleFamiliarStatRoll(fam.id, slot.targetId as string, String(slot.targetId).toUpperCase(), statVal);
      } else toast.error("Familiar not found");
    } else if (slot.type === "familiar-ability" && slot.familiarId !== undefined) {
      const fam = character.familiars?.find(f => f.id === slot.familiarId);
      if (fam) {
        const ability = fam.abilities.find(a => a.id === Number(slot.targetId));
        if (ability) handleFamiliarAbilityRoll(fam, ability);
        else toast.error("Familiar ability not found");
      } else toast.error("Familiar not found");
    }
  };

  const handleAssignFavorite = (slotIdx: number, type: FavoriteSlot["type"], targetId: string | number, label: string, familiarId?: string | number, subId?: string) => {
    const cur = [...getFavorites(character, equipment, abilities)];
    cur[slotIdx] = { type, targetId, label, familiarId, subId };
    updateChar.mutate({ id, data: { favorites: cur } });
    setAssigningSlotIndex(null);
    toast.success(`Slot #${slotIdx + 1} assigned successfully!`);
  };

  const handleClearFavorite = (slotIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const cur = [...getFavorites(character, equipment, abilities)];
    cur[slotIdx] = null;
    updateChar.mutate({ id, data: { favorites: cur } });
    toast.success(`Slot #${slotIdx + 1} cleared.`);
  };

  const scrollToElement = (elementId: string) => {
    setPendingScrollTarget(elementId);
  };

  const handleLocateFavorite = (fav: FavoriteSlot, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!fav) return;

    if (fav.type === "ability" || fav.type === "ability-result" || fav.type === "sub-ability") {
      (setActiveTab("abilities"), revealWorkspaceTool("abilities"));
      const abId = Number(fav.targetId);
      setExpandedAbilities(prev => ({ ...prev, [abId]: true }));
      toast.success(`Navigated to Shaped Ability: ${fav.label}`);
      scrollToElement(`ability-card-${abId}`);
    } else if (fav.type === "familiar-ability") {
      (setActiveTab("familiar"), revealWorkspaceTool("familiar"));
      toast.success(`Navigated to Familiar Action: ${fav.label}`);
      const familiar = character.familiars?.find(fam => fav.familiarId != null ? fam.id === fav.familiarId : fam.abilities.some(ability => ability.id === Number(fav.targetId)));
      if (familiar) {
        setExpandedFamiliars(prev => ({ ...prev, [familiar.id]: true }));
        scrollToElement(`fam-ability-card-${familiar.id}-${fav.targetId}`);
      }
    } else if (fav.type === "weapon" || fav.type === "item") {
      (setActiveTab("inventory"), revealWorkspaceTool("inventory"));
      toast.success(`Navigated to Inventory: ${fav.label}`);
      const targetId = Number(fav.targetId);
      const isEq = equipment.some(e => e.id === targetId);
      if (isEq) {
        scrollToElement(`equipment-card-${targetId}`);
      } else {
        scrollToElement(`inventory-card-${targetId}`);
      }
    } else if (fav.type === "skill") {
      (setActiveTab("skills"), revealWorkspaceTool("skills"));
      const skillId = Number(fav.targetId);
      const skill = skills.find(s => s.id === skillId);
      if (skill) {
        const cat = skill.category?.trim() || "General Skills";
        setExpandedCategories(prev => ({ ...prev, [cat]: true }));
      }
      toast.success(`Navigated to Skills Log: ${fav.label}`);
      scrollToElement(`skill-card-${skillId}`);
    } else if (fav.type === "attribute") {
      (setActiveTab("stats"), revealWorkspaceTool("attributes"));
      toast.success(`Navigated to Attributes: ${fav.label}`);
      scrollToElement(`stat-card-${fav.targetId}`);
    } else if (fav.type === "familiar-attribute") {
      (setActiveTab("familiar"), revealWorkspaceTool("familiar"));
      if (fav.familiarId != null) {
        setExpandedFamiliars(prev => ({ ...prev, [fav.familiarId!]: false }));
      }
      toast.success(`Navigated to Familiar: ${fav.label}`);
      scrollToElement(`familiar-card-${fav.familiarId}`);
    }
  };

  // ── Inventory Dialog Trigger Helpers ──────────────────────
  const triggerAddInventory = (category: "currency" | "equipment" | "item") => {
    setInvType(category);
    setInvMode("add");
    setInvInitialData(null);
    setIsInvOpen(true);
  };

  const triggerEditInventory = (category: "currency" | "equipment" | "item", item: any) => {
    setInvType(category);
    setInvMode("edit");
    setInvInitialData(item);
    setIsInvOpen(true);
  };

  const triggerAddItemAbility = (eqId: number | null, invItemId: number | null = null) => {
    setItemAbEquipmentId(eqId);
    setItemAbInventoryItemId(invItemId);
    setItemAbInitialData(null);
    setIsItemAbOpen(true);
  };

  const triggerEditItemAbility = (ability: Ability) => {
    setItemAbEquipmentId(ability.equipmentId || null);
    setItemAbInventoryItemId(ability.inventoryItemId || null);
    setItemAbInitialData(ability);
    setIsItemAbOpen(true);
  };

  const triggerDiscardItem = (item: any) => {
    setDiscardItem(item);
    setDiscardCount(1);
    setIsDiscardOpen(true);
  };

  const handleConfirmDiscard = () => {
    if (!discardItem) return;
    const amountToDiscard = discardCount;
    const item = discardItem;

    if (amountToDiscard >= item.quantity) {
      deleteInvItem.mutate({ id: item.id, charId: id }, {
        onSuccess: () => {
          setIsDiscardOpen(false);
          setDiscardItem(null);
          toast.success(`Discarded all ${item.name}.`);
        }
      });
    } else {
      const nextQuantity = item.quantity - amountToDiscard;
      updateInvItem.mutate({
        id: item.id,
        data: { quantity: nextQuantity }
      }, {
        onSuccess: () => {
          setIsDiscardOpen(false);
          setDiscardItem(null);
          toast.success(`Discarded ${amountToDiscard} ${item.name}.`);
        }
      });
    }
  };

  const handleDiscardAll = () => {
    if (!discardItem) return;
    deleteInvItem.mutate({ id: discardItem.id, charId: id }, {
      onSuccess: () => {
        setIsDiscardOpen(false);
        setDiscardItem(null);
        toast.success(`Discarded all ${discardItem.name}.`);
      }
    });
  };

  // ── Essence Additions ─────────────────────────────────────
  const handleSaveEssence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!essenceName.trim() || essenceSlotInput === null) return;

    addEssence.mutate({
      characterId: id,
      name: essenceName,
      description: essenceDesc,
      slot: essenceSlotInput,
    }, {
      onSuccess: () => {
        setEssenceSlotInput(null);
        setEssenceName("");
        setEssenceDesc("");
      }
    });
  };

  // ── Campaign Notes Additions ──────────────────────────────
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    createNote.mutate(
      {
        characterId: id,
        title: noteTitle,
        content: noteContent,
        category: noteCat,
        tags: [],
        images: noteImages,
      },
      {
        onSuccess: () => {
          setNoteTitle("");
          setNoteContent("");
          setNoteCat("general");
          setNoteImages([]);
        }
      }
    );
  };

  // ── Stat & Skill Training (Direction Support) ──────────────
  const handleStatTrain = (statKey: string, direction: "up" | "down" = "up") => {
    const charStatValue = (character as any)[statKey] as number;
    const trainingKey = `${statKey}Training`;
    const curTraining = ((character as any)[trainingKey] as number) || 0;

    if (direction === "up") {
      const nextTraining = curTraining + 1;
      if (nextTraining >= charStatValue) {
        updateChar.mutate({
          id,
          data: {
            [statKey]: charStatValue + 1,
            [trainingKey]: 0,
          }
        }, {
          onSuccess: () => toast.success(`${statKey.toUpperCase()} increased to ${charStatValue + 1}!`)
        });
      } else {
        updateChar.mutate({ id, data: { [trainingKey]: nextTraining } });
      }
    } else {
      if (curTraining > 0) {
        updateChar.mutate({ id, data: { [trainingKey]: curTraining - 1 } });
      } else if (charStatValue > 0) {
        const nextVal = charStatValue - 1;
        const nextTraining = Math.max(0, nextVal - 1);
        updateChar.mutate({
          id,
          data: {
            [statKey]: nextVal,
            [trainingKey]: nextTraining,
          }
        }, {
          onSuccess: () => toast.info(`${statKey.toUpperCase()} decreased to ${nextVal} (${nextTraining}/${nextVal} Training).`)
        });
      }
    }
  };

  const handleSkillTrain = (skill: Skill, direction: "up" | "down" = "up") => {
    if (direction === "up") {
      const nextTraining = skill.training + 1;
      if (nextTraining >= skill.value) {
        updateSkillMut.mutate({
          id: skill.id,
          data: {
            value: skill.value + 1,
            training: 0,
          }
        }, {
          onSuccess: () => toast.success(`${skill.name} increased to ${skill.value + 1}!`)
        });
      } else {
        updateSkillMut.mutate({ id: skill.id, data: { training: nextTraining } });
      }
    } else {
      if (skill.training > 0) {
        updateSkillMut.mutate({ id: skill.id, data: { training: skill.training - 1 } });
      } else if (skill.value > 0) {
        const nextVal = skill.value - 1;
        const nextTraining = Math.max(0, nextVal - 1);
        updateSkillMut.mutate({
          id: skill.id,
          data: {
            value: nextVal,
            training: nextTraining,
          }
        }, {
          onSuccess: () => toast.info(`${skill.name} decreased to ${nextVal} (${nextTraining}/${nextVal} Training).`)
        });
      }
    }
  };

  // ── Familiar Binder (Multiple Companions) ─────────────────
  const handleBindFamiliar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!famName.trim()) return;

    const vars = {
      power: famPower, pow: famPower,
      vitality: famVitality, vit: famVitality,
      spirit: famSpirit, spi: famSpirit,
      agility: famAgility, agi: famAgility,
      endurance: famEndurance, end: famEndurance,
      precision: famPrecision, pre: famPrecision,
      willpower: famWillpower, wil: famWillpower,
      charisma: famCharisma, cha: famCharisma,
      dtbonus: 0
    };

    const calculatedHp = Math.max(1, evaluateFormula(famHpFormula || "Vitality * 8", vars));
    const calculatedMana = Math.max(0, evaluateFormula(famManaFormula || "Spirit * 5", vars));
    const calculatedDt = Math.max(0, evaluateFormula(famDtFormula || "Endurance * 1", vars));

    const newFam: Familiar = {
      id: Date.now(),
      name: famName,
      className: famClassName || "Companion",
      race: famRace || "Beast",
      level: 1,
      speed: famSpeed,
      power: famPower,
      vitality: famVitality,
      spirit: famSpirit,
      agility: famAgility,
      endurance: famEndurance,
      precision: famPrecision,
      willpower: famWillpower,
      charisma: famCharisma,
      currentHp: calculatedHp,
      currentMana: calculatedMana,
      currentDt: calculatedDt,
      dtBonus: 0,
      hpFormula: famHpFormula || "Vitality * 8",
      manaFormula: famManaFormula || "Spirit * 5",
      dtFormula: famDtFormula || "Endurance * 1",
      resistances: famResistances,
      immunities: famImmunities,
      abilities: []
    };

    const list = character.familiars ? [...character.familiars] : [];
    list.push(newFam);
    updateChar.mutate({ id, data: { familiars: list } }, {
      onSuccess: () => {
        setFamName("");
        setFamClassName("Iron");
        setFamRace("");
        setFamSpeed(25);
        setFamPower(10);
        setFamVitality(10);
        setFamSpirit(10);
        setFamAgility(10);
        setFamEndurance(10);
        setFamPrecision(10);
        setFamWillpower(10);
        setFamCharisma(10);
        setFamHpFormula("Vitality * 8");
        setFamManaFormula("Spirit * 5");
        setFamDtFormula("Endurance * 1");
        setFamResistances("");
        setFamImmunities("");
        setIsAddingFamiliar(false);
        toast.success(`Familiar ${newFam.name} bound successfully!`);
      }
    });
  };

  const handleReleaseFamiliarClick = (famId: string | number) => {
    setReleasingFamId(famId);
    setIsReleaseConfirmOpen(true);
  };

  const handleConfirmFirstRelease = () => {
    setIsReleaseConfirmOpen(false);
    setIsReleaseDoubleConfirmOpen(true);
  };

  const handleConfirmSecondRelease = () => {
    if (releasingFamId !== null) {
      updateFamiliarData(releasingFamId, null);
    }
    setIsReleaseDoubleConfirmOpen(false);
    setReleasingFamId(null);
  };



  // ── Notes Backup & Restore ──
  const handleExportNotes = () => {
    if (!notes || notes.length === 0) {
      toast.error("No notes to export!");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(notes, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${character.name.toLowerCase().replace(/\s+/g, "_")}_campaign_notes.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Notes exported successfully!");
  };

  const handleImportNotesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      try {
        const importedNotes = JSON.parse(text);
        if (!Array.isArray(importedNotes)) {
          throw new Error("Invalid format. Expected an array of notes.");
        }

        let importCount = 0;
        const existingNotes = notes || [];
        for (const note of importedNotes) {
          if (note.title && note.content) {
            let titleToUse = note.title;
            const exists = existingNotes.some(n => n.title.toLowerCase() === note.title.toLowerCase());
            if (exists) {
              titleToUse = `${note.title} (Copy)`;
            }
            createNote.mutate({
              characterId: Number(id),
              title: titleToUse,
              content: note.content,
              category: note.category || "general",
              tags: Array.isArray(note.tags) ? note.tags : [],
              images: Array.isArray(note.images) ? note.images : []
            });
            importCount++;
          }
        }
        toast.success(`Successfully imported ${importCount} notes!`);
      } catch (err) {
        toast.error("Failed to parse notes file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Familiar Full Rest ──
  const handleFamFullRest = (fam: Familiar) => {
    const rested = restedFamiliar(fam);
    const fMax = { maxHp: rested.currentHp, maxMana: rested.currentMana, maxDt: rested.currentDt };
    const curHp = fam.currentHp;
    const curMana = fam.currentMana;
    const curDt = fam.currentDt;

    setFamDtFlashes(prev => ({
      ...prev,
      [fam.id]: "restore" as const
    }));
    setFamDamageResults(prev => {
      const copy = { ...prev };
      delete copy[fam.id];
      return copy;
    });
    updateChar.mutate({ id, resourceMode: "exact", data: { familiars: (character.familiars ?? []).map(entry => entry.id === fam.id ? rested : entry) } });

    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: fMax.maxHp - curHp, label: `Fam: ${fam.name} Long Rest`, familiarId: fam.id } });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: fMax.maxDt - curDt, label: `Fam: ${fam.name} Long Rest`, familiarId: fam.id } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: fMax.maxMana - curMana, label: `Fam: ${fam.name} Long Rest`, familiarId: fam.id } });

    createRoll.mutate({ id, data: { diceType: "action-log", modifier: 0, label: `${fam.name}: Long Rest reset abilities, timers and trigger checks`, familiarId: fam.id } });
    toast.success(`${fam.name} completed a Long Rest. Base state restored.`);
    setTimeout(() => {
      setFamDtFlashes(prev => ({
        ...prev,
        [fam.id]: null
      }));
    }, 600);
  };

  // ── Drag and Drop Handlers ──
  const handleAbilityDragStart = (e: React.DragEvent, abilityId: number) => {
    setDraggedAbilityId(abilityId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleAbilityDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAbilityDrop = (e: React.DragEvent, targetAbilityId: number, groupAbilities: Ability[]) => {
    e.preventDefault();
    if (draggedAbilityId === null || draggedAbilityId === targetAbilityId) return;

    const draggedAbility = abilities.find(a => a.id === draggedAbilityId);
    const targetAbility = abilities.find(a => a.id === targetAbilityId);
    if (!draggedAbility || !targetAbility) return;

    if (draggedAbility.essenceId !== targetAbility.essenceId) {
      toast.error("Abilities must be kept within their assigned essence.");
      return;
    }

    const draggedIndex = groupAbilities.findIndex(a => a.id === draggedAbilityId);
    const targetIndex = groupAbilities.findIndex(a => a.id === targetAbilityId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const reordered = [...groupAbilities];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedItem);

    // Update sortOrder for all items in this group
    reordered.forEach((ab, idx) => {
      updateAbilityMut.mutate({
        id: ab.id,
        data: { sortOrder: idx }
      });
    });

    setDraggedAbilityId(null);
    toast.success("Abilities reordered.");
  };

  const handleFamAbDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedFamAbIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFamAbDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFamAbDrop = (e: React.DragEvent, fam: Familiar, targetIdx: number) => {
    e.preventDefault();
    if (draggedFamAbIdx === null || draggedFamAbIdx === targetIdx) return;
    const items = [...fam.abilities];
    const [draggedItem] = items.splice(draggedFamAbIdx, 1);
    items.splice(targetIdx, 0, draggedItem);

    updateFamiliarData(fam.id, { ...fam, abilities: items });
    setDraggedFamAbIdx(null);
    toast.success("Familiar abilities reordered.");
  };

  // Backup Imports
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const imported = importCharacterJSON(text);
        toast.success(`Character '${imported.name}' imported successfully!`);
        setLocation(`/characters/${imported.id}`);
      } catch (err) {
        toast.error("Invalid character sheet file format.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const sortAbilities = (list: Ability[]) => {
    return [...list].sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : a.id;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : b.id;
      return orderA - orderB;
    });
  };

  const activeFavorites = getFavorites(character, equipment, abilities);

  const preparedAbilities = [...abilities.filter(a => !a.definition && a.level && a.level > 0 && a.active), ...resolveTrackerEffects(abilities.filter(ability => ability.definition), character.rank, finalStats, { hp: hp ?? character.currentHp, maxHp, mana: mana ?? character.currentMana, maxMana, dt: currentDt ?? character.currentDt, maxDt }, character.triggerConfirmations ?? {}, character.familiars).filter(entry => !entry.familiar && entry.result?.target === "Self" && isEffectApplied(entry, "self", character.effectApplications ?? [])).map(entry => entry.effect)];
  const abilityResistances = preparedAbilities.map(a => a.resistances).filter(Boolean).join(", ");
  const abilityImmunities = preparedAbilities.map(a => a.immunities).filter(Boolean).join(", ");

  const baseResistances = character.resistances ? character.resistances.split(",").map(r => r.trim()).filter(Boolean) : [];
  const tempResistances = abilityResistances ? abilityResistances.split(",").map(r => r.trim()).filter(Boolean) : [];
  const baseImmunities = character.immunities ? character.immunities.split(",").map(r => r.trim()).filter(Boolean) : [];
  const tempImmunities = abilityImmunities ? abilityImmunities.split(",").map(r => r.trim()).filter(Boolean) : [];

  const hasAnyRes = baseResistances.length > 0 || tempResistances.length > 0;
  const hasAnyImm = baseImmunities.length > 0 || tempImmunities.length > 0;

  // Notes Search filter computation
  const filteredNotes = notes.filter(n => {
    const matchSearch = noteSearchQuery.trim() === "" || 
      n.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) || 
      n.content.toLowerCase().includes(noteSearchQuery.toLowerCase());
    const matchCat = noteCategoryFilter === "all" || n.category === noteCategoryFilter;
    return matchSearch && matchCat;
  });

  const latestHpLog = rolls?.filter(r => r.diceType === "hp-log").sort((a,b) => b.id - a.id)[0];
  const latestManaLog = rolls?.filter(r => r.diceType === "mana-log").sort((a,b) => b.id - a.id)[0];
  const latestDtLog = rolls?.filter(r => r.diceType === "dt-log").sort((a,b) => b.id - a.id)[0];
  const latestHpModifier = latestHpLog?.modifier ?? 0;
  const latestManaModifier = latestManaLog?.modifier ?? 0;
  const latestDtModifier = latestDtLog?.modifier ?? 0;

  const tier = critChain ? CRIT_TIERS[Math.min(critChain.chainCount, CRIT_TIERS.length - 1)] : null;
  const finalTier = lastRoll?.hadCrit ? CRIT_TIERS[Math.min(lastRoll.maxChainCount, CRIT_TIERS.length - 1)] : null;

  const diceReadout = (
              <div
                data-dice-readout="true" aria-label="Dice readout" role="region"
                className="dice-readout p-4 border-2 border-slate-700/60 rounded-md text-center flex flex-col items-center justify-center transition-all duration-500 bg-[#0c100e] shadow-[inset_0_0_15px_rgba(0,0,0,0.95)] relative group"
                style={
                  tier
                    ? { borderColor: tier.color + "88", boxShadow: `inset 0 0 15px rgba(0,0,0,0.95), 0 0 20px ${tier.color}33`, background: `${tier.color}05` }
                    : finalTier
                      ? { borderColor: finalTier.color + "55", boxShadow: `inset 0 0 15px rgba(0,0,0,0.95), 0 0 15px ${finalTier.color}22`, background: `${finalTier.color}03` }
                      : {}
                }
              >
                {/* LCD backlight overlay */}
                <div className="absolute inset-0 bg-emerald-500/[0.02] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none" />

                {rollingDice ? (
                  <Dice5 className="w-10 h-10 animate-spin text-emerald-400 opacity-75 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
                ) : critChain ? (
                  <div className="dice-screen-content animate-in zoom-in duration-200 w-full font-mono text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.4)] space-y-3">
                    <p className="text-[11px] uppercase tracking-[0.25em] mb-2 font-bold animate-pulse text-center" style={{ color: tier!.color }}>
                      ✦ {tier!.name} — Crit! ✦
                    </p>

                    <div className="text-sm font-semibold text-emerald-300/80 font-mono tracking-wide text-center">
                      {critChain.rolls.map(r => formatRollBreakdown(r.breakdown)).join(" + ")}
                      {critChain.modifier !== 0 && (critChain.modifier > 0 ? ` + ${critChain.modifier}` : ` - ${Math.abs(critChain.modifier)}`)}
                    </div>

                    <div className="text-5xl font-bold font-serif my-1 text-center" style={{ color: tier!.color }}>
                      {critChain.runningDiceTotal + critChain.modifier}
                    </div>

                    <div className="mt-3 text-center">
                      <button
                        onClick={handleChainRoll}
                        disabled={!!rollingDice}
                        className="px-5 py-1.5 rounded font-bold text-xs uppercase tracking-widest animate-pulse disabled:opacity-50 hover:scale-105 hover:animate-none transition-all cursor-pointer font-serif"
                        style={{
                          color: tier!.color,
                          border: `1px solid ${tier!.color}`,
                          boxShadow: `0 0 10px 2px ${tier!.color}22`,
                          background: tier!.color + "15",
                        }}
                      >
                        One More!
                      </button>
                    </div>
                  </div>
                ) : lastRoll ? (
                  <div className="dice-screen-content animate-in zoom-in duration-300 w-full font-mono text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.4)]">
                    {lastRoll.hadCrit ? (
                      <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: finalTier?.color ?? "#ffd700" }}>
                        ✦ {finalTier ? `${finalTier.name} Critical` : "Critical"} Hit! ✦
                      </p>
                    ) : (
                      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/60 mb-2 font-semibold">{lastRoll.label}</p>
                    )}
                    {lastRoll.rolls && lastRoll.rolls.length > 0 ? (
                      <div className="space-y-2 my-2 text-center">
                        <div className="text-sm font-semibold text-emerald-300/80 font-mono tracking-wide">
                          {lastRoll.rolls.map(r => formatRollBreakdown(r.breakdown)).join(" + ")}
                          {lastRoll.modifier !== 0 && (lastRoll.modifier > 0 ? ` + ${lastRoll.modifier}` : ` - ${Math.abs(lastRoll.modifier)}`)}
                        </div>
                      </div>
                    ) : lastRoll.diceType && (lastRoll.diceType.includes("(") || lastRoll.diceType.includes("+") || lastRoll.diceType.includes("-") || lastRoll.diceType.includes("*")) ? (
                      <div className="text-sm font-semibold text-emerald-300/90 mb-3 font-mono bg-emerald-950/30 py-1.5 px-3 border border-emerald-500/10 rounded inline-block max-w-[90%] mx-auto leading-normal">
                        {formatRollBreakdown(lastRoll.diceType)}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                        <div className="text-center">
                          <span className="text-[10px] text-emerald-500/50 block uppercase tracking-wider">Roll</span>
                          <span className="text-2xl font-semibold text-emerald-300">{lastRoll.rawRoll}</span>
                        </div>
                        {lastRoll.modifier !== 0 && (
                          <>
                            <span className="text-lg text-emerald-500/40 font-light mt-2">+</span>
                            <div className="text-center">
                              <span className="text-[10px] text-emerald-500/50 block uppercase tracking-wider">Mod</span>
                              <span className="text-2xl font-semibold text-emerald-400">{lastRoll.modifier}</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    <div className="h-px w-24 mx-auto my-2"
                      style={{ background: finalTier ? finalTier.color + "60" : "rgba(16,185,129,0.2)" }} />
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/50 block">Total</span>
                      <span className="text-6xl font-bold leading-none"
                        style={{ color: finalTier?.color ?? "rgb(52,211,153)" }}>
                        {lastRoll.total}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-emerald-500/70 text-xs font-mono tracking-widest animate-pulse uppercase">
                    THE DICE AWAIT...
                  </span>
                )}
              </div>
  );

  return (
    <WorkspaceProvider key={id} initial={character.uiPreferences?.layout} initialPresets={character.uiPreferences?.layoutPresets} initialDeletedPresetIds={character.uiPreferences?.deletedLayoutPresetIds} saving={updateChar.isPending} onSave={(layout, layoutPresets, done, deletedLayoutPresetIds) => updateChar.mutate({ id, data: { uiPreferences: { ...character.uiPreferences, layout, layoutPresets, deletedLayoutPresetIds } } }, { onSuccess: done, onError: error => toast.error(error.message) })}>
    <div className="w-full p-3 sm:p-4 max-w-[96rem] mx-auto animate-in fade-in duration-500 space-y-4">

      {/* ── Top Header Controls ── */}
      <div className="grimoire-card bg-card/45 backdrop-blur-md border border-border/40 rounded-lg shadow-sm w-full mb-4 shrink-0">
      <div className="p-3.5 flex items-center justify-between gap-2 overflow-x-auto whitespace-nowrap flex-nowrap">
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setLocation("/grimoire")} className="h-8 text-xs font-serif border border-border/50 hover:bg-accent/40 hover:text-foreground rounded-md cursor-pointer flex items-center gap-1.5 px-3 font-bold text-muted-foreground transition-all">
            <ArrowLeft className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Return to Grimoire</span>
            <span className="sm:hidden">Grimoire</span>
          </Button>
          <div className="h-4 w-px bg-border/30" />
          <CustomizeToolDialog />
          <div className="h-4 w-px bg-border/30" />
          <RollGuideDialog />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".soul,.json" className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs font-serif border border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all" title="Import Character">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Import Character</span>
            <span className="md:hidden">Import</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCharacterJSON(id)} className="h-8 text-xs font-serif border border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all" title="Export Character">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export Character</span>
            <span className="md:hidden">Export</span>
          </Button>

          <div className="h-4 w-px bg-border/30" />
          <EditCharacterDialog character={character} />
          <Button variant="destructive" size="icon" className="h-8 w-8 rounded-md cursor-pointer flex items-center justify-center transition-all" onClick={handleDelete} title="Delete Character">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      </div>
      <WorkspaceCanvas />
      <div className="workspace-source" hidden>
      {/* Resources occupy half the desktop workspace; tracker and dice each occupy a quarter. */}
      <div className="grimoire-workspace grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-start" style={{ "--workspace-panel-height": "clamp(26rem, 50dvh, 28rem)" } as React.CSSProperties}>

        {/* Character identity and resources share the wider left panel. */}
        <DockableTool id="resources"><div className="md:col-span-2 lg:col-span-2 min-w-0">
          <Card tabIndex={0} aria-label="Character resources" className="character-resource-card bg-card border-border/40 shadow-lg relative min-h-[var(--workspace-panel-height)] rounded-none">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10" />

            <CardContent className="resource-zone p-4 flex flex-col gap-3">
              <div className="space-y-3">
              {adjustedStats.warnings.map(warning => <p key={warning} role="alert" className="text-xs text-amber-400 border border-amber-500/40 rounded-md p-2">{warning}</p>)}
              {/* Profile HUD Header */}
              <div className="resource-profile space-y-2 border-b border-border/30 pb-2">
                {/* Single Row Layout: Identity (Left) | Speed (Right) */}
                <div className="flex justify-between items-center gap-3">
                  {/* Left: Portrait, Name, Rank & Race Badges */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="character-portrait relative group w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded-lg overflow-hidden border-2 border-primary/55 bg-background flex-shrink-0 flex items-center justify-center cursor-pointer">
                      {character.avatar ? (
                        <img src={character.avatar} alt={character.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-muted-foreground text-sm font-bold uppercase">{character.name.substring(0, 2)}</span>
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-bold cursor-pointer">
                        Change
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const dataUrl = await compressImage(file, 1200, 1200);
                                updateChar.mutate({ id, data: { avatar: dataUrl } }, {
                                  onSuccess: () => toast.success("Character portrait updated!")
                                });
                              } catch (err) {
                                toast.error("Failed to upload/compress image.");
                              }
                            }
                          }}
                        />
                      </label>
                    </div>

                    <div className="min-w-0">
                      <h1 className="text-3xl font-serif text-primary font-bold leading-tight truncate">
                        {character.name}
                      </h1>
                      {/* Metallic Rank & Race Badges */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shadow-sm ${getRankStyle(character.rank)}`}>
                          {character.rank || "Iron"} Rank
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono border-border/60 text-muted-foreground bg-background/50 rounded px-2 py-0.5">
                          {character.race}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Right: Speed Readout */}
                  <div className="text-right shrink-0 ml-auto">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Speed</div>
                    <div className="text-2xl font-serif text-foreground font-bold">{speed ?? character.speed} ft</div>
                  </div>
                </div>

                {/* Resistances & Immunities */}
                {(hasAnyRes || hasAnyImm) && (
                  <div className="flex flex-col gap-2 font-sans pt-1">
                    {hasAnyRes && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <strong className="text-[10px] font-bold text-foreground uppercase tracking-wider select-none mr-1">Resistances:</strong>
                        {baseResistances.map((res, idx) => (
                          <Badge key={`base-res-${idx}`} variant="outline" className="text-[9px] uppercase tracking-wider rounded-none font-semibold border-border/60 text-muted-foreground bg-background/50 h-5 px-2">
                            {res}
                          </Badge>
                        ))}
                        {tempResistances.map((res, idx) => (
                          <Badge key={`temp-res-${idx}`} variant="outline" className="text-[9px] uppercase tracking-wider rounded-none font-bold border-cyan-500/40 text-cyan-400 bg-cyan-950/20 shadow-[0_0_8px_rgba(34,211,238,0.35)] animate-pulse h-5 px-2">
                            {res}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {hasAnyImm && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <strong className="text-[10px] font-bold text-foreground uppercase tracking-wider select-none mr-1">Immunities:</strong>
                        {baseImmunities.map((imm, idx) => (
                          <Badge key={`base-imm-${idx}`} variant="outline" className="text-[9px] uppercase tracking-wider rounded-none font-semibold border-border/60 text-muted-foreground bg-background/50 h-5 px-2">
                            {imm}
                          </Badge>
                        ))}
                        {tempImmunities.map((imm, idx) => (
                          <Badge key={`temp-imm-${idx}`} variant="outline" className="text-[9px] uppercase tracking-wider rounded-none font-bold border-emerald-500/40 text-emerald-400 bg-emerald-950/20 shadow-[0_0_8px_rgba(52,211,153,0.35)] animate-pulse h-5 px-2">
                            {imm}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Resource Management HUD grids */}
              <CompactResources resources={[
                { name: "DT", current: currentDt ?? character.currentDt, max: baseMaxDt, barMax: maxDt, color: "#eab308", bonus: dtBuffBonus, temporary: character.tempDt, add: handleDtAdd, remove: handleDtRemoveDirect, temp: handleDtBuff },
                { name: "HP", current: hp ?? character.currentHp, max: baseMaxHp, barMax: maxHp, color: hp && hp > baseMaxHp ? "#f59e0b" : "hsl(var(--destructive))", bonus: hpBuffBonus, temporary: character.tempHp, add: handleHpAdd, remove: handleHpRemove, temp: handleHpBuff },
                { name: "MP", current: mana ?? character.currentMana, max: baseMaxMana, barMax: maxMana, color: mana && mana > baseMaxMana ? "#f59e0b" : "#3b82f6", bonus: manaBuffBonus, temporary: character.tempMana, add: handleManaAdd, remove: handleManaRemove, temp: handleManaBuff },
              ]} />
              <div className="resource-management grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">

                {/* 1. DT (Damage Threshold) - Ordered First */}
                <div className={`rounded-md border p-2 flex flex-col gap-2 min-w-0 transition-colors duration-200 ${
                  dtFlash === "hit" ? "border-destructive/70 bg-destructive/10"
                  : dtFlash === "restore" ? "border-primary/70 bg-primary/10"
                  : "border-border/40 bg-background/30"
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-yellow-500" /> Damage Threshold
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${
                      dtFlash === "hit" ? "text-destructive" 
                      : (currentDt ?? character.currentDt) > baseMaxDt ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" 
                      : "text-foreground"
                    }`}>
                      {!!character.tempDt && <span className="text-cyan-400 text-4xl font-mono font-bold mr-2" title="Temporary pool">{character.tempDt}</span>}<span className="resource-displayed-current" data-has-temporary={resourceDisplay(currentDt ?? character.currentDt, character.tempDt).hasTemporary || undefined}>{resourceDisplay(currentDt ?? character.currentDt, character.tempDt).total}</span>
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      /
                      <span>{baseMaxDt}</span>
                      {dtBuffBonus > 0 && (
                        <span 
                          className="text-[10px] text-amber-400 font-bold ml-1 font-mono drop-shadow-[0_0_5px_rgba(245,158,11,0.4)] cursor-help" 
                          title={`Temporary Buff: +${dtBuffBonus}`}
                        >
                          [+{dtBuffBonus}]
                        </span>
                      )}
                    </span>
                  </div>
                  <ResourceBar current={currentDt ?? character.currentDt} max={maxDt} color="#eab308" />

                  {/* dt quick actions: add/remove/buff */}
                  <div className="space-y-1 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtAdd} placeholder="Add val"
                        onChange={e => setDtAdd(e.target.value)}
                        className="h-6 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-6 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold btn-resource-add"
                        onClick={() => handleDtAdd()}>
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtRemove} placeholder="Dmg val"
                        onChange={e => { setDtRemove(e.target.value); setDamageResult(null); }}
                        className="h-6 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="destructive" size="sm" className="h-6 text-xs px-3 w-16 rounded-md cursor-pointer font-bold btn-resource-dmg"
                        onClick={() => handleDtRemoveDirect()}>
                        Dmg
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtBuff} placeholder="Temp val"
                        onChange={e => setDtBuff(e.target.value)}
                        className="h-6 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-6 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold btn-resource-buff"
                        onClick={() => handleDtBuff()}>
                        Temp
                      </Button>
                    </div>

                  </div>
                </div>

                {/* 2. HP (Health) - Ordered Second */}
                <div className="rounded-md border border-border/40 bg-background/30 p-2 flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Heart className="w-4 h-4 text-destructive" /> Health (HP)
                  </div>
                  <div className="text-center py-1">
                    {!!character.tempHp && <span className="text-cyan-400 text-4xl font-mono font-bold mr-2" title="Temporary pool">{character.tempHp}</span>}
                    <span className={`text-4xl font-mono font-bold ${hp && hp > baseMaxHp ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      <span className="resource-displayed-current" data-has-temporary={resourceDisplay(hp ?? character.currentHp, character.tempHp).hasTemporary || undefined}>{resourceDisplay(hp ?? character.currentHp, character.tempHp).total}</span>
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      /
                      <span>{baseMaxHp}</span>
                      {hpBuffBonus > 0 && (
                        <span 
                          className="text-[10px] text-amber-400 font-bold ml-1 font-mono drop-shadow-[0_0_5px_rgba(245,158,11,0.4)] cursor-help" 
                          title={`Temporary Buff: +${hpBuffBonus}`}
                        >
                          [+{hpBuffBonus}]
                        </span>
                      )}
                    </span>
                  </div>
                  <ResourceBar current={hp ?? character.currentHp} max={maxHp} color={hp && hp > baseMaxHp ? "#f59e0b" : "hsl(var(--destructive))"} />

                  {/* hp quick actions: add/remove/buff */}
                  <div className="space-y-1 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpAdd} placeholder="Heal val"
                        onChange={e => setHpAdd(e.target.value)}
                        className="h-6 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-6 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold btn-resource-add"
                        onClick={() => handleHpAdd()}>
                        Heal
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpRemove} placeholder="Dmg val"
                        onChange={e => setHpRemove(e.target.value)}
                        className="h-6 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="destructive" size="sm" className="h-6 text-xs px-3 w-16 rounded-md cursor-pointer font-bold btn-resource-dmg"
                        onClick={() => handleHpRemove()}>
                        Dmg
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpBuff} placeholder="Temp val"
                        onChange={e => setHpBuff(e.target.value)}
                        className="h-6 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-6 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold btn-resource-buff"
                        onClick={() => handleHpBuff()}>
                        Temp
                      </Button>
                    </div>

                  </div>
                </div>

                {/* 3. Mana (MP) - Ordered Third */}
                <div className="rounded-md border border-border/40 bg-background/30 p-2 flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-blue-400" /> Mana (MP)
                  </div>
                  <div className="text-center py-1">
                    {!!character.tempMana && <span className="text-cyan-400 text-4xl font-mono font-bold mr-2" title="Temporary pool">{character.tempMana}</span>}
                    <span className={`text-4xl font-mono font-bold ${mana && mana > baseMaxMana ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      <span className="resource-displayed-current" data-has-temporary={resourceDisplay(mana ?? character.currentMana, character.tempMana).hasTemporary || undefined}>{resourceDisplay(mana ?? character.currentMana, character.tempMana).total}</span>
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      /
                      <span>{baseMaxMana}</span>
                      {manaBuffBonus > 0 && (
                        <span 
                          className="text-[10px] text-cyan-400 font-bold ml-1 font-mono drop-shadow-[0_0_5px_rgba(34,211,238,0.4)] cursor-help" 
                          title={`Temporary Buff: +${manaBuffBonus}`}
                        >
                          [+{manaBuffBonus}]
                        </span>
                      )}
                    </span>
                  </div>
                  <ResourceBar current={mana ?? character.currentMana} max={maxMana} color={mana && mana > baseMaxMana ? "#f59e0b" : "#3b82f6"} />

                  {/* mana quick actions: add/remove/buff */}
                  <div className="space-y-1 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaAdd} placeholder="Add val"
                        onChange={e => setManaAdd(e.target.value)}
                        className="h-6 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-6 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold btn-resource-add"
                        onClick={() => handleManaAdd()}>
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaRemove} placeholder="Use val"
                        onChange={e => setManaRemove(e.target.value)}
                        className="h-6 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="destructive" size="sm" className="h-6 text-xs px-3 w-16 rounded-md cursor-pointer font-bold btn-resource-dmg"
                        onClick={() => handleManaRemove()}>
                        Use
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaBuff} placeholder="Temp val"
                        onChange={e => setManaBuff(e.target.value)}
                        className="h-6 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-6 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold btn-resource-buff"
                        onClick={() => handleManaBuff()}>
                        Temp
                      </Button>
                    </div>

                  </div>
                </div>

              </div>
              </div>
                  {/* Resource actions share the Combat footer baseline. */}
                  <div className="resource-actions shrink-0 flex items-center gap-2 border-t border-border/40 pt-3">
                    {/* Pulsing Red Damage Box */}
                    <div className="resource-damage-action flex items-center border border-red-500/60 bg-red-950/30 rounded-md shadow-[0_0_10px_rgba(239,68,68,0.25)] animate-border-red-pulse overflow-hidden h-8 shrink-0">
                      <Input
                        type="number"
                        min="0"
                        value={damageAmount}
                        onChange={e => setDamageAmount(e.target.value)}
                        placeholder="Damage"
                        className="h-full border-0 bg-transparent rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-xs font-mono text-center w-24 text-foreground placeholder:text-red-500/70 placeholder:font-serif placeholder:font-bold placeholder:uppercase placeholder:tracking-wider"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-full px-4 font-bold rounded-none bg-red-600 hover:bg-red-700 text-white font-serif border-l border-red-500/40 text-xs cursor-pointer"
                        onClick={handleApplyDamage}
                        disabled={!damageAmount || applyDamageMut.isPending}
                      >
                        Hit
                      </Button>
                    </div>

                    {/* Standalone Roll Initiative Button (NO numbers on button or anywhere else) */}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!rollingDice || !!critChain}
                      onClick={() => {
                        const existing = combatants.find(entry => entry.id === `character:${id}` || entry.name.trim().toLowerCase() === character.name.trim().toLowerCase());
                        if (existing && !window.confirm("Do you want to overwrite and re-roll your initiative?")) return;
                        handleRoll(diceLabels.agility, "Initiative Roll", finalStats.agility, autoModifiers.agility, undefined, "check", "agility", undefined, total => {
                        setCombatants(current => {
                          const next = upsertCharacterInitiative(current, currentTurnIdx, id, character.name, total);
                          setCurrentTurnIdx(next.turn);
                          return next.combatants;
                        });
                        });
                      }}
                      className="h-8 px-3 border-2 border-cyan-400 bg-cyan-950/90 text-cyan-200 hover:bg-cyan-900 hover:border-cyan-300 font-bold font-serif text-xs rounded-md cursor-pointer flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.45)] transition-all"
                      title="Roll Initiative (Agility Check)"
                      aria-label="Roll Initiative"
                    >
                      <Dice5 className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <span className="resource-init-full-label">Roll Initiative</span><span className="resource-init-compact-label">Roll Init</span>
                    </Button>

                    {/* Long Rest Confirmation Trigger */}
                    <div className="resource-rest-action ml-auto">
                    <Dialog open={isLongRestConfirmOpen} onOpenChange={setIsLongRestConfirmOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 font-bold font-serif rounded-md cursor-pointer text-xs">
                          Long Rest
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[400px] bg-card border border-border shadow-2xl rounded-md p-6">
                        <DialogHeader>
                          <DialogTitle className="font-serif text-xl text-amber-500 font-bold flex items-center gap-2">
                            <RotateCcw className="w-5 h-5" /> Confirm Long Rest?
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-3 text-xs text-muted-foreground leading-relaxed font-sans">
                          Return to your base state? Long Rest ends active abilities and temporary personal effects, resets charges, timers and trigger checks, and fully restores HP, DT and Mana. Innate always-on passives remain part of your base state. This is recorded in Dice History.
                        </div>
                        <div className="flex justify-end gap-3 pt-3 border-t border-border/30">
                          <Button variant="ghost" size="sm" onClick={() => setIsLongRestConfirmOpen(false)} className="rounded-md font-bold text-xs">
                            Cancel
                          </Button>
                          <Button variant="default" size="sm" onClick={handleLongRest} className="bg-amber-500 hover:bg-amber-600 text-black rounded-md font-bold text-xs">
                            Confirm Rest
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    </div>
                  </div>
            </CardContent>
          </Card>

        </div>

        </DockableTool>
        <TrackerPanel key={id} character={character} abilities={abilities} stats={finalStats}
          optionsPending={updateChar.isPending}
          onOptionsChange={(abilityOptions, onSaved) => updateChar.mutate({ id, data: { abilityOptions } }, { onSuccess: onSaved, onError: error => toast.error(error.message) })}
          onRestoreEffects={snapshot => updateChar.mutate({ id, data: { effectApplications: snapshot.applications, manualTrackedEffects: snapshot.manual, familiars: (character.familiars ?? []).map(familiar => { const saved = snapshot.familiars.find(entry => entry.id === familiar.id); return saved ? { ...familiar, effectApplications: saved.effectApplications ?? [] } : familiar; }) } }, { onSuccess: updated => { setHp(updated.currentHp); setMana(updated.currentMana); setCurrentDt(updated.currentDt); }, onError: error => toast.error(error.message) })}
          onLifetimeEvent={(event, combatant) => {
            const applications = character.effectApplications ?? [];
            const effectApplications = event === "combat" ? expireEffectApplications(applications, event) : applications.filter(application => !application.duration?.startsWith("Until Next Turn") || !(application.targetId === combatant?.id || application.targetId === "self" && combatant?.name === character.name));
            const familiars = (character.familiars ?? []).map(familiar => event === "combat" || familiar.name === combatant?.name ? { ...familiar, effectApplications: expireEffectApplications(familiar.effectApplications ?? [], event) } : familiar);
            const label = event === "combat" ? "Until Combat Ends" : "Until Next Turn";
            const manualTrackedEffects = (character.manualTrackedEffects ?? []).filter(effect => !effect.duration?.startsWith(label) || event === "turn" && effect.targetId !== combatant?.id);
            updateChar.mutate({ id, data: { effectApplications, familiars, manualTrackedEffects } }, { onSuccess: updated => { setHp(updated.currentHp); setMana(updated.currentMana); setCurrentDt(updated.currentDt); } });
          }}
          vitals={{ hp: hp ?? character.currentHp, mana: mana ?? character.currentMana, dt: currentDt ?? character.currentDt, maxHp, maxMana, maxDt }}
          combatants={combatants} turn={currentTurnIdx}
          onCombatantsChange={setCombatants} onTurnChange={setCurrentTurnIdx}
          onApplicationsChange={changeAbilityApplications}
          onManualEffectsChange={manualTrackedEffects => updateChar.mutate({ id, data: { manualTrackedEffects } }, { onError: error => toast.error(error.message) })}
          onConfirmationsChange={triggerConfirmations => updateChar.mutate({ id, data: { triggerConfirmations } }, { onError: error => toast.error(error.message) })}
          onRoll={handleAbilityResultRoll}
          onInspect={(abilityId, familiarId) => {
            if (familiarId !== undefined) {
              (setActiveTab("familiar"), revealWorkspaceTool("familiar"));
              setExpandedFamiliars(previous => ({ ...previous, [familiarId]: true }));
              scrollToElement(`fam-ability-card-${familiarId}-${abilityId}`);
              return;
            }
            const source = abilities.find(ability => ability.id === abilityId);
            if (source?.equipmentId || source?.inventoryItemId) {
              (setActiveTab("inventory"), revealWorkspaceTool("inventory"));
              scrollToElement(source.equipmentId ? `equipment-card-${source.equipmentId}` : `inventory-card-${source.inventoryItemId}`);
              return;
            }
            (setActiveTab("abilities"), revealWorkspaceTool("abilities")); setExpandedAbilities(previous => ({ ...previous, [abilityId]: true })); scrollToElement(`ability-card-${abilityId}`);
          }}
          combatantSources={[character.name, ...(character.familiars ?? []).map(familiar => familiar.name), ...notes.filter(note => note.category === "bestiary").map(note => note.title)]}
          recentCombatants={recentCombatants}
          onRememberCombatant={combatant => setRecentCombatants(previous => [combatant, ...previous.filter(entry => entry.name !== combatant.name)].slice(0, 10))}
        />

        {/* Dice remains the rightmost desktop column across tracker tabs. */}
        <div className="min-w-0 lg:col-span-1 h-[var(--workspace-panel-height)]">
          <Card tabIndex={0} aria-label="Character dice" className="workspace-scroll bg-card border-border/40 shadow-lg relative h-full max-h-full overflow-hidden rounded-none">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            <CardContent className="dice-zone p-4 h-full min-h-0 flex flex-col gap-3">

              <div className="flex flex-col gap-3 flex-1 min-h-0">
                <div className="workspace-scroll flex-1 min-h-0 overflow-y-auto">
                {/* Stats tab */}
                <DockableTool id="stats">
                  <DiceToolLayout>
                    <div className="stat-inputs grid grid-cols-4 gap-1.5">
                      {STATS.map(stat => {
                        const value = finalStats[stat.key];
                        const mod = autoModifiers[stat.key];
                        const dice = diceLabels[stat.key];
                        const isRolling = rollingDice === `${stat.label} Roll`;
                        return (
                          <button
                            key={stat.key}
                            onClick={() => handleStatRoll(stat.key, stat.label)}
                            disabled={!!rollingDice}
                            title={`${stat.key.charAt(0).toUpperCase() + stat.key.slice(1)} — ${dice}`}
                            className={`rounded-none p-1 text-center border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              isRolling ? "border-primary bg-primary/10 animate-pulse"
                              : "border-border/40 hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                            }`}
                          >
                            <div className="stat-input-label font-bold text-muted-foreground uppercase tracking-wide">{stat.label}</div>
                            <div className="text-xl font-serif text-foreground leading-tight">{value}</div>
                            <div className="text-[10px] font-mono text-primary">+{mod}</div>
                            <div className="text-[8px] font-mono text-muted-foreground/60">{dice}</div>
                          </button>
                        );
                      })}
                    </div>
                    {diceReadout}
                  </DiceToolLayout>
                </DockableTool>

                {/* Dice tab */}
                <DockableTool id="dice">
                  <DiceToolLayout>
                  <div className="dice-inputs space-y-2">
                    <div className="dice-buttons grid grid-cols-4 gap-1">
                      {(["d4","d6","d8","d10","d12","d20","d100"] as const).map(d => (
                        <DieButton
                          key={d}
                          die={d}
                          rolling={rollingDice === customRollTitle(d)}
                          disabled={!!rollingDice}
                          onClick={() => handleRoll(d, customRollTitle(d), undefined, 0)}
                        />
                      ))}
                    </div>

                    <div className="space-y-1.5 border-t border-border/10 pt-2.5">
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-left">Custom Formula</div>
                      <div className="flex gap-2">
                        <Input
                          value={customFormula}
                          onChange={e => setCustomFormula(e.target.value)}
                          placeholder="e.g. 2d6 + POWr*3"
                          className="bg-background/50 border-border/50 text-xs h-7 flex-1 rounded-none font-mono"
                        />
                        <Button
                          size="sm"
                          onClick={handleCustomFormulaRoll}
                          disabled={!customFormula.trim() || !!rollingDice}
                          className="h-7 text-xs font-serif rounded-none px-3 bg-primary text-primary-foreground cursor-pointer"
                        >
                          Roll
                        </Button>
                      </div>
                    </div>
                  </div>

                  {diceReadout}
                  </DiceToolLayout>
                </DockableTool>

                {/* History tab */}
                <DockableTool id="history">
                  <div className="history-layout">
                    {loadingRolls ? (
                      <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                    ) : rolls && rolls.length > 0 ? (
                      <HistoryList>
                        {rolls.map(roll => (
                          <div key={roll.id} data-roll-id={roll.id} className="history-entry flex justify-between items-center hover:bg-accent/10 transition-colors">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs text-foreground flex items-center gap-1" title={roll.label || roll.diceType}>
                                <span className="truncate">{roll.label || "Roll"}</span>
                                {roll.isCrit && <span className="text-[8px] font-bold text-yellow-500 uppercase tracking-widest">crit</span>}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono truncate" title={`${formatRollBreakdown(roll.diceType)}${roll.modifier ? ` + ${roll.modifier}` : ""}`}>
                                {roll.diceType === "action-log" ? "Ability action" : roll.diceType === "hp-log" ? "Health change" : roll.diceType === "dt-log" ? "DT change" : roll.diceType === "mana-log" ? "Mana change" : formatRollBreakdown(roll.diceType)}{roll.modifier ? (roll.modifier > 0 ? ` + ${roll.modifier}` : ` - ${Math.abs(roll.modifier)}`) : ""}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`text-base font-serif font-bold ${roll.isCrit ? "text-yellow-500 animate-pulse" : "text-primary"}`}>{roll.diceType === "action-log" ? "—" : ["hp-log", "dt-log", "mana-log"].includes(roll.diceType) && roll.total > 0 ? `+${roll.total}` : roll.total}</div>
                              <div className="text-[8px] text-muted-foreground/45 font-mono">{format(new Date(roll.rolledAt), "MMM d, HH:mm")}</div>
                            </div>
                          </div>
                        ))}
                      </HistoryList>
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground font-serif italic">No activity recorded yet.</div>
                    )}
                  </div>
                </DockableTool>
              </div>

              </div>

            </CardContent>
          </Card>
        </div>

      </div>

      {/* ── Custom Favorites Hotbar ── */}
      <DockableTool id="favorites"><div className="favorites-belt mt-3 w-full">
        <Card className="favorites-frame bg-card/75 border-border/40 p-4 rounded-lg shadow-md">
          {/* Uniform slots adapt to the card interior; paging preserves every assignment. */}
          <FavoritesGrid heading={<h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" /><span className="truncate" title="Favorites Hotbar">Favorites Hotbar</span>
          </h3>}>
            {activeFavorites.map((fav, index) => {
              if (fav) {
                const details = getSlotDetails(fav);
                const favoriteFamiliar = fav.type === "familiar-ability" ? character.familiars?.find(familiar => familiar.id === fav.familiarId) : undefined;
                const targetAb = favoriteFamiliar ? favoriteFamiliar.abilities.find(ability => ability.id === Number(fav.targetId)) as Ability | undefined : (fav.type === "ability" || fav.type === "sub-ability") ? abilities.find(a => a.id === Number(fav.targetId)) : null;
                const favoriteValues = favoriteFamiliar ? getFamiliarAdjusted(favoriteFamiliar) : undefined;
                const favoriteContext = favoriteFamiliar && favoriteValues ? { hp: favoriteFamiliar.currentHp, maxHp: favoriteValues.maxHp, mana: favoriteFamiliar.currentMana, maxMana: favoriteValues.maxMana, dt: favoriteFamiliar.currentDt, maxDt: favoriteValues.maxDt } : { hp: hp ?? character.currentHp, maxHp, mana: mana ?? character.currentMana, maxMana, dt: currentDt ?? character.currentDt, maxDt };
                const favoriteParent = targetAb?.definition ? resolveTrackerEffects([targetAb], favoriteFamiliar?.className ?? character.rank, favoriteValues?.stats ?? finalStats, favoriteContext, favoriteFamiliar?.triggerConfirmations ?? character.triggerConfirmations ?? {}, favoriteFamiliar ? [] : character.familiars).find(entry => !entry.result && entry.input?.id === (fav.type === "sub-ability" ? fav.subId : targetAb.definition!.id)) : undefined;
                const isToggleable = favoriteParent ? !["Instant", "When Triggered", "Always On"].includes(favoriteParent.input!.durationType) : targetAb ? hasStatModifiers(targetAb) : false;
                const isSlotActive = favoriteFamiliar && targetAb ? ownedAbilityActive(targetAb, favoriteFamiliar) : favoriteParent ? isEffectApplied(favoriteParent, "self", character.effectApplications ?? []) : targetAb ? !!targetAb.active : false;

                return (
                  <div 
                    key={index} 
                    onClick={() => handleExecuteFavorite(fav)}
                    className={`min-h-[72px] transition-all relative flex flex-col justify-between cursor-pointer p-2 rounded-md group shadow-sm ${
                      isSlotActive 
                        ? "bg-primary/20 border-2 border-primary shadow-md shadow-primary/30 ring-1 ring-primary/50" 
                        : "bg-background/60 hover:bg-accent/40 border border-primary/45 hover:border-primary"
                    }`}
                    title={`Favorite #${index + 1}: ${fav.label}${isToggleable ? (isSlotActive ? " (ACTIVE)" : " (INACTIVE)") : ""}`}
                  >
                    {/* Actions Panel */}
                    <div className="favorite-slot-actions absolute top-1 right-1 flex gap-1 z-10">
                      <button
                        onClick={(e) => handleLocateFavorite(fav, e)}
                        className="h-4 w-4 bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center rounded border border-border cursor-pointer"
                        title="Locate in tab"
                        aria-label={`Go to ${details.name}`}
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={(e) => handleClearFavorite(index, e)}
                        className="h-4 w-4 bg-destructive hover:bg-destructive/95 text-white flex items-center justify-center rounded border border-border cursor-pointer"
                        title="Remove from favorites"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Header slot ID + Type badge or Active/Inactive blurb */}
                    <div className="favorite-slot-header flex justify-between items-center w-full pr-8">
                      <span className="text-[8px] font-mono text-muted-foreground/75 font-semibold">#{index + 1}</span>
                      {isToggleable ? (
                        <span className={`text-[7px] font-mono uppercase tracking-wider border px-1 py-0.25 rounded font-black ${
                          isSlotActive
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background/80 text-muted-foreground border-border/50"
                        }`}>
                          {isSlotActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      ) : (
                        <span className="text-[7px] font-mono font-bold uppercase tracking-wider text-primary border border-primary/20 px-1 py-0.25 rounded bg-primary/5">
                          {fav.type === "weapon" ? "Weapon" : fav.type === "ability" ? "Ability" : fav.type === "ability-result" ? "Result" : fav.type === "sub-ability" ? "Sub-Ability" : fav.type === "skill" ? "Skill" : fav.type === "familiar-ability" ? "Fam Ab" : fav.type === "familiar-attribute" ? "Fam Stat" : "Stat"}
                        </span>
                      )}
                    </div>

                    {/* Name Row */}
                    <div className="favorite-slot-name text-[10px] font-bold text-foreground truncate max-w-full leading-tight font-serif text-left mt-1" title={details.name}>
                      {details.name}
                    </div>

                    {/* Footer Cost + Stat */}
                    <div className="favorite-slot-cost flex justify-between items-center w-full mt-1 border-t border-border/20 pt-1 text-[8px] font-mono">
                      <span className="text-muted-foreground">{details.costStr || "-"}</span>
                      <span className="text-primary font-bold">{details.statStr || "-"}</span>
                    </div>
                  </div>
                );
              } else {
                return (
                  <button
                    key={index}
                    onClick={() => setAssigningSlotIndex(index)}
                    className="min-h-[72px] bg-background/20 hover:bg-accent/30 border border-dashed border-border/50 hover:border-primary/50 transition-all flex flex-col items-center justify-center cursor-pointer text-muted-foreground hover:text-primary rounded-md p-2 text-center text-xs gap-1 shadow-sm"
                    title={`Click to assign Favorite #${index + 1}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-[8px] font-mono">Assign #{index + 1}</span>
                  </button>
                );
              }
            })}
          </FavoritesGrid>

          <Dialog open={familiarRollPicker !== null} onOpenChange={open => { if (!open) setFamiliarRollPicker(null); }}><DialogContent><DialogHeader><DialogTitle>Choose target roll</DialogTitle></DialogHeader><div className="space-y-2">{familiarRollPicker && (() => {
            const familiar = character.familiars?.find(entry => entry.id === familiarRollPicker.familiarId); const ability = familiar?.abilities.find(entry => entry.id === familiarRollPicker.abilityId);
            if (!familiar || !ability?.definition) return null;
            const values = getFamiliarAdjusted(familiar); const entries = resolveTrackerEffects([familiarAbilityAsAbility(ability)], familiar.className, values.stats, { hp: familiar.currentHp, maxHp: values.maxHp, mana: familiar.currentMana, maxMana: values.maxMana, dt: familiar.currentDt, maxDt: values.maxDt }, familiar.triggerConfirmations ?? {});
            return favoriteRollChoices(entries, ability.id, familiarRollPicker.inputId).map(entry => <Button key={entry.effect.id} className="w-full justify-between" variant="outline" onClick={() => { setFamiliarRollPicker(null); handleFamiliarAbilityRoll(familiar, ability, entry.input?.id, entry.effect.id); }}><span>{entry.input?.name}</span><span>{entry.result?.target}</span></Button>);
          })()}</div></DialogContent></Dialog>
          <Dialog open={favoriteRollPicker !== null} onOpenChange={open => { if (!open) setFavoriteRollPicker(null); }}>
            <DialogContent className="sm:max-w-[500px] bg-card border-border">
              <DialogHeader><DialogTitle>Choose target roll</DialogTitle></DialogHeader>
              <div className="space-y-2">{favoriteRollPicker && (() => {
                const ability = abilities.find(entry => entry.id === favoriteRollPicker.abilityId);
                if (!ability) return <p className="text-sm">Ability no longer exists.</p>;
                const entries = resolveTrackerEffects([ability], character.rank, finalStats, { hp: hp ?? character.currentHp, maxHp, mana: mana ?? character.currentMana, maxMana, dt: currentDt ?? character.currentDt, maxDt }, character.triggerConfirmations ?? {}, character.familiars);
                return favoriteRollChoices(entries, ability.id, favoriteRollPicker.inputId).map(entry => <Button key={entry.effect.id} className="w-full justify-between" variant="outline" onClick={() => { setFavoriteRollPicker(null); executeFavoriteResult(entry); }}><span>{entry.input?.name}</span><span className="text-xs">{entry.targetLabels?.join(", ")} · {entry.effect.rollFormula}</span></Button>);
              })()}</div>
            </DialogContent>
          </Dialog>

          {/* Favorite Assignment Selection Modal */}
          <Dialog open={assigningSlotIndex !== null} onOpenChange={(open) => { if(!open) setAssigningSlotIndex(null); }}>
            <DialogContent className="sm:max-w-[500px] max-h-[75vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none">
              <DialogHeader className="border-b border-border/30 pb-2">
                <DialogTitle className="font-serif text-2xl text-primary font-bold">
                  Assign Favorite Slot #{assigningSlotIndex !== null ? assigningSlotIndex + 1 : ""}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4 text-xs font-sans">

                {/* Attributes */}
                <div>
                  <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Attributes</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {STATS.map(stat => (
                      <Button 
                        key={stat.key} variant="outline" size="sm" className="h-6 text-[10px] font-mono rounded-none"
                        onClick={() => handleAssignFavorite(assigningSlotIndex!, "attribute", stat.key, stat.label)}
                      >
                        {stat.label} (+{autoModifiers[stat.key]})
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Items (Gear, Potions & Inventory) */}
                {(equipment.length > 0 || inventory.length > 0) && (
                  <div>
                    <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Items (Gear, Potions & Inventory)</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Equipment (Weapons / Armor / Gear) */}
                      {equipment.map(eq => (
                        <Button 
                          key={`eq-${eq.id}`} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif"
                          onClick={() => handleAssignFavorite(assigningSlotIndex!, "item", eq.id, eq.name)}
                        >
                          {eq.name} {eq.equipped ? "[Equipped]" : ""} {eq.diceType ? `(${eq.diceType})` : ""}
                        </Button>
                      ))}
                      {/* General Inventory Items (Potions / Consumables) */}
                      {inventory.map(item => (
                        <Button 
                          key={`inv-${item.id}`} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                          onClick={() => handleAssignFavorite(assigningSlotIndex!, "item", item.id, item.name)}
                        >
                          📦 {item.name} (x{item.quantity})
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shaped Spells */}
                {abilities.filter(ab => !ab.equipmentId && !ab.inventoryItemId).length > 0 && (
                  <div>
                    <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Shaped Spells</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {abilities.filter(ab => !ab.equipmentId && !ab.inventoryItemId).map(ab => (
                        <Button 
                          key={ab.id} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif"
                          onClick={() => handleAssignFavorite(assigningSlotIndex!, "ability", ab.id, ab.name)}
                        >
                          {ab.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">{abilities.flatMap(ability => ability.definition ? flattenInputs(ability.definition).flatMap(node => node.results.filter(result => node.targets.includes(result.target) && result.formula).map(result => <Button key={`${ability.id}:${result.id}`} size="sm" variant="outline" onClick={() => handleAssignFavorite(assigningSlotIndex!, "ability-result", ability.id, node.name, undefined, result.id)}>{node.name} · {result.target}</Button>)) : [])}</div>
                {/* Item Abilities (Gear & Potion Abilities) */}
                {abilities.filter(ab => ab.equipmentId || ab.inventoryItemId).length > 0 && (
                  <div>
                    <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Item Abilities</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {abilities.filter(ab => ab.equipmentId || ab.inventoryItemId).map(ab => {
                        const eq = ab.equipmentId ? equipment.find(e => e.id === ab.equipmentId) : null;
                        const invItem = ab.inventoryItemId ? inventory.find(i => i.id === ab.inventoryItemId) : null;
                        const parentName = eq ? eq.name : invItem ? invItem.name : null;
                        const displayName = parentName ? `${parentName}: ${ab.name}` : ab.name;
                        return (
                          <Button 
                            key={ab.id} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif border-amber-500/30 text-amber-400"
                            onClick={() => handleAssignFavorite(assigningSlotIndex!, "ability", ab.id, displayName)}
                          >
                            ✨ {displayName}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Skills */}
                {skills.length > 0 && (
                  <div>
                    <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Custom Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {skills.map(sk => (
                        <Button 
                          key={sk.id} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif"
                          onClick={() => handleAssignFavorite(assigningSlotIndex!, "skill", sk.id, sk.name)}
                        >
                          {sk.name} (-{sk.value})
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Familiar Options (Multiple Companions) */}
                {character.familiars && character.familiars.length > 0 && (
                  <div className="space-y-4 pt-2 border-t border-border/20">
                    <h4 className="font-bold text-primary uppercase tracking-widest text-[10px]">Companion Familiars</h4>
                    {character.familiars.map(fam => (
                      <div key={fam.id} className="space-y-3 bg-background/40 p-2.5 rounded-md border border-border/30">
                        <h5 className="font-serif font-bold text-xs text-primary">{fam.name} ({fam.race})</h5>
                        <div>
                          <h6 className="font-bold text-[9px] text-muted-foreground uppercase block mb-1">Attributes</h6>
                          <div className="flex flex-wrap gap-1">
                            {STATS.map(stat => {
                              const val = (fam as any)[stat.key] as number;
                              return (
                                <Button 
                                  key={stat.key} variant="outline" size="sm" className="h-6 text-[9px] rounded-md font-mono"
                                  onClick={() => handleAssignFavorite(assigningSlotIndex!, "familiar-attribute", stat.key, `${fam.name}:${stat.label}`, fam.id)}
                                >
                                  {stat.label} (+{Math.floor(val/3)})
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                        {fam.abilities && fam.abilities.length > 0 && (
                          <div>
                            <h6 className="font-bold text-[9px] text-muted-foreground uppercase block mb-1">Abilities</h6>
                            <div className="flex flex-wrap gap-1">
                              {fam.abilities.map(ab => (
                                <Button 
                                  key={ab.id} variant="outline" size="sm" className="h-6 text-[9px] rounded-md font-serif"
                                  onClick={() => handleAssignFavorite(assigningSlotIndex!, "familiar-ability", ab.id, `${fam.name}:${ab.name}`, fam.id)}
                                >
                                  {ab.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </DialogContent>
          </Dialog>
        </Card>
      </div></DockableTool>

      {/* ── ACTIVE TOOL SCREEN AREA ── */}
      <div className="mt-4 animate-in fade-in duration-300">
        <DockableTool id="settings"><section className="max-w-2xl border border-border/40 bg-card p-4 space-y-4">
          <h3 className="text-xl text-primary">Settings</h3>
          <AbilityOptionsFields skillNames={skills.map(skill => skill.name)} options={character.abilityOptions ?? mergeOptions(...(abilities ?? []).map(ability => ability.definition?.options))} onChange={abilityOptions => updateChar.mutate({ id, data: { abilityOptions } }, { onError: error => toast.error(error.message) })}/>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={autoScrollRolls} disabled={updateChar.isPending} onChange={event => updateChar.mutate({ id, data: { uiPreferences: { ...character.uiPreferences, autoScrollRolls: event.target.checked } } }, { onError: error => toast.error(error.message) })}/>
            <span><span className="block text-sm font-semibold">Auto-scroll to dice results</span><span className="block text-sm text-muted-foreground mt-1">Show the dice result automatically when rolling, including familiar rolls. Turning this off keeps your current page position.</span></span>
          </label>
          <p className="text-xs text-muted-foreground">Saved for this character. Favorites’ Take to action still navigates and scrolls to the selected entry.</p>
        </section></DockableTool>

        <DockableTool id="attributes">
          <div className="attribute-stat-section space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <Hammer className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Attributes & Training</h3>
                </div>
              </div>
            </div>
            <div className="attribute-stat-grid">
            {STATS.map(stat => {
              const baseValue = (character as any)[stat.key] as number;
              const trainingKey = `${stat.key}Training`;
              const curTraining = (character as any)[trainingKey] as number;
              const fullName = stat.key.charAt(0).toUpperCase() + stat.key.slice(1);

              return (
                <Card 
                  id={`stat-card-${stat.key}`} 
                  key={stat.key} 
                  onClick={() => handleStatRoll(stat.key, stat.label)}
                  className="attribute-stat-card bg-card border-border/50 hover:border-primary/60 transition-all cursor-pointer shadow-sm flex flex-col justify-between rounded-none group"
                >
                  <CardContent className="attribute-stat-content">
                    <div className="attribute-stat-heading">
                      <h4 className="attribute-stat-name font-serif font-extrabold text-foreground group-hover:text-primary transition-colors capitalize">{fullName}</h4>
                      <Badge variant="outline" className="attribute-stat-die font-mono text-[10px] border-primary/30 text-primary bg-background/45 rounded-none h-5 px-1 py-0">
                        {getDiceLabel(baseValue)}
                      </Badge>
                    </div>

                    <div className="attribute-stat-value-row">
                      <div className="flex items-baseline gap-1 whitespace-nowrap">
                        <span className="text-3xl font-serif font-bold text-primary">{baseValue}</span>
                        <span className="text-[11px] font-mono text-primary/80 font-bold">
                          +{autoModifiers[stat.key]}
                        </span>
                      </div>
                      <span className="attribute-stat-roll font-mono text-muted-foreground/60 flex items-center gap-1 group-hover:text-primary transition-colors">
                        <Dice5 className="w-3.5 h-3.5" /> Roll
                      </span>
                    </div>

                    {/* Stat training tracker */}
                    <div 
                      className="stat-training border-t border-border/20 pt-2 flex flex-col gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="stat-training-heading font-mono">
                        <span className="stat-training-label text-muted-foreground uppercase">Training Points</span>
                        <span className="stat-training-count text-primary font-bold">{curTraining}/{baseValue}</span>
                      </div>
                      <div className="stat-training-controls">
                        <div className="stat-training-progress bg-accent/40 h-1 rounded-none overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-none transition-all"
                            style={{ width: `${Math.min(100, (curTraining / baseValue) * 100)}%` }}
                          />
                        </div>

                        {/* +/- Increment/Decrement group */}
                        <div className="stat-training-buttons flex border border-border/50">
                          <button
                            type="button"
                            aria-label={`Decrease ${fullName} training`}
                            className="h-5 w-5 text-xs font-bold bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatTrain(stat.key, "down");
                            }}
                            disabled={baseValue <= 0 && curTraining === 0}
                          >
                            -
                          </button>
                          <div className="h-5 w-[1px] bg-border/50" />
                          <button
                            type="button"
                            aria-label={`Increase ${fullName} training`}
                            className="h-5 w-5 text-xs font-bold bg-background/50 hover:bg-accent text-primary hover:text-primary-foreground cursor-pointer flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatTrain(stat.key, "up");
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ESSENCE IMBUEMENT — part of Stats and Essence */}

          <div className="space-y-4 mt-8">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Essence Imbuement</h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(slot => {
                const essence = essences.find(e => e.slot === slot);
                const label = slot === 1 ? "First Essence" : slot === 2 ? "Second Essence" : slot === 3 ? "Third Essence" : "Confluence";
                const essenceRow = wideRows ? essences.filter(entry => [1, 2, 3, 4].includes(entry.slot)) : essence ? [essence] : [];
                const isExpanded = essenceRow.some(entry => expandedEssences[entry.id]);

                return (
                  <Card key={slot} className={`bg-card border-border/50 relative overflow-hidden flex flex-col justify-between rounded-none ${
                    slot === 4 ? "border-amber-500/30 bg-amber-500/[0.02]" : ""
                  }`}>
                    {slot === 4 && (
                      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                    )}

                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] uppercase tracking-widest font-mono text-muted-foreground font-bold">
                          {label}
                        </span>
                        {essence && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive rounded-none cursor-pointer" onClick={(e) => { e.stopPropagation(); deleteEssence.mutate({ id: essence.id, charId: id }); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>

                      {essence ? (
                        <div
                          className="space-y-1.5 cursor-pointer select-none"
                          onClick={() => setExpandedEssences(prev => {
                            const open = !essenceRow.some(entry => prev[entry.id]);
                            return { ...prev, ...Object.fromEntries(essenceRow.map(entry => [entry.id, open])) };
                          })}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <h4 className={`font-serif text-lg font-bold leading-tight ${slot === 4 ? "text-amber-400" : "text-foreground"}`}>{essence.name}</h4>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground/60 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                          <div
                            className={`text-xs text-muted-foreground/80 font-serif leading-relaxed ${isExpanded ? "whitespace-pre-wrap animate-in slide-in-from-top-1 duration-150" : "line-clamp-3"}`}
                            dangerouslySetInnerHTML={{ __html: parseMarkdown(essence.description || "*No description.*") }}
                          />
                        </div>
                      ) : slot === 4 ? (
                        <div className="py-4 text-center">
                          <Button
                            size="sm"
                            className="bg-amber-500/20 border border-amber-500/30 text-amber-500 hover:bg-amber-500/30 h-7 text-xs font-serif rounded-none cursor-pointer font-bold transition-all"
                            onClick={() => setEssenceSlotInput(slot)}
                          >
                            + Unleash Confluence
                          </Button>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <Button
                            size="sm"
                            className="bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 h-7 text-xs font-serif rounded-none cursor-pointer"
                            onClick={() => setEssenceSlotInput(slot)}
                          >
                            + Add Essence
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {essenceSlotInput !== null && (
              <Card className="bg-card border-primary/20 mt-4 max-w-lg animate-in slide-in-from-top-4 duration-300 rounded-none">
                <CardContent className="p-4 space-y-4">
                  <h4 className="font-serif text-lg text-primary font-bold">Attune Essence ({essenceSlotInput === 4 ? "Confluence" : `Slot ${essenceSlotInput}`})</h4>
                  <form onSubmit={handleSaveEssence} className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Essence Name</label>
                      <Input value={essenceName} onChange={e => setEssenceName(e.target.value)} required placeholder="e.g. Fire, Earth, Sky" className="bg-background text-sm rounded-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description</label>
                      <Textarea value={essenceDesc} onChange={e => setEssenceDesc(e.target.value)} placeholder="Description of attunements..." className="bg-background text-sm font-serif rounded-none" />
                    </div>
                    <div className="flex justify-end gap-1.5 pt-2 border-t border-border/30">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEssenceSlotInput(null)} className="rounded-none">Cancel</Button>
                      <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-serif rounded-none">Apply Essence</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </DockableTool>

        {/* TAB 2: SKILLS (Card click rolls) */}
        <DockableTool id="skills">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <BookText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Skills</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Roll skills and train modifiers</p>
                </div>
              </div>
              <EditSkillsDialog characterId={id} />
            </div>

            {skills && skills.length > 0 ? (
              (() => {
                const groups: Record<string, Skill[]> = {};
                skills.forEach(skill => {
                  const cat = skill.category?.trim() || "General Skills";
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(skill);
                });

                const sortedCategories = Object.keys(groups).sort((a, b) => {
                  if (a === "General Skills") return 1;
                  if (b === "General Skills") return -1;
                  return a.localeCompare(b);
                });

                return (
                  <div className="space-y-3">
                    {sortedCategories.map(cat => {
                      const catSkills = groups[cat].sort((a, b) => a.name.localeCompare(b.name));
                      const isExpanded = !!expandedCategories[cat];
                      return (
                        <div key={cat} className="border border-border/40 bg-card/10 overflow-hidden">
                          {/* Collapsible Header */}
                          <button
                            onClick={() => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))}
                            className="w-full flex items-center justify-between p-3 bg-card/45 hover:bg-card/75 transition-colors border-b border-border/20 text-left font-serif font-bold text-foreground text-xs cursor-pointer"
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-primary text-[13px]">{isExpanded ? "📂" : "📁"}</span>
                              <span>{cat}</span>
                              <Badge variant="secondary" className="font-mono text-[9px] bg-primary/10 border-0 text-primary py-0.5 px-1.5 rounded-none font-semibold">
                                {catSkills.length}
                              </Badge>
                            </span>
                            <span>
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
                              )}
                            </span>
                          </button>

                          {/* Category content */}
                          {isExpanded && (
                            <div className="p-3 bg-background/25 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in slide-in-from-top-1 duration-150">
                              {catSkills.map(skill => (
                                <Card 
                                  id={`skill-card-${skill.id}`}
                                  key={skill.id} 
                                  onClick={() => handleSkillRoll(skill)}
                                  className="bg-card border-border/50 hover:border-primary/60 transition-all cursor-pointer rounded-none flex flex-col justify-between group"
                                >
                                  <CardContent className="p-2.5 space-y-2">
                                    <div className="flex justify-between items-start">
                                      <h4 className="font-serif text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate pr-1">{skill.name}</h4>
                                      <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary bg-background/45 rounded-none h-5 px-1 py-0">{getDiceLabel(skill.value)}</Badge>
                                    </div>

                                    <div className="flex items-baseline gap-1 py-0.5">
                                      <span className="text-2xl font-serif text-foreground font-bold">{skill.value}</span>
                                      <span className="text-[10px] font-mono text-primary font-bold">+{getModifierForStat(skill.value, character?.rank)}</span>
                                    </div>

                                    {/* Skill training */}
                                    <div className="border-t border-border/30 pt-2 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
                                      <div className="flex justify-between items-center text-[9px] font-mono">
                                        <span className="text-muted-foreground uppercase">Skill Training</span>
                                        <span className="text-primary font-bold">{skill.training}/{skill.value}</span>
                                      </div>
                                      <div className="flex gap-1.5 items-center">
                                        <div className="flex-1 bg-accent/40 h-1 rounded-none overflow-hidden">
                                          <div
                                            className="bg-primary h-full rounded-none transition-all"
                                            style={{ width: `${Math.min(100, (skill.training / skill.value) * 100)}%` }}
                                          />
                                        </div>

                                        {/* +/- training buttons */}
                                        <div className="flex border border-border/50">
                                          <button
                                            className="h-5 w-5 text-xs font-bold bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                                            onClick={() => handleSkillTrain(skill, "down")}
                                            disabled={skill.value <= 0 && skill.training === 0}
                                          >
                                            -
                                          </button>
                                          <div className="h-5 w-[1px] bg-border/50" />
                                          <button
                                            className="h-5 w-5 text-xs font-bold bg-background/50 hover:bg-accent text-primary hover:text-primary-foreground cursor-pointer flex items-center justify-center"
                                            onClick={() => handleSkillTrain(skill, "up")}
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-10 bg-card/30 border border-dashed border-border/40 rounded-none text-sm text-muted-foreground/60 italic font-serif">
                No custom skills added yet. Tap "Edit Skills" to register skills.
              </div>
            )}
          </div>
        </DockableTool>

        {/* TAB 3: INVENTORY */}
        <DockableTool id="inventory">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <Coins className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Bag / Gear</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage inventory, currency, and equipped gear</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-6 min-w-0">

            {/* Currencies */}
            <div className="space-y-4 min-w-0">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Coins className="w-4 h-4 shrink-0 text-primary" /> Currencies
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2 rounded-none cursor-pointer" onClick={() => triggerAddInventory("currency")}>
                  Add Currency
                </Button>
              </div>

              {currencies && currencies.length > 0 ? (
                <div className="space-y-2">
                  {currencies.map(c => (
                    <Card key={c.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all rounded-none">
                      <CardContent className="p-3 space-y-3">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="font-serif font-semibold text-foreground">{c.name}</span>
                            <span className="font-mono font-bold text-lg text-primary">{c.amount}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground rounded-none cursor-pointer" onClick={() => triggerEditInventory("currency", c)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <CurrencyAdjustments currency={c}/>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No currencies tracked.</p>
              )}
            </div>

            {/* Equipment */}
            <div className="space-y-4 min-w-0">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Hammer className="w-4 h-4 shrink-0 text-primary" /> Equipment
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2 rounded-none cursor-pointer" onClick={() => triggerAddInventory("equipment")}>
                  [Add]
                </Button>
              </div>

              {equipment && equipment.length > 0 ? (
                <div className="space-y-2">
                  {equipment.map(eq => {
                    const bonusList = Object.entries(eq.statModifiers || {}).map(([stat, val]) => `${stat.toUpperCase()}: +${val}`);
                    const eqDtVal = parseFormulaOrNum(eq.dtBonus, {});
                    if (eqDtVal > 0 || String(eq.dtBonus).trim().length > 0) bonusList.push(`DT: +${eq.dtBonus}`);

                    return (
                      <Card id={`equipment-card-${eq.id}`} key={eq.id} className={`bg-card/50 border-border/40 transition-all rounded-none ${eq.equipped ? "border-primary/40 shadow-sm bg-primary/[0.01]" : ""}`}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-serif font-bold text-foreground flex flex-wrap items-center gap-1.5">
                                {eq.name}
                                {eq.equipped && <span className="shrink-0 whitespace-nowrap text-[8px] bg-primary/10 border border-primary/30 text-primary px-1 rounded-none uppercase font-semibold">Equipped</span>}
                              </div>
                              <p className="text-[10px] text-muted-foreground/80 font-serif whitespace-pre-wrap leading-relaxed mt-1">{eq.description}</p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-primary rounded-none cursor-pointer" onClick={() => triggerEditInventory("equipment", eq)}>
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive rounded-none cursor-pointer" onClick={() => deleteEq.mutate({ id: eq.id, charId: id })}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          {bonusList.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {bonusList.map(bonus => (
                                <Badge key={bonus} variant="outline" className="text-[9px] font-mono border-primary/20 text-primary/80 py-0.5 px-1.5 rounded-none">{bonus}</Badge>
                              ))}
                            </div>
                          )}

                          {/* Item Linked Abilities list */}
                          {(() => {
                            const eqAbilities = abilities.filter(a => a.equipmentId === eq.id);
                            if (eqAbilities.length === 0) return null;
                            return (
                              <div className="border-t border-border/20 pt-2 mt-2 space-y-2">
                                <div className="text-[10px] uppercase font-bold text-primary tracking-wider">
                                  Item Abilities
                                </div>
                                <div className="space-y-1.5">
                                  {eqAbilities.map(ab => {
                                    return (
                                      <div key={ab.id} className="bg-background/30 p-2 border border-border/10">
                                        <div className="flex flex-wrap justify-between items-center gap-3">
                                          <div className="min-w-0 flex-1 basis-48">
                                            <div className="font-serif text-xs font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                                              {ab.name}
                                              {ab.cost > 0 && <span className="text-[9px] text-blue-400 font-mono">({ab.cost} MP)</span>}
                                            </div>

                                            {ab.rollFormula && <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">Formula: {ab.rollFormula}</p>}
                                            {(() => {
                                               const badges = ab.definition ? [] : getAbilityActiveModifierBadges(ab, finalStats);
                                               if (badges.length === 0) return null;
                                               return (
                                                 <div className="flex flex-wrap items-center gap-1 mt-1">
                                                   {badges.map((b: ActiveModifierBadge, i: number) => (
                                                     <span 
                                                       key={i} 
                                                       title={b.rawFormula ? `Formula: ${b.rawFormula}` : undefined}
                                                       className={`text-[8px] font-mono px-1 py-0.2 rounded-none border transition-all ${
                                                         !ownedAbilityActive(ab) ? "opacity-50" : ""
                                                       } ${
                                                         b.type === "stat" 
                                                           ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold"
                                                           : b.type.includes("add")
                                                           ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                                           : b.type.includes("buff")
                                                           ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                                                           : b.type === "init"
                                                           ? "bg-purple-500/10 border-purple-500/40 text-purple-300 font-bold"
                                                           : "bg-orange-500/10 border-orange-500/40 text-orange-300"
                                                       }`}
                                                     >
                                                       {b.label}
                                                     </span>
                                                   ))}
                                                 </div>
                                               );
                                             })()}
                                          </div>
                                          <div className="flex flex-wrap shrink-0 items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => ab.definition ? handleAbilityRoll(ab) : toggleAbilityActive(ab)}
                                              className={`px-1.5 py-0.5 rounded-none text-[8px] font-bold uppercase transition-all border cursor-pointer ${
                                                ownedAbilityActive(ab)
                                                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]" 
                                                  : "bg-background/40 border-border/80 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                              }`}
                                            >
                                              {ownedAbilityActive(ab) ? "Active" : "Inactive"}
                                            </button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-6 text-[9px] font-serif border-primary/20 text-primary hover:bg-primary/15 px-2 rounded-none cursor-pointer"
                                              disabled={!!ab.definition && ["Always On", "When Triggered"].includes(ab.definition.durationType)} onClick={() => handleAbilityRoll(ab)}
                                            >
                                              {ab.definition?.durationType === "Always On" ? "Always On" : ab.definition?.durationType === "When Triggered" ? "Triggered" : ownedAbilityActive(ab) ? "Deactivate" : "Activate"}
                                            </Button>
                                          </div>
                                        </div>

                                        {ab.definition && <details className="mt-2"><summary className="text-xs text-primary cursor-pointer">Ability Details</summary>{renderOwnedAbilityDetails(ab)}</details>}
                                        {/* Rechargeable charge counter training stats style */}
                                        {ab.usageType === "rechargeable" && (
                                          <div className="flex flex-col gap-1 mt-1.5 border-t border-border/10 pt-1.5" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-between items-center text-[9px] font-mono">
                                              <span className="text-muted-foreground uppercase">Charges</span>
                                              <span className="text-amber-400 font-bold">{ab.currentCharges ?? ab.maxCharges}/{ab.maxCharges}</span>
                                            </div>
                                            <div className="flex gap-1.5 items-center">
                                              <div className="flex-1 bg-accent/40 h-1 rounded-none overflow-hidden">
                                                <div
                                                  className="bg-amber-400 h-full rounded-none transition-all"
                                                  style={{ width: `${Math.min(100, ((ab.currentCharges ?? ab.maxCharges ?? 0) / Math.max(1, ab.maxCharges ?? 0)) * 100)}%` }}
                                                />
                                              </div>
                                              <div className="flex border border-border/50 bg-background/50">
                                                <button
                                                  className="h-4 w-4 text-[9px] font-bold hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                                                  onClick={() => {
                                                    const cur = ab.currentCharges ?? ab.maxCharges ?? 0;
                                                    updateAbilityMut.mutate({ id: ab.id, data: { currentCharges: Math.max(0, cur - 1) } });
                                                  }}
                                                  disabled={(ab.currentCharges ?? ab.maxCharges) === 0}
                                                >
                                                  -
                                                </button>
                                                <div className="h-4 w-[1px] bg-border/50" />
                                                <button
                                                  className="h-4 w-4 text-[9px] font-bold hover:bg-accent text-primary hover:text-primary-foreground cursor-pointer flex items-center justify-center"
                                                  onClick={() => {
                                                    const cur = ab.currentCharges ?? ab.maxCharges ?? 0;
                                                    updateAbilityMut.mutate({ id: ab.id, data: { currentCharges: Math.min(ab.maxCharges ?? 0, cur + 1) } });
                                                  }}
                                                  disabled={(ab.currentCharges ?? ab.maxCharges) === ab.maxCharges}
                                                >
                                                  +
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            <label className="flex items-center gap-1 whitespace-nowrap cursor-pointer">
                              <input
                                type="checkbox"
                                checked={eq.equipped}
                                onChange={(e) => updateEq.mutate({ id: eq.id, data: { equipped: e.target.checked } })}
                                className="rounded-none border-border/50 h-3 w-3 accent-primary"
                              />
                              Equipped
                            </label>
                            {eq.diceType && (
                              <label className="flex items-center gap-1 whitespace-nowrap cursor-pointer opacity-70">
                                <input
                                  type="checkbox"
                                  checked={eq.assignedToQuickRolls}
                                  onChange={(e) => updateEq.mutate({ id: eq.id, data: { assignedToQuickRolls: e.target.checked } })}
                                  className="rounded-none border-border/50 h-3 w-3 accent-primary"
                                />
                                Auto Hotbar
                              </label>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No equipment found.</p>
              )}
            </div>

            {/* General Items */}
            <div className="space-y-4 min-w-0">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Package className="w-4 h-4 shrink-0 text-primary" /> General Items
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2 rounded-none cursor-pointer" onClick={() => triggerAddInventory("item")}>
                  [Add]
                </Button>
              </div>

              {inventory && inventory.length > 0 ? (
                <div className="space-y-2">
                  {inventory.map(item => (
                    <Card id={`inventory-card-${item.id}`} key={item.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all rounded-none">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-serif font-semibold text-foreground">
                              {item.name} <span className="font-mono text-muted-foreground/80 font-normal">x{item.quantity}</span>
                            </div>
                            {item.description && <p className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed mt-1">{item.description}</p>}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary rounded-none cursor-pointer" onClick={() => triggerEditInventory("item", item)}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-destructive rounded-none cursor-pointer" 
                              onClick={() => {
                                if (item.quantity > 1) {
                                  triggerDiscardItem(item);
                                } else {
                                  deleteInvItem.mutate({ id: item.id, charId: id }, {
                                    onSuccess: () => toast.success(`Discarded ${item.name}.`)
                                  });
                                }
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* General Item Linked Abilities list */}
                        {(() => {
                          const itemAbils = abilities.filter(a => a.inventoryItemId === item.id);
                          if (itemAbils.length === 0) return null;
                          return (
                            <div className="border-t border-border/20 pt-2 mt-2 space-y-2">
                              <div className="space-y-1.5">
                                {itemAbils.map(ab => (
                                  <div key={ab.id} className="bg-background/30 p-2 border border-border/10">
                                    <div className="flex flex-wrap justify-between items-center gap-3">
                                      <div className="min-w-0 flex-1 basis-48">
                                        <div className="font-serif text-xs font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                                          {ab.name}
                                          {ab.cost > 0 && <span className="text-[9px] text-blue-400 font-mono">({ab.cost} MP)</span>}
                                        </div>

                                        {ab.rollFormula && <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">Formula: {ab.rollFormula}</p>}
                                      </div>
                                      <div className="flex flex-wrap shrink-0 items-center gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-6 text-[9px] font-serif border-primary/20 text-primary hover:bg-primary/15 px-2 rounded-none cursor-pointer"
                                          disabled={!!ab.definition && ["Always On", "When Triggered"].includes(ab.definition.durationType)} onClick={() => handleAbilityRoll(ab)}
                                        >
                                          {ab.definition?.durationType === "Always On" ? "Always On" : ab.definition?.durationType === "When Triggered" ? "Triggered" : ownedAbilityActive(ab) ? "Deactivate" : "Activate"}
                                        </Button>
                                      </div>
                                    </div>

                                    {ab.definition && <details className="mt-2"><summary className="text-xs text-primary cursor-pointer">Ability Details</summary>{renderOwnedAbilityDetails(ab)}</details>}
                                    {/* Rechargeable charge counter training stats style */}
                                    {ab.usageType === "rechargeable" && (
                                      <div className="flex flex-col gap-1 mt-1.5 border-t border-border/10 pt-1.5" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-between items-center text-[9px] font-mono">
                                          <span className="text-muted-foreground uppercase">Charges</span>
                                          <span className="text-amber-400 font-bold">{ab.currentCharges ?? ab.maxCharges}/{ab.maxCharges}</span>
                                        </div>
                                        <div className="flex gap-1.5 items-center">
                                          <div className="flex-1 bg-accent/40 h-1 rounded-none overflow-hidden">
                                            <div
                                              className="bg-amber-400 h-full rounded-none transition-all"
                                              style={{ width: `${Math.min(100, ((ab.currentCharges ?? ab.maxCharges ?? 0) / Math.max(1, ab.maxCharges ?? 0)) * 100)}%` }}
                                            />
                                          </div>
                                          <div className="flex border border-border/50 bg-background/50">
                                            <button
                                              className="h-4 w-4 text-[9px] font-bold hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                                              onClick={() => {
                                                const cur = ab.currentCharges ?? ab.maxCharges ?? 0;
                                                updateAbilityMut.mutate({ id: ab.id, data: { currentCharges: Math.max(0, cur - 1) } });
                                              }}
                                              disabled={(ab.currentCharges ?? ab.maxCharges) === 0}
                                            >
                                              -
                                            </button>
                                            <div className="h-4 w-[1px] bg-border/50" />
                                            <button
                                              className="h-4 w-4 text-[9px] font-bold hover:bg-accent text-primary hover:text-primary-foreground cursor-pointer flex items-center justify-center"
                                              onClick={() => {
                                                const cur = ab.currentCharges ?? ab.maxCharges ?? 0;
                                                updateAbilityMut.mutate({ id: ab.id, data: { currentCharges: Math.min(ab.maxCharges ?? 0, cur + 1) } });
                                              }}
                                              disabled={(ab.currentCharges ?? ab.maxCharges) === ab.maxCharges}
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No general items.</p>
              )}
            </div>

            <EditInventoryDialog
              characterId={id}
              isOpen={isInvOpen}
              onOpenChange={setIsInvOpen}
              mode={invMode}
              type={invType}
              initialData={invInitialData}
              onAddAbilityClick={(eqId, invItemId) => triggerAddItemAbility(eqId, invItemId)}
              onEditAbilityClick={(ab) => triggerEditItemAbility(ab)}
            />

            <EditItemAbilityDialog
              isOpen={isItemAbOpen}
              onOpenChange={setIsItemAbOpen}
              characterId={id}
              equipmentId={itemAbEquipmentId}
              inventoryItemId={itemAbInventoryItemId}
              initialData={itemAbInitialData}
            />
          </div>
        </div>
        </DockableTool>

        {/* TAB 5: ABILITIES */}
        <DockableTool id="abilities">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px]">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Shaped Abilities</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Activate and cast abilities using mana</p>
                </div>
              </div>
              <EditAbilitiesDialog 
                characterId={id} 
                abilities={abilities} 
                open={isEditAbilitiesOpen} 
                onOpenChange={(open) => { 
                  setIsEditAbilitiesOpen(open); 
                  if (!open) setEditingAbilityId(null); 
                }} 
                initialAbilityId={editingAbilityId} 
              />
            </div>

            {(() => {
              const getAbilityBonusList = (ability: Ability): string[] => {
                const bonuses: string[] = [];
                if (ability.bonusPower) bonuses.push(`+${ability.bonusPower} POW`);
                if (ability.bonusVitality) bonuses.push(`+${ability.bonusVitality} VIT`);
                if (ability.bonusSpirit) bonuses.push(`+${ability.bonusSpirit} SPI`);
                if (ability.bonusAgility) bonuses.push(`+${ability.bonusAgility} AGI`);
                if (ability.bonusEndurance) bonuses.push(`+${ability.bonusEndurance} END`);
                if (ability.bonusPrecision) bonuses.push(`+${ability.bonusPrecision} PRE`);
                if (ability.bonusWillpower) bonuses.push(`+${ability.bonusWillpower} WIL`);
                if (ability.bonusCharisma) bonuses.push(`+${ability.bonusCharisma} CHA`);
                if (ability.hpAdd) bonuses.push(`+${ability.hpAdd} HP Heal`);
                if (ability.hpBuff) bonuses.push(`+${ability.hpBuff} Max HP`);
                if (ability.manaAdd) bonuses.push(`+${ability.manaAdd} Mana Restore`);
                if (ability.manaBuff) bonuses.push(`+${ability.manaBuff} Max Mana`);
                if (ability.dtAdd) bonuses.push(`+${ability.dtAdd} DT Shield`);
                if (ability.dtBuff) bonuses.push(`+${ability.dtBuff} Max DT`);
                if (ability.bonusInitiative) bonuses.push(`+${ability.bonusInitiative} Initiative`);
                if (ability.resistances) bonuses.push(`Resistances: ${ability.resistances}`);
                if (ability.immunities) bonuses.push(`Immunities: ${ability.immunities}`);
                return bonuses;
              };

              // Helper to render ability card
                const renderAbilityCard = (ability: Ability, allList: Ability[], isRowExpanded: boolean, row: Ability[]) => {
                  const isExpanded = isRowExpanded;
                  const bonuses = getAbilityBonusList(ability);
                  const rankInfo = getAbilityHighestRank(ability, finalStats);
                  const evolData = calculateAbilityEvolutions(ability, character.rank, finalStats);

                  const activeUpdateTrigger = !ability.definition ? ability.triggers?.find(trig =>
                    trig &&
                    trig.triggerAction === "update_attached" &&
                    isAbilityTriggerActive(trig, {
                      hp: character ? character.currentHp : 0,
                      maxHp,
                      mana: character ? character.currentMana : 0,
                      maxMana,
                      dt: character ? character.currentDt : 0,
                      maxDt,
                    })
                  ) : undefined;

                  const parentEntry = ability.definition ? resolveTrackerEffects([ability], character.rank, finalStats, { hp: hp ?? character.currentHp, maxHp, mana: mana ?? character.currentMana, maxMana, dt: currentDt ?? character.currentDt, maxDt }, character.triggerConfirmations ?? {}, character.familiars).find(entry => !entry.result && entry.input?.id === ability.definition!.id) : undefined;
                  const inputActive = parentEntry ? isEffectApplied(parentEntry, "self", character.effectApplications ?? []) : ability.active;
                  const displayName = activeUpdateTrigger?.updatedName || ability.name;
                  const displayType = activeUpdateTrigger?.updatedType || ability.type;
                  const displayCost = activeUpdateTrigger?.updatedCost !== undefined ? activeUpdateTrigger.updatedCost : ability.cost;
                  const displayRange = activeUpdateTrigger?.updatedRange || ability.range;
                  const displaySpeed = activeUpdateTrigger?.updatedSpeed || ability.speed;
                  const displayRollFormula = activeUpdateTrigger?.updatedRollFormula || ability.rollFormula;
                  const displayDescription = ability.definition ? ability.definition.description : activeUpdateTrigger?.updatedDescription || ability.description;

                  return (
                    <Card 
                      id={`ability-card-${ability.id}`}
                      key={ability.id}
                      draggable
                      onDragStart={(e) => handleAbilityDragStart(e, ability.id)}
                      onDragOver={handleAbilityDragOver}
                      onDrop={(e) => handleAbilityDrop(e, ability.id, allList)}
                      className={`bg-card border transition-all rounded-none overflow-hidden cursor-grab active:cursor-grabbing relative h-full flex flex-col justify-between ${
                        activeUpdateTrigger ? "border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.25)]" : "border-border/40 hover:border-primary/20"
                      }`}
                    >
                      <CardContent className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Header row (Clickable card body toggles expansion except buttons) */}
                          <div 
                            className="flex flex-wrap justify-between items-start gap-x-3 gap-y-2 cursor-pointer select-none"
                            onClick={() => setExpandedAbilities(prev => {
                              const open = !row.some(entry => prev[entry.id]);
                              return { ...prev, ...Object.fromEntries(row.map(entry => [entry.id, open])) };
                            })}
                          >
                            <div className="space-y-1.5 flex-1 min-w-0 basis-[20rem]">
                              <div className="flex items-center gap-2 min-w-0 flex-nowrap">
                                {/* Read-Only Rank Marker Badge */}
                                <div className="shrink-0 whitespace-nowrap flex items-center gap-1 border border-primary/30 px-2 py-0.5 rounded-none bg-primary/10 text-[10px] font-bold text-primary font-mono shadow-sm">
                                  <span>Rank: {rankInfo.label}</span>
                                </div>

                                <h4 className="font-serif text-base font-bold text-primary leading-tight hover:text-primary/80 transition-colors flex-1 min-w-0 flex items-center gap-1.5">
                                  <span className="truncate" title={displayName}>{displayName}</span>
                                  {activeUpdateTrigger && (
                                    <Badge className="bg-purple-500/20 border border-purple-400 text-purple-300 text-[8px] font-bold uppercase tracking-wider rounded-none px-1.5 py-0.5 animate-pulse">
                                      Trigger Replaced
                                    </Badge>
                                  )}
                                  {displayType && (
                                    <Badge className="bg-primary/10 border border-primary/30 text-primary text-[8px] font-bold uppercase tracking-wider rounded-none px-1.5 py-0.5">
                                      {displayType}
                                    </Badge>
                                  )}
                                </h4>
                                <svg className={`w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary rounded-none bg-background/50">{displayCost} MP</Badge>
                                <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-none bg-background/50">{displayRange}</Badge>
                                <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-none bg-background/50">{displaySpeed}</Badge>

                              {/* Active Toggle Switch */}
                              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  disabled={ability.definition?.durationType === "Always On"}
                                  onClick={() => { if (ability.definition) { const node = ability.definition; const active = (character.effectApplications ?? []).some(application => application.abilityId === ability.id && application.effectId === node.id && application.targetId === "self"); if (active) changeAbilityApplications((character.effectApplications ?? []).filter(application => !(application.abilityId === ability.id && application.effectId === node.id && application.targetId === "self"))); else handleAbilityRoll(ability); } else toggleAbilityActive(ability); }}
                                  className={`px-2 py-0.5 rounded-none text-[9px] font-bold uppercase transition-all border cursor-pointer ${
                                    (ability.definition ? ability.definition.durationType === "Always On" || (character.effectApplications ?? []).some(application => application.abilityId === ability.id && application.effectId === ability.definition!.id && application.targetId === "self") : ability.active)
                                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]" 
                                      : "bg-background/40 border-border/80 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                                  }`}
                                >
                                  {(ability.definition ? ability.definition.durationType === "Always On" || (character.effectApplications ?? []).some(application => application.abilityId === ability.id && application.effectId === ability.definition!.id && application.targetId === "self") : ability.active) ? "Active" : "Inactive"}
                                </button>
                              </div>

                              {/* Active Modifiers Summary Badges */}
                              {(!ability.definition ? getAbilityActiveModifierBadges(ability, finalStats) : []).map((b: ActiveModifierBadge, i: number) => (
                                <span 
                                  key={i} 
                                  title={b.rawFormula ? `Formula: ${b.rawFormula}` : undefined}
                                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded-none border transition-all ${
                                    !ability.active ? "opacity-50" : ""
                                  } ${
                                    b.type === "stat" 
                                      ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold"
                                      : b.type.includes("add")
                                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                      : b.type.includes("buff")
                                      ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                                      : b.type === "init"
                                      ? "bg-purple-500/10 border-purple-500/40 text-purple-300 font-bold"
                                      : "bg-orange-500/10 border-orange-500/40 text-orange-300"
                                  }`}
                                >
                                  {b.label}
                                </span>
                              ))}

                              {/* Ability Effect Badges (Display Effect Name, hover for details) */}
                              {!ability.definition && ability.abilityEffects && ability.abilityEffects.map((eff, effIdx) => {
                                if (!eff) return null;
                                const tooltipText = [
                                  `Effect: ${eff.name || "Effect"}`,
                                  eff.category ? `Category: ${eff.category}` : null,
                                  eff.duration ? `Duration: ${eff.duration}` : null,
                                  eff.description ? `Rules: ${eff.description}` : null,
                                ].filter(Boolean).join(" | ");

                                return (
                                  <span
                                    key={eff.id || effIdx}
                                    title={tooltipText}
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded-none border bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold transition-all cursor-help"
                                  >
                                    {eff.name || `Effect #${effIdx + 1}`}
                                  </span>
                                );
                              })}

                              {/* Active Trigger Badges (Display Vital Condition, hover for trigger details) */}
                              {!ability.definition && ability.triggers && ability.triggers.map((trig, trigIdx) => {
                                if (!trig) return null;
                                const isActive = isAbilityTriggerActive(trig, {
                                  hp: character ? character.currentHp : 0,
                                  maxHp,
                                  mana: character ? character.currentMana : 0,
                                  maxMana,
                                  dt: character ? character.currentDt : 0,
                                  maxDt,
                                });

                                if (!isActive) return null;

                                const isUpdate = trig.triggerAction === "update_attached";
                                const resName = trig.resource ? String(trig.resource).toUpperCase() : "HP";
                                const opSymbol = trig.operator === "below_percent" ? `< ${trig.threshold ?? 50}%`
                                  : trig.operator === "below_value" ? `<= ${trig.threshold ?? 0}`
                                  : trig.operator === "depleted" ? `= 0`
                                  : trig.operator === "above_percent" ? `>= ${trig.threshold ?? 50}%`
                                  : `= Max`;

                                const label = `${resName} ${opSymbol}${isUpdate ? " [Updated]" : ""}`;
                                const tooltipText = [
                                  `Trigger: ${trig.name || "Active Trigger"}`,
                                  isUpdate ? "Action: Update Attached Ability" : "Action: Trigger Attached Ability",
                                  trig.description ? `Rules: ${trig.description}` : null,
                                  isUpdate && trig.updatedRollFormula ? `Updated Formula: ${trig.updatedRollFormula}` : null,
                                  isUpdate && trig.updatedCost !== undefined ? `Updated Cost: ${trig.updatedCost} MP` : null,
                                  isUpdate && trig.updatedDescription ? `Changes: ${trig.updatedDescription}` : null,
                                ].filter(Boolean).join(" | ");

                                return (
                                  <span
                                    key={trig.id || trigIdx}
                                    title={tooltipText}
                                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-none border font-bold transition-all cursor-help animate-pulse ${
                                      isUpdate
                                        ? "bg-purple-500/20 border-purple-400 text-purple-300 shadow-[0_0_6px_rgba(168,85,247,0.3)]"
                                        : "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.3)]"
                                    }`}
                                  >
                                    ⚡ {label}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Action Roll Buttons (Prevent Card Click Toggle) */}
                          <div className="flex shrink-0 items-center gap-1.5 ml-auto" onClick={e => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingAbilityId(ability.id);
                                setIsEditAbilitiesOpen(true);
                              }}
                              className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-7 text-xs font-serif rounded-none cursor-pointer px-2"
                              title="Edit Ability"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {ability.definition ? <Button size="sm" className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-7 text-xs font-serif rounded-none cursor-pointer whitespace-nowrap" disabled={!!rollingDice || updateChar.isPending || ["Always On", "When Triggered"].includes(ability.definition.durationType)} onClick={() => { if (inputActive) changeAbilityApplications((character.effectApplications ?? []).filter(application => !(application.abilityId === ability.id && application.effectId === ability.definition!.id && application.targetId === "self"))); else handleAbilityRoll(ability); }}><Dice5 className="w-3 h-3 mr-1" />{ability.definition.durationType === "Always On" ? "Always On" : ability.definition.durationType === "When Triggered" ? (inputActive ? "Trigger Active" : "Triggered") : inputActive ? "Deactivate" : `Activate${ability.definition.linkedStats.length ? ` (${ability.definition.linkedStats.map(stat => stat.substring(0, 3).toUpperCase()).join(" / ")})` : ""}`}</Button> : ability.components ? <Button size="sm" className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-7 text-xs font-serif rounded-none cursor-pointer whitespace-nowrap" onClick={() => { if (!ability.active) toggleAbilityActive(ability); if (ability.rollFormula) handleAbilityRoll(ability); }}><Dice5 className="w-3 h-3 mr-1" />Activate{ability.linkedStats?.length ? ` (${ability.linkedStats.map(stat => stat.substring(0, 3).toUpperCase()).join(" / ")})` : ""}</Button> : ability.linkedStats && ability.linkedStats.length > 0 ? (
                              ability.linkedStats.map(statKey => (
                                <Button
                                  key={statKey}
                                  size="sm"
                                  onClick={() => handleAbilityRoll(ability, statKey)}
                                  className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-7 text-xs font-serif rounded-none cursor-pointer whitespace-nowrap"
                                >
                                  <Dice5 className="w-3 h-3 mr-1" /> Activate ({statKey.substring(0, 3).toUpperCase()})
                                </Button>
                              ))
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleAbilityRoll(ability)}
                                className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-7 text-xs font-serif rounded-none cursor-pointer"
                              >
                                <Dice5 className="w-3 h-3 mr-1" /> Activate
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Expandable Content (Markdown + Stats + Formulas + Evolution Modifiers) */}
                        {isExpanded && (
                          <div className="border-t border-border/20 pt-3 space-y-2.5 animate-in slide-in-from-top-2 duration-200 mt-2">
                            {!ability.definition && ability.components && <AbilityComponentList ability={ability} rank={character.rank} stats={finalStats}
                              vitals={{ hp: hp ?? character.currentHp, mana: mana ?? character.currentMana, dt: currentDt ?? character.currentDt, maxHp, maxMana, maxDt }}
                              confirmations={character.triggerConfirmations ?? {}} applications={character.effectApplications ?? []}
                              onApplicationsChange={changeAbilityApplications}
                              onRoll={handleAbilityResultRoll} />}
                            {ability.definition && <AbilityResultList ability={ability} rank={character.rank} stats={finalStats}
                              vitals={{ hp: hp ?? character.currentHp, mana: mana ?? character.currentMana, dt: currentDt ?? character.currentDt, maxHp, maxMana, maxDt }}
                              confirmations={character.triggerConfirmations ?? {}} applications={character.effectApplications ?? []}
                              onApplicationsChange={changeAbilityApplications}
                              onRoll={handleAbilityResultRoll} onUse={nodeId => handleAbilityRoll(ability, undefined, nodeId)} onUseResult={resultId => { const entry = resolveTrackerEffects([ability], character.rank, finalStats, { hp: hp ?? character.currentHp, maxHp, mana: mana ?? character.currentMana, maxMana, dt: currentDt ?? character.currentDt, maxDt }, character.triggerConfirmations ?? {}, character.familiars).find(entry => entry.effect.id === resultId); if (entry) executeFavoriteResult(entry, false); }} familiars={character.familiars} movementSpeed={speed ?? character.speed}
                              timing={character.abilityTiming} onTimingChange={(nodeId, patch) => updateChar.mutate({ id, data: { abilityTiming: { ...character.abilityTiming, [nodeId]: { ...character.abilityTiming?.[nodeId], ...patch } } } })}
                              onPayMana={handleAbilityManaPayment} />}
                            {!ability.definition && displayRollFormula && (
                              <div className="text-[10px] font-mono text-muted-foreground bg-background/50 border border-border/30 px-2.5 py-1.5 rounded-none flex items-center justify-between">
                                <span>Formula: <code className="text-primary font-bold">{displayRollFormula}</code></span>
                              </div>
                            )}

                            <div
                              className="text-xs text-muted-foreground font-serif leading-relaxed whitespace-pre-wrap pl-1"
                              dangerouslySetInnerHTML={{ __html: parseMarkdown(displayDescription || "*No description.*") }}
                            />

                            {/* Sub-Abilities / Additional Base Effects (Only rendered if present) */}
                            {!ability.definition && ability.subAbilities && ability.subAbilities.length > 0 && (
                              <div className="space-y-1.5 mt-2 pt-2 border-t border-border/30">
                                {ability.subAbilities.map((sub, subIdx) => {
                                  let subTitle = sub.name?.trim() ? sub.name.trim() : `${ability.name} (${subIdx + 2})`;
                                  let subType = sub.type;
                                  let subCost = sub.cost;
                                  let subRollFormula = sub.rollFormula;
                                  let subDesc = sub.description;

                                  // Check for active replacement triggers affecting sub-abilities
                                  if (ability.triggers && ability.triggers.length > 0) {
                                    for (const trig of ability.triggers) {
                                      if (trig && trig.triggerAction === "update_attached" && isAbilityTriggerActive(trig, {
                                        hp: character ? character.currentHp : 0,
                                        maxHp,
                                        mana: character ? character.currentMana : 0,
                                        maxMana,
                                        dt: character ? character.currentDt : 0,
                                        maxDt,
                                      })) {
                                        if (trig.updatedName) subTitle = trig.updatedName;
                                        if (trig.updatedType) subType = trig.updatedType;
                                        if (trig.updatedCost !== undefined) subCost = trig.updatedCost;
                                        if (trig.updatedRollFormula) subRollFormula = trig.updatedRollFormula;
                                        if (trig.updatedDescription) subDesc = trig.updatedDescription;
                                      }
                                    }
                                  }

                                  const subKey = `${ability.id}-${sub.id || subIdx}`;
                                  const isSubOpen = !!expandedSubAbilities[subKey];

                                  return (
                                    <div key={subKey} className="bg-primary/5 border border-primary/25 rounded-none overflow-hidden text-xs">
                                      {/* Sub-Ability Collapsible Header Bar */}
                                      <div
                                        onClick={() => setExpandedSubAbilities(prev => ({ ...prev, [subKey]: !isSubOpen }))}
                                        className="flex items-center justify-between p-2 bg-primary/10 hover:bg-primary/20 cursor-pointer select-none border-b border-border/20 flex-wrap gap-1.5"
                                      >
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-serif font-bold text-primary">{subTitle}</span>
                                          {subType && (
                                            <Badge className="bg-primary/10 border border-primary/30 text-primary text-[8px] font-bold uppercase rounded-none px-1.5 py-0.5">
                                              {subType}
                                            </Badge>
                                          )}
                                          {subCost !== undefined && subCost > 0 && (
                                            <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary rounded-none bg-background/50">
                                              {subCost} MP
                                            </Badge>
                                          )}
                                          {sub.range && (
                                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-none bg-background/50">
                                              {sub.range}
                                            </Badge>
                                          )}
                                          {sub.speed && (
                                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-none bg-background/50">
                                              {sub.speed}
                                            </Badge>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                          {sub.linkedStats && sub.linkedStats.length > 0 ? (
                                            sub.linkedStats.map(statKey => (
                                              <Button
                                                key={statKey}
                                                size="sm"
                                                onClick={() => handleAbilityRoll({ ...ability, name: subTitle, rollFormula: subRollFormula || ability.rollFormula }, statKey)}
                                                className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-6 text-[10px] font-serif rounded-none cursor-pointer px-2"
                                              >
                                                <Dice5 className="w-3 h-3 mr-1" /> Activate ({statKey.substring(0, 3).toUpperCase()})
                                              </Button>
                                            ))
                                          ) : subRollFormula ? (
                                            <Button
                                              size="sm"
                                              onClick={() => handleRoll(subRollFormula || "d20", `Sub: ${subTitle}`)}
                                              className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-6 text-[10px] font-serif rounded-none cursor-pointer px-2"
                                            >
                                              <Dice5 className="w-3 h-3 mr-1" /> Activate
                                            </Button>
                                          ) : null}
                                          <svg className={`w-3.5 h-3.5 text-primary/80 transition-transform duration-200 ${isSubOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                      </div>

                                      {/* Sub-Ability Expanded Body */}
                                      {isSubOpen && (
                                        <div className="p-2.5 space-y-1.5 bg-background/80 border-t border-border/20">
                                          {subRollFormula && (
                                            <div className="text-[10px] font-mono text-muted-foreground bg-background/50 border border-border/30 px-2 py-1 rounded-none">
                                              Formula: <code className="text-primary font-bold">{subRollFormula}</code>
                                            </div>
                                          )}
                                          <div
                                            className="text-xs text-muted-foreground font-serif leading-relaxed whitespace-pre-wrap pl-0.5"
                                            dangerouslySetInnerHTML={{ __html: parseMarkdown(subDesc || "*No additional effect description.*") }}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Active Evolution Modifiers section — Header title & Zap icon COMPLETELY PURGED */}
                            {!evolData.isDormant && evolData.earnedSlotCount > 0 && evolData.activeModifiers.length > 0 && (
                              <div className="space-y-1.5 mt-2 pt-2 border-t border-border/30">
                                {evolData.activeModifiers.map((mod, idx) => (
                                  <div key={mod.id || idx} className="text-xs bg-primary/5 border border-primary/40 p-2.5 space-y-1 rounded-none">
                                    <div className="flex items-center gap-2">
                                      <div className="bg-primary/20 text-primary border border-primary/40 text-[9px] font-bold font-mono px-2 py-0.5 rounded-none">
                                        {mod.rankLabel}
                                      </div>
                                      {mod.name && <span className="font-serif font-bold text-primary">{mod.name}</span>}
                                    </div>
                                    {mod.effect && (
                                      <p className="text-xs text-foreground/90 font-serif leading-relaxed pl-0.5">{mod.effect}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              };

              const renderAbilityGrid = (abilitiesList: Ability[]) => {
                const chunks = chunkArray(abilitiesList, wideRows ? 2 : 1);
                return (
                  <div className="space-y-4">
                    {chunks.map((row, rowIdx) => {
                      const isRowExpanded = row.some(ab => expandedAbilities[ab.id]);
                      return (
                        <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {row.map(ab => renderAbilityCard(ab, abilitiesList, isRowExpanded, row))}
                        </div>
                      );
                    })}
                  </div>
                );
              };

              // Group abilities by Essence Slot
              const slots = [1, 2, 3, 4];
              const grouped = slots.map(slotNum => {
                const ess = essences?.find(e => e.slot === slotNum);
                const label = slotNum === 1 ? "First Essence" : slotNum === 2 ? "Second Essence" : slotNum === 3 ? "Third Essence" : "Confluence";
                const attachedAbilities = sortAbilities(abilities?.filter(a => ess && a.essenceId === ess.id && !a.equipmentId) || []);
                return { slotNum, ess, label, abilities: attachedAbilities };
              });

              // Innate Passives (selected via Essence Source: Innate Passive)
              const isPassiveAbility = (a: Ability) => !!(a.isInnatePassive || a.essenceId === -1 || a.type === "Innate Passive");
              const passiveAbilities = sortAbilities(abilities?.filter(a => isPassiveAbility(a) && !a.equipmentId) || []);

              // Unassigned Abilities (excluding Innate Passives)
              const unassignedAbilities = sortAbilities(abilities?.filter(a => (!a.essenceId || !essences?.some(e => e.id === a.essenceId)) && !isPassiveAbility(a) && !a.equipmentId) || []);

              const passiveCapacity = getPassiveCapacity(character.rank);

              return (
                <div className="space-y-6">
                  {/* Essence Groups */}
                  {grouped.map(({ slotNum, ess, label, abilities: attached }) => {
                    if (!ess) return null; // Only show attuned Essence slots
                    return (
                      <div key={slotNum} className="space-y-3 border-l-2 border-primary/20 pl-4 py-1">
                        <div className="flex justify-between items-baseline border-b border-border/20 pb-1.5 flex-wrap gap-2">
                          <h4 className="font-serif text-lg font-bold text-primary flex items-center gap-2">
                            <span>{label}: {ess.name}</span>
                          </h4>
                          <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                            Shaped Abilities: {attached.length} / 5
                          </span>
                        </div>

                        {attached.length > 0 ? (
                          renderAbilityGrid(attached)
                        ) : (
                          <p className="text-xs text-muted-foreground/60 italic font-serif py-2">
                            No abilities shaped to this Essence. (Max 5)
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {/* Innate Passive Tree Group (Unlocked starting at Bronze Rank) */}
                  {passiveCapacity > 0 && (
                    <div className="space-y-3 border-l-2 border-amber-500/40 pl-4 py-1">
                      <div className="flex justify-between items-baseline border-b border-amber-500/20 pb-1.5 flex-wrap gap-2">
                        <h4 className="font-serif text-lg font-bold text-amber-400 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                          <span>Innate Passive Tree</span>
                        </h4>
                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                          Passive Slots: {passiveAbilities.length} / {passiveCapacity} ({character.rank || "Iron"} Rank)
                        </span>
                      </div>

                      {passiveAbilities.length > 0 ? (
                        renderAbilityGrid(passiveAbilities)
                      ) : (
                        <p className="text-xs text-muted-foreground/60 italic font-serif py-2">
                          No innate passives registered. (Max {passiveCapacity} for {character.rank || "Iron"} Rank)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Unassigned Group */}
                  {unassignedAbilities.length > 0 && (
                    <div className="space-y-3 border-l-2 border-border/20 pl-4 py-1">
                      <div className="flex justify-between items-baseline border-b border-border/20 pb-1.5">
                        <h4 className="font-serif text-lg font-bold text-muted-foreground">Unassigned Abilities</h4>
                        <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                          Total: {unassignedAbilities.length}
                        </span>
                      </div>
                      {renderAbilityGrid(unassignedAbilities)}
                    </div>
                  )}

                  {/* Empty State when no abilities exist at all */}
                  {(!abilities || abilities.length === 0) && (
                    <div className="text-center py-12 bg-card/30 border border-dashed border-border/40 rounded-none text-sm text-muted-foreground/60 italic font-serif">
                      No abilities registered yet. Click "Edit Abilities" to manage your spellbook.
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </DockableTool>

        {/* TAB 6: CAMPAIGN NOTES (Search and Thematic Filter) */}
        <DockableTool id="notes">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2 mb-4 min-h-[52px] flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <BookText className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-serif text-lg font-bold text-primary">Campaign Notes</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Record adventure logs, fact entries, and journals</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={notesFileInputRef} 
                  onChange={handleImportNotesFile} 
                  accept=".json" 
                  className="hidden" 
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => notesFileInputRef.current?.click()} 
                  className="rounded-none border-primary/40 text-primary hover:bg-primary/10 cursor-pointer text-xs uppercase tracking-wider font-mono h-8"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" /> Import Notes
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportNotes} 
                  className="rounded-none border-primary/40 text-primary hover:bg-primary/10 cursor-pointer text-xs uppercase tracking-wider font-mono h-8"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export Notes
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">

              {/* Note creation column */}
              <div className="lg:col-span-1">
                <Card className="bg-card border-border/50 rounded-none">
                  <CardContent className="p-4 space-y-4">
                    <h4 className="font-serif text-lg text-primary font-bold border-b border-border/30 pb-2">Pen Note entry</h4>
                    <form onSubmit={handleSaveNote} className="space-y-3 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Title</label>
                        <Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} required placeholder="Entry title" className="bg-background text-sm rounded-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Category</label>
                        <select 
                          value={noteCat} 
                          onChange={e => setNoteCat(e.target.value)} 
                          className="w-full h-8 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="general">GENERAL</option>
                          <option value="world">LOCATIONS</option>
                          <option value="entities">ENTITIES (PEOPLE / ORGS)</option>
                          <option value="bestiary">BESTIARY</option>
                          <option value="systems">SYSTEMS</option>
                          <option value="items">ITEMS</option>
                          <option value="maps">MAPS</option>
                          <option value="lore">LORE / ARCHIVES</option>
                          <option value="glossary">THE GLOSSARY</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Content</label>
                        <Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Write thoughts..." className="bg-background min-h-[100px] text-sm font-serif rounded-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Attach Images</label>
                        <Input 
                          type="file" 
                          accept="image/*" 
                          multiple
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            try {
                              const compressed = await Promise.all(files.map(f => compressImage(f, 600, 600)));
                              setNoteImages(prev => [...prev, ...compressed]);
                            } catch (err) {
                              toast.error("Failed to load/compress note images.");
                            }
                          }}
                          className="bg-background text-sm rounded-none h-8 text-xs file:bg-primary file:text-primary-foreground file:border-0 file:px-2 file:py-1 file:cursor-pointer"
                        />
                        {noteImages.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {noteImages.map((img, idx) => (
                              <div key={idx} className="relative w-10 h-10 border border-border rounded overflow-hidden group">
                                <img src={img} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => setNoteImages(prev => prev.filter((_, i) => i !== idx))}
                                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground w-3.5 h-3.5 flex items-center justify-center rounded-full text-[9px] hover:bg-destructive/80"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button type="submit" size="sm" className="w-full bg-primary text-primary-foreground font-serif rounded-none cursor-pointer">Save Entry</Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Note listing/search column */}
              <div className="lg:col-span-2 space-y-4 flex flex-col min-h-[500px]">
                {/* Search and filter controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="Search notes by keyword..."
                    value={noteSearchQuery}
                    onChange={e => setNoteSearchQuery(e.target.value)}
                    className="bg-background/50 border-border/50 text-xs rounded-none h-8 flex-1"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {["all", "general", "world", "entities", "bestiary", "systems", "items", "maps", "lore", "glossary"].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setNoteCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border transition-all rounded-none cursor-pointer ${
                          noteCategoryFilter === cat 
                            ? "bg-primary border-primary text-primary-foreground" 
                            : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                        }`}
                      >
                        {cat === "all" ? "All" : cat === "world" ? "Locations" : cat === "entities" ? "Entities" : cat === "bestiary" ? "Bestiary" : cat === "systems" ? "Systems" : cat === "items" ? "Items" : cat === "maps" ? "Maps" : cat === "lore" ? "Lore" : cat === "glossary" ? "Glossary" : "General"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 flex-1 pr-1">
                  {filteredNotes && filteredNotes.length > 0 ? (
                    filteredNotes.map(note => (
                      <Card key={note.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all relative group rounded-md">
                        <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-md cursor-pointer" onClick={() => deleteNote.mutate({ id: note.id, charId: id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-serif text-lg font-bold text-primary">{note.title}</h4>
                              <Badge variant="outline" className="text-[8px] uppercase tracking-wider text-muted-foreground mt-1 border-border/50 rounded-md bg-background/50">
                                {note.category === "world" ? "🌍 Location" 
                                 : note.category === "entities" ? "👤 Entity" 
                                 : note.category === "bestiary" ? "🐉 Bestiary" 
                                 : note.category === "systems" ? "⚙️ System" 
                                 : note.category === "items" ? "🧳 Item" 
                                 : note.category === "maps" ? "🗺️ Map" 
                                 : note.category === "lore" ? "📜 Lore / Archive" 
                                 : note.category === "glossary" ? "📒 Glossary" 
                                 : "📝 General"}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground/80 font-serif leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          {note.images && note.images.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3 border-t border-border/20 pt-3">
                              {note.images.map((imgUrl, imgIdx) => (
                                <div 
                                  key={imgIdx} 
                                  onClick={() => {
                                    setLightboxImage(imgUrl);
                                    setIsLightboxOpen(true);
                                  }}
                                  className="relative w-16 h-16 border border-border/40 rounded overflow-hidden cursor-pointer hover:border-primary/50 transition-all bg-background"
                                >
                                  <img src={imgUrl} className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground/60 italic font-serif text-center py-10">No campaign notes match this filter.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </DockableTool>
        {/* TAB 7: COMPANION FAMILIAR */}
        <DockableTool id="familiar">
          <div className="space-y-4">

            {/* If no familiar exists or user clicked 'Add', render binding creation card */}
            {isAddingFamiliar || !character.familiars || character.familiars.length === 0 ? (
              <Card className="bg-card border-border/50 rounded-md max-w-3xl mx-auto shadow-md">
                <CardContent className="p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-border/30 pb-3">
                    <div>
                      <h3 className="font-serif text-2xl text-primary font-bold">Add Familiar</h3>
                      <p className="text-xs text-muted-foreground mt-1">Familiars share your adventure and can execute actions and attacks directly from your Hotbar.</p>
                    </div>
                    {character.familiars && character.familiars.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setIsAddingFamiliar(false)} className="rounded-md">Cancel</Button>
                    )}
                  </div>

                  <form onSubmit={handleBindFamiliar} className="space-y-4 text-xs">

                    {/* Basic specs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Familiar Name</label>
                        <Input value={famName} onChange={e => setFamName(e.target.value)} required placeholder="e.g. Rocky, Hedwig" className="bg-background rounded-md h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Species / Race</label>
                        <Input value={famRace} onChange={e => setFamRace(e.target.value)} placeholder="e.g. Golem, Aviary" className="bg-background rounded-md h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Rank</label>
                        <select 
                          value={famClassName} 
                          onChange={e => setFamClassName(e.target.value)} 
                          className="w-full h-8 bg-background border border-input rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="Iron">Iron</option>
                          <option value="Bronze">Bronze</option>
                          <option value="Silver">Silver</option>
                          <option value="Gold">Gold</option>
                          <option value="Diamond">Diamond</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Speed (Feet)</label>
                        <Input type="number" min={5} step={5} value={famSpeed} onChange={e => setFamSpeed(Number(e.target.value))} required className="bg-background rounded-md h-8 text-sm font-mono" />
                      </div>
                    </div>

                    {/* Resistances & Immunities */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/20 pt-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Resistances</label>
                        <Input value={famResistances} onChange={e => setFamResistances(e.target.value)} placeholder="e.g. Fire, Slashing" className="bg-background rounded-md h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Immunities</label>
                        <Input value={famImmunities} onChange={e => setFamImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background rounded-md h-8 text-sm" />
                      </div>
                    </div>

                    {/* Derived Formulas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-border/20 pt-4">
                      <div>
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">HP Math Formula</label>
                        <Input value={famHpFormula} onChange={e => setFamHpFormula(e.target.value)} placeholder="e.g. Vitality * 8" className="bg-background rounded-md h-8 text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">Mana Math Formula</label>
                        <Input value={famManaFormula} onChange={e => setFamManaFormula(e.target.value)} placeholder="e.g. Spirit * 5" className="bg-background rounded-md h-8 text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">DT Math Formula</label>
                        <Input value={famDtFormula} onChange={e => setFamDtFormula(e.target.value)} placeholder="e.g. Endurance * 1" className="bg-background rounded-md h-8 text-sm font-mono" />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="border-t border-border/20 pt-4">
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Attributes</h4>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: "POW", val: famPower, set: setFamPower },
                          { label: "VIT", val: famVitality, set: setFamVitality },
                          { label: "SPI", val: famSpirit, set: setFamSpirit },
                          { label: "AGI", val: famAgility, set: setFamAgility },
                          { label: "END", val: famEndurance, set: setFamEndurance },
                          { label: "PRE", val: famPrecision, set: setFamPrecision },
                          { label: "WIL", val: famWillpower, set: setFamWillpower },
                          { label: "CHA", val: famCharisma, set: setFamCharisma },
                        ].map(stat => (
                          <div key={stat.label} className="bg-background/40 p-2 border border-border/30 text-center rounded-md">
                            <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">{stat.label}</label>
                            <Input 
                              type="number" min={0} max={30} value={stat.val} 
                              onChange={e => stat.set(Math.min(30, Math.max(0, Number(e.target.value))))} 
                              className="text-center font-mono h-7 bg-background rounded-md text-xs" 
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border/20">
                      <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-md cursor-pointer">Add Familiar</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ) : (

              // Familiar display sheets
              <div className="space-y-6">

                {/* Toolbar */}
                <div className="flex justify-between items-center border-b border-border/20 pb-3">
                  <h3 className="font-serif text-2xl text-primary font-bold">Familiars ({character.familiars.length})</h3>
                  <Button onClick={() => setIsAddingFamiliar(true)} className="bg-primary text-primary-foreground font-serif rounded-md cursor-pointer">
                    <Plus className="w-4 h-4 mr-1.5" /> Add Familiar
                  </Button>
                </div>

                {/* Grid List of Familiars */}
                <div className="grid grid-cols-1 gap-6">
                  {character.familiars.map(fam => {
                    const fMax = getFamiliarMaxValues(fam);
                    const adjustedFamStats = getFamiliarAdjusted(fam).stats;
                    const isExpanded = expandedFamiliars[fam.id] ?? false;
                    const flash = famDtFlashes[fam.id] ?? null;
                    const inputs = famInputs[fam.id] || {};

                    return (
                      <Card id={`familiar-card-${fam.id}`} key={fam.id} data-dt-flash={flash ?? undefined} className="familiar-sheet bg-card border border-border/40 shadow-md rounded-none p-3.5">
                        <div className="familiar-sheet-layout">
                          <div className="familiar-summary">
                            <div className="familiar-identity flex items-center gap-3 min-w-0">
                            {/* Avatar Portrait Upload */}
                            <div className="relative group w-11 h-11 rounded-full overflow-hidden border border-border/60 bg-background flex-shrink-0 flex items-center justify-center cursor-pointer">
                              {fam.avatar ? (
                                <img src={fam.avatar} alt={fam.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-muted-foreground text-xs font-bold uppercase">{fam.name.substring(0, 2)}</span>
                              )}
                              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white font-bold cursor-pointer">
                                Change
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        const dataUrl = await compressImage(file, 200, 200);
                                        updateFamiliarData(fam.id, { ...fam, avatar: dataUrl });
                                        toast.success("Familiar portrait updated!");
                                      } catch (err) {
                                        toast.error("Failed to upload/compress image.");
                                      }
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-serif text-base text-primary font-bold">{fam.name}</h4>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                                {fam.race} · {fam.className} · {fMax.speed ?? fam.speed} ft
                              </p>
                              {(fam.resistances || fam.immunities) && (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground font-sans mt-1">
                                  {fam.resistances && (
                                    <span>
                                      <strong className="text-foreground uppercase tracking-wider text-[9px]">Resistances:</strong> {fam.resistances}
                                    </span>
                                  )}
                                  {fam.immunities && (
                                    <span>
                                      <strong className="text-foreground uppercase tracking-wider text-[9px]">Immunities:</strong> {fam.immunities}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                            <CompactResources stacked resources={[
                              { name: "DT", current: fam.currentDt, max: fMax.baseMaxDt, barMax: fMax.maxDt, color: "#eab308", temporary: fam.tempDt, bonus: fMax.maxDt - fMax.baseMaxDt, add: value => handleFamDtAdd(fam, value), remove: value => handleFamDtRemoveDirect(fam, value), temp: value => handleFamDtBuff(fam, value) },
                              { name: "HP", current: fam.currentHp, max: fMax.baseMaxHp, barMax: fMax.maxHp, color: "hsl(var(--destructive))", temporary: fam.tempHp, bonus: fMax.maxHp - fMax.baseMaxHp, add: value => handleFamHpAdd(fam, value), remove: value => handleFamHpRemove(fam, value), temp: value => handleFamHpBuff(fam, value) },
                              { name: "MP", current: fam.currentMana, max: fMax.baseMaxMana, barMax: fMax.maxMana, color: "#3b82f6", temporary: fam.tempMana, bonus: fMax.maxMana - fMax.baseMaxMana, add: value => handleFamManaAdd(fam, value), remove: value => handleFamManaRemove(fam, value), temp: value => handleFamManaBuff(fam, value) },
                            ]} />
                            <div className="familiar-actions flex items-center gap-2">
                            {/* Pulsing Red Damage Input Area */}
                            <div className="familiar-damage-action flex items-center border border-red-500/40 bg-red-950/20 rounded-md shadow-[0_0_8px_rgba(239,68,68,0.2)] animate-border-red-pulse z-10 overflow-hidden h-7">
                              <Input
                                type="number"
                                min="0"
                                value={inputs.damageAmount || ""}
                                onChange={e => updateFamInput(fam.id, "damageAmount", e.target.value)}
                                placeholder="Damage"
                                className="h-full border-0 bg-transparent rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-[10px] font-mono text-center w-20 text-foreground placeholder:text-red-500/70 placeholder:font-serif placeholder:font-bold placeholder:uppercase placeholder:tracking-wider"
                              />
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-full px-2.5 font-bold rounded-none bg-red-600 hover:bg-red-700 text-white font-serif border-l border-red-500/40 text-[10px] cursor-pointer"
                                onClick={() => handleFamApplyDamage(fam)}
                                disabled={!inputs.damageAmount}
                              >
                                Hit
                              </Button>
                            </div>

                            {/* Roll Initiative Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFamiliarStatRoll(fam.id, "agility", "Initiative", fam.agility)}
                              className="familiar-init-action h-7 px-2.5 border border-cyan-400/80 bg-cyan-950/80 text-cyan-200 hover:bg-cyan-900 font-bold font-serif text-[10px] rounded-md cursor-pointer flex items-center gap-1 shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all"
                              title="Roll Initiative (Agility Check)"
                              aria-label={`Roll ${fam.name} initiative`}
                            >
                              <Dice5 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                              <span>Roll Init</span>
                            </Button>

                            {/* Long Rest Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleFamFullRest(fam)}
                              className="familiar-rest-action h-7 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 font-bold font-serif rounded-md cursor-pointer text-[10px] px-2.5"
                              title="Take Long Rest"
                            >
                              Long Rest
                            </Button>
                          </div>
                          </div>
                          <Tabs value={isExpanded ? "abilities" : "stats"} onValueChange={value => setExpandedFamiliars(previous => ({ ...previous, [fam.id]: value === "abilities" }))} className="familiar-panels">
                            <div className="familiar-panel-heading">
                            <TabsList className="familiar-panel-tabs" aria-label={`${fam.name} details`}>
                              <TabsTrigger value="stats">Stats</TabsTrigger>
                              <TabsTrigger value="abilities">Abilities ({fam.abilities.length})</TabsTrigger>
                            </TabsList>
                            <div className="familiar-management flex flex-wrap items-center gap-2">
                              <EditFamiliarDialog characterId={id} familiar={fam} onSave={(updated) => updateFamiliarData(fam.id, updated)} />
                            <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-none cursor-pointer h-7 text-[10px] font-bold px-2" 
                              onClick={() => handleReleaseFamiliarClick(fam.id)}>
                              Release
                            </Button>
                            </div>
                            </div>
                            <TabsContent value="stats" className="familiar-stats-panel">
                              <div className="familiar-stat-section space-y-1.5">
                          <div className="familiar-stat-grid">
                            {STATS.map(stat => {
                              const val = (fam as any)[stat.key] as number;
                              const effectiveVal = adjustedFamStats[stat.key] ?? val;
                              const mod = getModifierForStat(effectiveVal, fam.className);
                              const trainingKey = `${stat.key}Training`;
                              const trainVal = ((fam as any)[trainingKey] as number) || 0;
                              return (
                                <div key={stat.key} className="familiar-stat-card bg-card/60 border border-border/30 p-1.5 rounded-none flex flex-col justify-between space-y-1">
                                  {/* Stat Roll Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleFamiliarStatRoll(fam.id, stat.key, stat.label, effectiveVal)}
                                    className="hover:border-primary transition-all cursor-pointer text-center w-full"
                                    aria-label={`Roll ${fam.name} ${stat.label}`}
                                  >
                                    <div className="stat-input-label font-bold uppercase text-muted-foreground tracking-wider">{stat.label}</div>
                                    <div className="text-base font-bold font-serif text-primary leading-tight">{effectiveVal}</div>
                                    <div className="text-[8px] font-mono text-muted-foreground">({mod >= 0 ? `+${mod}` : mod})</div>
                                  </button>

                                  {/* Stat Training Bar matching Character Sheet styling */}
                                  <div className="stat-training border-t border-border/20 pt-1 flex flex-col gap-0.5 select-none">
                                    <div className="stat-training-heading font-mono">
                                      <span className="stat-training-label text-muted-foreground/80 uppercase">Train</span>
                                      <span className="stat-training-count text-primary font-bold">{trainVal}/{val}</span>
                                    </div>
                                    <div className="stat-training-controls">
                                      <div className="stat-training-progress bg-accent/40 h-1 rounded-none overflow-hidden">
                                        <div
                                          className="bg-primary h-full rounded-none transition-all"
                                          style={{ width: `${val > 0 ? Math.min(100, (trainVal / val) * 100) : 0}%` }}
                                        />
                                      </div>

                                      {/* +/- Grouped enclosed border buttons */}
                                      <div className="stat-training-buttons flex border border-border/50">
                                        <button
                                          type="button"
                                          aria-label={`Decrease ${fam.name} ${stat.label} training`}
                                          className="h-3.5 w-3.5 text-[9px] font-bold bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center"
                                          onClick={(e) => { e.stopPropagation(); handleFamStatTrain(fam, stat.key, "down"); }}
                                          disabled={val <= 0 && trainVal === 0}
                                        >
                                          -
                                        </button>
                                        <div className="h-3.5 w-[1px] bg-border/50" />
                                        <button
                                          type="button"
                                          aria-label={`Increase ${fam.name} ${stat.label} training`}
                                          className="h-3.5 w-3.5 text-[9px] font-bold bg-background/50 hover:bg-accent text-primary hover:text-primary-foreground cursor-pointer flex items-center justify-center"
                                          onClick={(e) => { e.stopPropagation(); handleFamStatTrain(fam, stat.key, "up"); }}
                                        >
                                          +
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                            </TabsContent>
                            <TabsContent value="abilities" className="familiar-abilities-panel">
                              {fam.abilities.length > 0 ? (
                                <div className="familiar-ability-list grid grid-cols-1 gap-3">
                                {fam.abilities.map((ab) => (
                                  <Card id={`fam-ability-card-${fam.id}-${ab.id}`} key={ab.id} className="bg-background border border-border/30 rounded-none relative">
                                    <CardContent className="p-2.5 space-y-1.5">
                                      <div className="flex justify-between items-start pr-1 flex-wrap gap-2">
                                        <div>
                                          <h6 className="font-serif text-xs font-bold text-primary flex items-center gap-1.5 flex-wrap">
                                            {ab.name}
                                            {ab.type && (
                                              <Badge className="bg-primary/10 border border-primary/30 text-primary text-[8px] font-bold uppercase tracking-wider rounded-none px-1.5 py-0.5">
                                                {ab.type}
                                              </Badge>
                                            )}
                                          </h6>
                                          <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                                            <Badge variant="outline" className="text-[8px] font-mono border-primary/20 text-primary rounded-none bg-background/50">{ab.cost} MP</Badge>
                                            {ab.cooldown ? <Badge variant="outline" className="text-[8px] font-mono border-border/50 text-muted-foreground rounded-none bg-background/50">{ab.cooldown}s CD</Badge> : null}
                                            <Badge variant="outline" className="text-[8px] font-mono border-border/50 text-muted-foreground rounded-none bg-background/50">{ab.range}</Badge>
                                            <Badge variant="outline" className="text-[8px] font-mono border-border/50 text-muted-foreground rounded-none bg-background/50">{ab.speed}</Badge>
                                            {ab.rollFormula && <Badge variant="outline" className="text-[8px] font-mono border-border/50 text-muted-foreground rounded-none bg-background/50">Formula: {ab.rollFormula}</Badge>}

                                            {/* Active Modifiers Summary Badges */}
                                            {(!ab.definition ? getAbilityActiveModifierBadges(ab, getFamiliarAdjusted(fam).stats) : []).map((b: ActiveModifierBadge, i: number) => (
                                              <span 
                                                key={i} 
                                                title={b.rawFormula ? `Formula: ${b.rawFormula}` : undefined}
                                                className={`text-[8px] font-mono px-1 py-0.2 rounded-none border transition-all ${
                                                  b.type === "stat" 
                                                    ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-bold"
                                                    : b.type.includes("add")
                                                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                                                    : b.type.includes("buff")
                                                    ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                                                    : b.type === "init"
                                                    ? "bg-purple-500/10 border-purple-500/40 text-purple-300 font-bold"
                                                    : "bg-orange-500/10 border-orange-500/40 text-orange-300"
                                                }`}
                                              >
                                                {b.label}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                        <Button
                                          size="sm"
                                          onClick={() => handleFamiliarAbilityRoll(fam, ab)}
                                          disabled={!!ab.definition && ["Always On", "When Triggered"].includes(ab.definition.durationType)}
                                          className="bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 h-6 font-serif text-[10px] rounded-none cursor-pointer px-2"
                                        >
                                          {ab.definition?.durationType === "Always On" ? "Always On" : ab.definition?.durationType === "When Triggered" ? "Triggered" : ab.definition && (fam.effectApplications ?? []).some(application => application.abilityId === ab.id && application.effectId === ab.definition!.id) ? "Deactivate" : "Activate"}
                                        </Button>
                                      </div>
                                      {ab.definition && <details><summary className="text-xs text-primary cursor-pointer">Ability Details</summary>{renderOwnedAbilityDetails(familiarAbilityAsAbility(ab), fam)}</details>}
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic py-3">No abilities assigned.</p>
                              )}
                            </TabsContent>
                          </Tabs>
                        </div>
                      </Card>
                    );
                  })}
                </div>

              </div>
            )}

          </div>
        </DockableTool>


      </div>

      {/* Styled Delete Warning Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Permanently Delete Character?
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-xs text-muted-foreground leading-relaxed">
            Are you absolutely sure you want to delete <strong className="text-foreground">{character.name}</strong>? This action is irreversible and all stats, inventory, abilities, and bound companions will be permanently deleted.
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-border/30">
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteOpen(false)} className="rounded-md font-bold">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => deleteChar.mutate({ id }, { onSuccess: () => setLocation("/grimoire") })} className="rounded-md font-bold">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Familiar Release Confirmation Dialog 1 */}
      <Dialog open={isReleaseConfirmOpen} onOpenChange={setIsReleaseConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Release Familiar?
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to release this familiar from your service?
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-border/30">
            <Button variant="ghost" size="sm" onClick={() => { setIsReleaseConfirmOpen(false); setReleasingFamId(null); }} className="rounded-md font-bold">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmFirstRelease} className="rounded-md font-bold">
              Yes, Release
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Familiar Release Confirmation Dialog 2 */}
      <Dialog open={isReleaseDoubleConfirmOpen} onOpenChange={setIsReleaseDoubleConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-destructive" /> Permanent Release Confirmation
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-xs text-muted-foreground leading-relaxed">
            Releasing this familiar is permanent and <strong className="text-foreground">cannot be undone</strong>. Are you absolutely certain you want to proceed?
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-border/30">
            <Button variant="ghost" size="sm" onClick={() => { setIsReleaseDoubleConfirmOpen(false); setReleasingFamId(null); }} className="rounded-md font-bold">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmSecondRelease} className="rounded-md font-bold">
              Yes, Permanently Release
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Slider Dialog */}
      <Dialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
        <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary font-bold flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Discard {discardItem?.name}?
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              How many of <strong className="text-foreground">{discardItem?.name}</strong> would you like to discard? (Current quantity: <span className="font-mono text-foreground font-bold">{discardItem?.quantity}</span>)
            </p>
            {discardItem && discardItem.quantity > 1 && (
              <div className="space-y-2">
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>1</span>
                  <span className="text-primary font-bold text-sm bg-primary/10 px-2 py-0.5 rounded">{discardCount}</span>
                  <span>{discardItem.quantity}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={discardItem.quantity}
                  value={discardCount}
                  onChange={(e) => setDiscardCount(Number(e.target.value))}
                  className="w-full accent-primary bg-background border border-border/60 rounded h-2 cursor-pointer"
                />
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-border/30 gap-3">
            <Button variant="destructive" size="sm" onClick={handleDiscardAll} className="rounded-md font-bold">
              Discard All Stack
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setIsDiscardOpen(false); setDiscardItem(null); }} className="rounded-md font-bold">
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirmDiscard} className="rounded-md font-bold bg-primary text-primary-foreground">
                Discard {discardCount}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Dialog */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="max-w-4xl bg-black/95 border-none p-0 flex items-center justify-center overflow-hidden">
          {lightboxImage && (
            <img src={lightboxImage} className="max-h-[85vh] max-w-full object-contain" alt="Lightbox Preview" />
          )}
        </DialogContent>
      </Dialog>

      </div>
    </div>
    </WorkspaceProvider>
  );
}
