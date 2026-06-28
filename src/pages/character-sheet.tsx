import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Shield, ArrowLeft, Loader2, Trash2, Heart, Dice5,
  RotateCcw, Swords, Sparkles, Plus, Edit2, Upload, Download,
  Coins, Package, Hammer, Layers, Flame, BookText, UserCheck, X,
  Palette, Clock
} from "lucide-react";
import { format } from "date-fns";

// Storage Hooks & Helpers
import {
  useGetCharacter, useUpdateCharacter, useDeleteCharacter, useApplyDamage,
  useCreateRoll, useListCharacterRolls,
  useListEquipment, useUpdateEquipment, useDeleteEquipment,
  useListCurrencies, useUpdateCurrency, useDeleteCurrency,
  useListInventory, useDeleteInventoryItem,
  useListEssences, useAddEssence, useDeleteEssence,
  useListAbilities, useUpdateAbility,
  useListSkills, useUpdateSkill,
  useListNotes, useCreateNote, useDeleteNote,
  getGetCharacterQueryKey, getListCharacterRollsQueryKey, getListNotesQueryKey
} from "@/hooks/useStorage";
import { 
  getAdjustedStats, getDiceLabel, exportCharacterJSON, importCharacterJSON, 
  Ability, Equipment, Skill, FavoriteSlot, Familiar, FamiliarAbility, evaluateFormula 
} from "@/lib/storage";

// Dialog Modals
import { EditCharacterDialog } from "@/components/dialogs/edit-character-dialog";
import { EditAbilitiesDialog } from "@/components/dialogs/edit-abilities-dialog";
import { EditSkillsDialog } from "@/components/dialogs/edit-skills-dialog";
import { EditInventoryDialog } from "@/components/dialogs/edit-inventory-dialog";
import { CustomizeToolDialog } from "@/components/dialogs/customize-tool-dialog";

const STATS = [
  { key: "power",     label: "POW", desc: "Physical strength & raw force" },
  { key: "vitality",  label: "VIT", desc: "Durability & stamina" },
  { key: "agility",   label: "AGI", desc: "Speed & reflexes" },
  { key: "endurance", label: "END", desc: "Resistance to pain & fatigue" },
  { key: "spirit",    label: "SPI", desc: "Magical energy & mana" },
  { key: "precision", label: "PRE", desc: "Accuracy & critical hits" },
  { key: "willpower", label: "WIL", desc: "Mental toughness & focus" },
  { key: "charisma",  label: "CHA", desc: "Presence & social ability" },
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
    <div className={`w-full bg-accent/50 h-2 rounded-none overflow-hidden relative ${isOverMax ? "ring-1 ring-amber-400/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]" : ""}`}>
      <div
        className={`h-full rounded-none transition-all duration-300 ${isOverMax ? "animate-pulse" : ""}`}
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

// Favorites Migration/Getter Helper
const getFavorites = (char: any, eq: any[], ab: any[]): (FavoriteSlot | null)[] => {
  if (char && char.favorites && Array.isArray(char.favorites) && char.favorites.length === 10) {
    return char.favorites;
  }
  const slots: (FavoriteSlot | null)[] = Array(10).fill(null);
  let idx = 0;
  eq.filter(e => e.equipped && e.assignedToQuickRolls).forEach(e => {
    if (idx < 10) slots[idx++] = { type: "weapon", targetId: e.id, label: e.name };
  });
  ab.filter(a => a.assignedToQuickRolls).forEach(a => {
    if (idx < 10) slots[idx++] = { type: "ability", targetId: a.id, label: a.name };
  });
  return slots;
};

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
  const updateChar = useUpdateCharacter();
  const deleteChar = useDeleteCharacter();
  const createRoll = useCreateRoll();
  const applyDamageMut = useApplyDamage();
  
  // Equipment mutators for toggling equipped/quick status
  const updateEq = useUpdateEquipment();
  const deleteEq = useDeleteEquipment();

  // Notes mutators
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();

  // Essences mutators
  const addEssence = useAddEssence();
  const deleteEssence = useDeleteEssence();

  // Skills mutator
  const updateSkillMut = useUpdateSkill();

  // Abilities mutator
  const updateAbilityMut = useUpdateAbility();

  // ── Tab State ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"stats" | "skills" | "inventory" | "essences" | "abilities" | "notes" | "familiar">("stats");

  // ── Resource state ────────────────────────────────────────
  const [hp, setHp] = useState<number | null>(null);
  const [mana, setMana] = useState<number | null>(null);
  const [currentDt, setCurrentDt] = useState<number | null>(null);

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

  // ── Long Rest State & Action ───────────────────────────────
  const [isLongRestConfirmOpen, setIsLongRestConfirmOpen] = useState(false);

  const handleLongRest = () => {
    updateChar.mutate({
      id,
      data: {
        currentHp: maxHp,
        currentDt: maxDt,
        currentMana: maxMana
      }
    }, {
      onSuccess: () => {
        const curHp = hp ?? character.currentHp;
        const curDt = currentDt ?? character.currentDt;
        const curMana = mana ?? character.currentMana;

        setHp(maxHp);
        setCurrentDt(maxDt);
        setMana(maxMana);

        createRoll.mutate({ id, data: { diceType: "hp-log", modifier: maxHp - curHp, label: "Long Rest (HP)" } });
        createRoll.mutate({ id, data: { diceType: "dt-log", modifier: maxDt - curDt, label: "Long Rest (DT)" } });
        createRoll.mutate({ id, data: { diceType: "mana-log", modifier: maxMana - curMana, label: "Long Rest (Mana)" } });
        
        toast.success("Long Rest completed. Vitals restored.");
        setIsLongRestConfirmOpen(false);
      }
    });
  };

  // ── Dedicated HUD Inputs State ─────────────────────────────
  const [hpAdd, setHpAdd] = useState("");
  const [hpRemove, setHpRemove] = useState("");
  const [hpBuff, setHpBuff] = useState("");

  const [dtAdd, setDtAdd] = useState("");
  const [dtRemove, setDtRemove] = useState("");
  const [dtBuff, setDtBuff] = useState("");

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

  // ── Familiar Ability Creator ───────────────────────────────
  const [isAddingFamAbility, setIsAddingFamAbility] = useState<Record<string | number, boolean>>({});
  const [famAbilityName, setFamAbilityName] = useState("");
  const [famAbilityDesc, setFamAbilityDesc] = useState("");
  const [famAbilityCost, setFamAbilityCost] = useState(0);
  const [famAbilityFormula, setFamAbilityFormula] = useState("");

  // ── Notes Filter & Search ──────────────────────────────────
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteCategoryFilter, setNoteCategoryFilter] = useState("all");

  // ── Favorites Hotbar State ─────────────────────────────────
  const [assigningSlotIndex, setAssigningSlotIndex] = useState<number | null>(null);

  const [dtFlash, setDtFlash] = useState<"hit" | "restore" | null>(null);
  const [famDtFlash, setFamDtFlash] = useState<"hit" | "restore" | null>(null);
  const [damageResult, setDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);
  const [famDamageResult, setFamDamageResult] = useState<{ hpLost: number; absorbed: boolean } | null>(null);

  // ── Inventory Dialog Trigger State ────────────────────────
  const [isInvOpen, setIsInvOpen] = useState(false);
  const [invMode, setInvMode] = useState<"add" | "edit">("add");
  const [invType, setInvType] = useState<"currency" | "equipment" | "item">("item");
  const [invInitialData, setInvInitialData] = useState<any>(null);

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
  const [rollTab, setRollTab] = useState<"stats" | "dice" | "history">("stats");
  const [rollMod, setRollMod] = useState("0");
  const [rollLabel, setRollLabel] = useState("");
  const [rollingDice, setRollingDice] = useState<string | null>(null);
  
  const [critChain, setCritChain] = useState<{
    chainCount: number;
    chainDie: string;
    runningDiceTotal: number;
    modifier: number;
    label: string;
    lastRolledValue: number;
  } | null>(null);

  const [lastRoll, setLastRoll] = useState<{
    rawRoll: number;
    modifier: number;
    total: number;
    hadCrit: boolean;
    maxChainCount: number;
    diceType: string;
    label: string;
  } | null>(null);

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!character) return <div className="p-8 text-center text-muted-foreground">Character not found</div>;

  // ── Recalculate adjusted stats from equipment ─────────────
  const { stats: finalStats, modifiers: autoModifiers, diceLabels, maxHp, maxMana, maxDt } = getAdjustedStats(character, equipment, abilities);

  // ── Derived max values for familiar ───────────────────────
  const getFamiliarMaxValues = (fam: Familiar) => {
    const vars = {
      power: fam.power, pow: fam.power,
      vitality: fam.vitality, vit: fam.vitality,
      spirit: fam.spirit, spi: fam.spirit,
      agility: fam.agility, agi: fam.agility,
      endurance: fam.endurance, end: fam.endurance,
      precision: fam.precision, pre: fam.precision,
      willpower: fam.willpower, wil: fam.willpower,
      charisma: fam.charisma, cha: fam.charisma,
      dtbonus: fam.dtBonus
    };
    return {
      maxHp: Math.max(1, evaluateFormula(fam.hpFormula || "Vitality * 8", vars)),
      maxMana: Math.max(0, evaluateFormula(fam.manaFormula || "Spirit * 5", vars)),
      maxDt: Math.max(0, evaluateFormula(fam.dtFormula || "Endurance * 1", vars)),
    };
  };

  const getSlotDetails = (slot: FavoriteSlot) => {
    let name = slot.label;
    let costStr = "";
    let statStr = "";

    if (slot.type === "attribute") {
      name = STATS.find(s => s.key === slot.targetId)?.label || String(slot.targetId).toUpperCase();
      statStr = `${finalStats[slot.targetId as string] || 0} (${autoModifiers[slot.targetId as string] >= 0 ? "+" : ""}${autoModifiers[slot.targetId as string]})`;
    } else if (slot.type === "weapon") {
      const item = equipment.find(e => e.id === Number(slot.targetId));
      if (item) {
        name = item.name;
        costStr = item.modifier !== undefined ? `${item.modifier >= 0 ? "+" : ""}${item.modifier} Mod` : "";
        statStr = item.diceType || "d8";
      }
    } else if (slot.type === "ability") {
      const ability = abilities.find(a => a.id === Number(slot.targetId));
      if (ability) {
        name = ability.name;
        costStr = `${ability.cost} MP`;
        statStr = ability.linkedStat ? String(ability.linkedStat).toUpperCase().substring(0, 3) : "SPI";
      }
    } else if (slot.type === "skill") {
      const skill = skills.find(s => s.id === Number(slot.targetId));
      if (skill) {
        name = skill.name;
        costStr = `Val: ${skill.value}`;
        statStr = `+${Math.floor(skill.value / 3) + skill.training}`;
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
          statStr = ab.rollFormula ? "Formula" : "";
        }
      }
    }

    return { name, costStr, statStr };
  };

  // famMax is calculated dynamically per-familiar

  // ── HP Adjustments ────────────────────────────────────────
  const handleHpAdd = () => {
    const amount = parseInt(hpAdd);
    if (isNaN(amount) || amount <= 0) return;
    const cur = hp ?? character.currentHp;
    const next = Math.min(maxHp, cur + amount);
    setHp(next);
    setHpAdd("");
    updateChar.mutate({ id, data: { currentHp: next } });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: next - cur, label: "Healed HP" } });
  };

  const handleHpRemove = () => {
    const amount = parseInt(hpRemove);
    if (isNaN(amount) || amount <= 0) return;
    const cur = hp ?? character.currentHp;
    const next = Math.max(0, cur - amount);
    setHp(next);
    setHpRemove("");
    updateChar.mutate({ id, data: { currentHp: next } });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: next - cur, label: "Direct DMG (HP)" } });
  };

  const handleHpBuff = () => {
    const amount = parseInt(hpBuff);
    if (isNaN(amount) || amount <= 0) return;
    const cur = hp ?? character.currentHp;
    const next = cur + amount;
    setHp(next);
    setHpBuff("");
    updateChar.mutate({ id, data: { currentHp: next } });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: amount, label: "Buffed HP" } });
  };

  const handleFullRestoreHp = () => {
    const cur = hp ?? character.currentHp;
    setHp(maxHp);
    updateChar.mutate({ id, data: { currentHp: maxHp } });
    createRoll.mutate({ id, data: { diceType: "hp-log", modifier: maxHp - cur, label: "Full Restore HP" } });
  };

  // ── DT Adjustments ────────────────────────────────────────
  const handleApplyDamage = () => {
    const amount = parseInt(dtRemove);
    if (isNaN(amount) || amount <= 0) return;
    
    applyDamageMut.mutate({ id, data: { amount } }, {
      onSuccess: (data) => {
        setCurrentDt(data.newDt);
        setHp(data.newHp);
        setDamageResult({ hpLost: data.hpLost, absorbed: data.absorbed });
        setDtFlash("hit");
        setDtRemove("");
        setTimeout(() => setDtFlash(null), 600);
      }
    });
  };

  const handleDtAdd = () => {
    const amount = parseInt(dtAdd);
    if (isNaN(amount) || amount <= 0) return;
    const cur = currentDt ?? character.currentDt;
    const next = Math.min(maxDt, cur + amount);
    setCurrentDt(next);
    setDtAdd("");
    updateChar.mutate({ id, data: { currentDt: next } });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: next - cur, label: "Added DT" } });
  };

  const handleDtBuff = () => {
    const amount = parseInt(dtBuff);
    if (isNaN(amount) || amount <= 0) return;
    const cur = currentDt ?? character.currentDt;
    const next = cur + amount;
    setCurrentDt(next);
    setDtBuff("");
    updateChar.mutate({ id, data: { currentDt: next } });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: amount, label: "Buffed DT" } });
  };

  const handleRestoreDt = () => {
    const cur = currentDt ?? character.currentDt;
    setCurrentDt(maxDt);
    setDtFlash("restore");
    setDamageResult(null);
    setTimeout(() => setDtFlash(null), 600);
    updateChar.mutate({ id, data: { currentDt: maxDt } });
    createRoll.mutate({ id, data: { diceType: "dt-log", modifier: maxDt - cur, label: "Restore DT" } });
  };

  // ── Mana Adjustments ──────────────────────────────────────
  const handleManaAdd = () => {
    const amount = parseInt(manaAdd);
    if (isNaN(amount) || amount <= 0) return;
    const cur = mana ?? character.currentMana;
    const next = Math.min(maxMana, cur + amount);
    setMana(next);
    setManaAdd("");
    updateChar.mutate({ id, data: { currentMana: next } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: next - cur, label: "Restored Mana" } });
  };

  const handleManaRemove = () => {
    const amount = parseInt(manaRemove);
    if (isNaN(amount) || amount <= 0) return;
    const cur = mana ?? character.currentMana;
    const next = Math.max(0, cur - amount);
    setMana(next);
    setManaRemove("");
    updateChar.mutate({ id, data: { currentMana: next } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: next - cur, label: "Spent Mana" } });
  };

  const handleManaBuff = () => {
    const amount = parseInt(manaBuff);
    if (isNaN(amount) || amount <= 0) return;
    const cur = mana ?? character.currentMana;
    const next = cur + amount;
    setMana(next);
    setManaBuff("");
    updateChar.mutate({ id, data: { currentMana: next } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: amount, label: "Buffed Mana" } });
  };

  const handleFullRestoreMana = () => {
    const cur = mana ?? character.currentMana;
    setMana(maxMana);
    updateChar.mutate({ id, data: { currentMana: maxMana } });
    createRoll.mutate({ id, data: { diceType: "mana-log", modifier: maxMana - cur, label: "Full Restore Mana" } });
  };

  // ── Multiple Familiars Adjustments Mutator Helper ───────────
  const updateFamiliarData = (famId: string | number, updatedFam: Familiar | null) => {
    const list = character.familiars ? [...character.familiars] : [];
    if (updatedFam === null) {
      // Release familiar
      const filtered = list.filter(f => f.id !== famId);
      updateChar.mutate({ id, data: { familiars: filtered } });
      toast.success("Companion released.");
    } else {
      // Save familiar modifications
      const idx = list.findIndex(f => f.id === famId);
      if (idx !== -1) {
        list[idx] = updatedFam;
        updateChar.mutate({ id, data: { familiars: list } });
      }
    }
  };

  // ── Familiar HP Adjustments ───────────────────────────────
  const handleFamHpAdd = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.hpAdd || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const fMax = getFamiliarMaxValues(fam);
    const next = Math.min(fMax.maxHp, fam.currentHp + amount);
    updateFamiliarData(fam.id, { ...fam, currentHp: next });
    updateFamInput(fam.id, "hpAdd", "");
  };

  const handleFamHpRemove = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.hpRemove || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = Math.max(0, fam.currentHp - amount);
    updateFamiliarData(fam.id, { ...fam, currentHp: next });
    updateFamInput(fam.id, "hpRemove", "");
  };

  const handleFamHpBuff = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.hpBuff || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = fam.currentHp + amount;
    updateFamiliarData(fam.id, { ...fam, currentHp: next });
    updateFamInput(fam.id, "hpBuff", "");
  };

  const handleFamFullRestoreHp = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    updateFamiliarData(fam.id, { ...fam, currentHp: fMax.maxHp });
  };

  // ── Familiar DT Adjustments ───────────────────────────────
  const handleFamDtAdd = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.dtAdd || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const fMax = getFamiliarMaxValues(fam);
    const next = Math.min(fMax.maxDt, fam.currentDt + amount);
    updateFamiliarData(fam.id, { ...fam, currentDt: next });
    updateFamInput(fam.id, "dtAdd", "");
  };

  const handleFamDtRemove = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.dtRemove || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;

    let dtVal = fam.currentDt;
    let hpVal = fam.currentHp;
    let hpLost = 0;
    let absorbed = true;

    if (amount > dtVal) {
      hpLost = amount - dtVal;
      hpVal = Math.max(0, hpVal - hpLost);
      dtVal = 0;
      absorbed = false;
    } else {
      dtVal -= amount;
    }

    setFamDamageResults(prev => ({
      ...prev,
      [fam.id]: { hpLost, absorbed }
    }));
    
    setFamDtFlashes(prev => ({
      ...prev,
      [fam.id]: "hit"
    }));

    updateFamiliarData(fam.id, { ...fam, currentHp: hpVal, currentDt: dtVal });
    updateFamInput(fam.id, "dtRemove", "");
    
    setTimeout(() => {
      setFamDtFlashes(prev => ({
        ...prev,
        [fam.id]: null
      }));
    }, 600);
  };

  const handleFamDtBuff = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.dtBuff || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = fam.currentDt + amount;
    updateFamiliarData(fam.id, { ...fam, currentDt: next });
    updateFamInput(fam.id, "dtBuff", "");
  };

  const handleFamRestoreDt = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    setFamDtFlashes(prev => ({
      ...prev,
      [fam.id]: "restore"
    }));
    setFamDamageResults(prev => {
      const copy = { ...prev };
      delete copy[fam.id];
      return copy;
    });
    updateFamiliarData(fam.id, { ...fam, currentDt: fMax.maxDt });
    setTimeout(() => {
      setFamDtFlashes(prev => ({
        ...prev,
        [fam.id]: null
      }));
    }, 600);
  };

  // ── Familiar Mana Adjustments ─────────────────────────────
  const handleFamManaAdd = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.manaAdd || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const fMax = getFamiliarMaxValues(fam);
    const next = Math.min(fMax.maxMana, fam.currentMana + amount);
    updateFamiliarData(fam.id, { ...fam, currentMana: next });
    updateFamInput(fam.id, "manaAdd", "");
  };

  const handleFamManaRemove = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.manaRemove || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = Math.max(0, fam.currentMana - amount);
    updateFamiliarData(fam.id, { ...fam, currentMana: next });
    updateFamInput(fam.id, "manaRemove", "");
  };

  const handleFamManaBuff = (fam: Familiar) => {
    const inputVal = famInputs[fam.id]?.manaBuff || "";
    const amount = parseInt(inputVal);
    if (isNaN(amount) || amount <= 0) return;
    const next = fam.currentMana + amount;
    updateFamiliarData(fam.id, { ...fam, currentMana: next });
    updateFamInput(fam.id, "manaBuff", "");
  };

  const handleFamFullRestoreMana = (fam: Familiar) => {
    const fMax = getFamiliarMaxValues(fam);
    updateFamiliarData(fam.id, { ...fam, currentMana: fMax.maxMana });
  };

  // ── Delete character (Styled Trigger) ─────────────────────
  const handleDelete = () => {
    setIsDeleteOpen(true);
  };

  // ── Dice rolling handlers ─────────────────────────────────
  const handleRoll = (diceType: string, label?: string, statValue?: number, autoModifier?: number) => {
    const rollKey = label || diceType;
    const modifier = autoModifier !== undefined ? autoModifier : (parseInt(rollMod) || 0);
    setRollingDice(rollKey);
    setLastRoll(null);
    setCritChain(null);
    
    createRoll.mutate(
      { id, data: { diceType, modifier, label: label || rollLabel || diceType, ...(statValue !== undefined ? { statValue } : {}) } },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const chainDie = diceType.split("+").pop() ?? diceType;
            const lbl = label || rollLabel || diceType;
            
            if (wasCrit) {
              setCritChain({ chainCount: 0, chainDie, runningDiceTotal: rolled, modifier, label: lbl, lastRolledValue: rolled });
            } else {
              setLastRoll({ rawRoll: rolled, modifier, total: rolled + modifier, hadCrit: false, maxChainCount: -1, diceType, label: lbl });
            }
            setRollingDice(null);
          }, 600);
        },
        onError: () => setRollingDice(null),
      }
    );
  };

  const handleChainRoll = () => {
    if (!critChain) return;
    const { chainDie, runningDiceTotal, modifier, label, chainCount } = critChain;
    setRollingDice("chain");
    
    createRoll.mutate(
      { id, data: { diceType: chainDie, modifier: 0, label } },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            const newTotal = runningDiceTotal + rolled;
            
            if (wasCrit) {
              setCritChain({ chainCount: chainCount + 1, chainDie, runningDiceTotal: newTotal, modifier, label, lastRolledValue: rolled });
            } else {
              setCritChain(null);
              setLastRoll({ rawRoll: newTotal, modifier, total: newTotal + modifier, hadCrit: true, maxChainCount: chainCount, diceType: chainDie, label });
            }
            setRollingDice(null);
          }, 600);
        },
        onError: () => setRollingDice(null),
      }
    );
  };

  const handleStatRoll = (statKey: string, statLabel: string) => {
    const statValue = finalStats[statKey];
    const modifier = autoModifiers[statKey];
    handleRoll(diceLabels[statKey], `${statLabel} Roll`, statValue, modifier);
  };

  const handleSkillRoll = (skill: Skill) => {
    const modifier = Math.floor(skill.value / 3) + skill.modifier;
    handleRoll(getDiceLabel(skill.value), `${skill.name} Skill Roll`, undefined, modifier);
  };

  const handleWeaponRoll = (item: Equipment) => {
    const dice = item.diceType || "d8";
    const statMod = autoModifiers.power || 0;
    const flatMod = item.modifier || 0;
    const totalMod = statMod + flatMod;
    handleRoll(dice, `${item.name} Strike`, border => {}, totalMod);
  };

  const handleAbilityRoll = (ability: Ability) => {
    const curMana = mana ?? character.currentMana;
    if (curMana < ability.cost) {
      toast.error(`Not enough Mana! Requires ${ability.cost} MP (Have ${curMana} MP)`);
      return;
    }

    const nextMana = curMana - ability.cost;
    setMana(nextMana);
    updateChar.mutate({ id, data: { currentMana: nextMana } });

    if (ability.rollFormula) {
      const statKey = ability.linkedStat || "spirit";
      const mod = autoModifiers[statKey] || 0;
      handleRoll(ability.rollFormula, `${ability.name} Cast`, undefined, mod);
    } else {
      toast.success(`${ability.name} activated! (-${ability.cost} MP)`);
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

  // ── Familiar Rolls ────────────────────────────────────────
  const handleFamiliarStatRoll = (famId: string | number, statKey: string, statLabel: string, val: number) => {
    const mod = Math.floor(val / 3);
    const dice = getDiceLabel(val);
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
          familiarId: famId 
        } 
      },
      {
        onSuccess: (data) => {
          setTimeout(() => {
            const rolled = data.result ?? 0;
            const wasCrit = (data as any).isCrit ?? false;
            if (wasCrit) {
              setCritChain({ chainCount: 0, chainDie: dice, runningDiceTotal: rolled, modifier: mod, label: `Fam: ${statLabel} Roll`, lastRolledValue: rolled });
            } else {
              setLastRoll({ rawRoll: rolled, modifier: mod, total: rolled + mod, hadCrit: false, maxChainCount: -1, diceType: dice, label: `Fam: ${statLabel} Roll` });
            }
            setRollingDice(null);
          }, 600);
        },
        onError: () => setRollingDice(null)
      }
    );
  };

  const handleFamiliarAbilityRoll = (fam: Familiar, ability: FamiliarAbility) => {
    const curMana = fam.currentMana;
    if (curMana < ability.cost) {
      toast.error(`${fam.name} not enough Mana! Requires ${ability.cost} MP`);
      return;
    }
    const nextMana = curMana - ability.cost;
    updateFamiliarData(fam.id, { ...fam, currentMana: nextMana });

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
              const chainDie = ability.rollFormula.split("+").pop() ?? ability.rollFormula;
              if (wasCrit) {
                setCritChain({ chainCount: 0, chainDie, runningDiceTotal: rolled, modifier: 0, label: `Fam: ${ability.name} Cast`, lastRolledValue: rolled });
              } else {
                setLastRoll({ rawRoll: rolled, modifier: 0, total: rolled, hadCrit: false, maxChainCount: -1, diceType: ability.rollFormula, label: `Fam: ${ability.name} Cast` });
              }
              setRollingDice(null);
            }, 600);
          },
          onError: () => setRollingDice(null)
        }
      );
    } else {
      toast.success(`${fam.name} used ${ability.name}!`);
    }
  };

  // ── Favorites Hotbar Executer ─────────────────────────────
  const handleExecuteFavorite = (slot: FavoriteSlot) => {
    if (slot.type === "attribute") {
      const statLabel = STATS.find(s => s.key === slot.targetId)?.label || String(slot.targetId).toUpperCase();
      handleStatRoll(slot.targetId as string, statLabel);
    } else if (slot.type === "weapon") {
      const item = equipment.find(e => e.id === Number(slot.targetId));
      if (item) handleWeaponRoll(item);
      else toast.error("Weapon no longer equipped or found");
    } else if (slot.type === "ability") {
      const ability = abilities.find(a => a.id === Number(slot.targetId));
      if (ability) handleAbilityRoll(ability);
      else toast.error("Ability not found");
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

  const handleAssignFavorite = (slotIdx: number, type: FavoriteSlot["type"], targetId: string | number, label: string, familiarId?: string | number) => {
    const cur = [...getFavorites(character, equipment, abilities)];
    cur[slotIdx] = { type, targetId, label, familiarId };
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
      },
      {
        onSuccess: () => {
          setNoteTitle("");
          setNoteContent("");
          setNoteCat("general");
        }
      }
    );
  };

  // ── Stat & Skill Training (Direction Support) ──────────────
  const handleStatTrain = (statKey: string, direction: "up" | "down" = "up") => {
    const charStatValue = (character as any)[statKey] as number;
    const trainingKey = `${statKey}Training`;
    const curTraining = (character as any)[trainingKey] as number;

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
      const nextTraining = Math.max(0, curTraining - 1);
      updateChar.mutate({ id, data: { [trainingKey]: nextTraining } });
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
      const nextTraining = Math.max(0, skill.training - 1);
      updateSkillMut.mutate({ id: skill.id, data: { training: nextTraining } });
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

  const handleReleaseFamiliar = (famId: string | number) => {
    if (confirm("Release this familiar companion permanently?")) {
      updateFamiliarData(famId, null);
    }
  };

  const handleCreateFamAbility = (famId: string | number, e: React.FormEvent) => {
    e.preventDefault();
    const list = character.familiars ? [...character.familiars] : [];
    const fam = list.find(f => f.id === famId);
    if (!fam || !famAbilityName.trim()) return;

    const newAb: FamiliarAbility = {
      id: Date.now(),
      name: famAbilityName,
      description: famAbilityDesc,
      cost: famAbilityCost,
      cooldown: 0,
      range: "Melee",
      speed: "Standard",
      rollFormula: famAbilityFormula,
      linkedStat: "power",
      assignedToQuickRolls: false
    };

    const updated = {
      ...fam,
      abilities: [...(fam.abilities || []), newAb]
    };
    updateFamiliarData(famId, updated);
    setFamAbilityName("");
    setFamAbilityDesc("");
    setFamAbilityCost(0);
    setFamAbilityFormula("");
    setIsAddingFamAbility(prev => ({ ...prev, [famId]: false }));
    toast.success("Familiar ability added.");
  };

  const handleDeleteFamAbility = (famId: string | number, abId: number) => {
    const list = character.familiars ? [...character.familiars] : [];
    const fam = list.find(f => f.id === famId);
    if (!fam) return;

    const filtered = fam.abilities.filter(a => a.id !== abId);
    updateFamiliarData(famId, { ...fam, abilities: filtered });
    toast.success("Familiar ability removed.");
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

  const activeFavorites = getFavorites(character, equipment, abilities);

  // Notes Search filter computation
  const filteredNotes = notes.filter(n => {
    const matchSearch = noteSearchQuery.trim() === "" || 
      n.title.toLowerCase().includes(noteSearchQuery.toLowerCase()) || 
      n.content.toLowerCase().includes(noteSearchQuery.toLowerCase());
    const matchCat = noteCategoryFilter === "all" || n.category === noteCategoryFilter;
    return matchSearch && matchCat;
  });

  const tier = critChain ? CRIT_TIERS[Math.min(critChain.chainCount, CRIT_TIERS.length - 1)] : null;
  const finalTier = lastRoll?.hadCrit ? CRIT_TIERS[Math.min(lastRoll.maxChainCount, CRIT_TIERS.length - 1)] : null;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500 space-y-6">
      
      {/* ── Top Header Controls ── */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3 flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-muted-foreground hover:text-foreground rounded-none cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Button>
        <div className="flex items-center gap-2">
          <CustomizeToolDialog />
          <Button variant="outline" size="sm" onClick={() => exportCharacterJSON(id)} className="h-8 text-xs border-primary/40 text-primary rounded-none cursor-pointer">
            <Download className="w-3.5 h-3.5 mr-1" /> Export JSON
          </Button>
          <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-xs border-primary/40 text-primary rounded-none cursor-pointer">
            <Upload className="w-3.5 h-3.5 mr-1" /> Import JSON
          </Button>
          <EditCharacterDialog character={character} />
          <Button variant="destructive" size="icon" className="h-8 w-8 rounded-none cursor-pointer" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Double-Column Main Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

        {/* COLUMN 1: CHARACTER HUD (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="bg-card border-border/40 shadow-lg relative overflow-hidden rounded-none">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10" />
            
            <CardContent className="p-5 space-y-5">
              {/* Profile HUD Row */}
              <div className="flex justify-between items-center flex-wrap gap-4 border-b border-border/30 pb-3">
                <div>
                  <h1 className="text-3xl font-serif text-primary font-bold leading-tight">
                    {character.name}
                  </h1>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                    {character.race} · {character.rank}
                  </p>
                  {(character.resistances || character.immunities) && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-sans mt-2">
                      {character.resistances && (
                        <span>
                          <strong className="text-foreground uppercase tracking-wider text-[10px]">Resistances:</strong> {character.resistances}
                        </span>
                      )}
                      {character.immunities && (
                        <span>
                          <strong className="text-foreground uppercase tracking-wider text-[10px]">Immunities:</strong> {character.immunities}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Long Rest Confirmation Trigger */}
                <div className="flex items-center gap-3">
                  <Dialog open={isLongRestConfirmOpen} onOpenChange={setIsLongRestConfirmOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-bold font-serif rounded-md cursor-pointer text-xs">
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
                        Are you sure you want to take a Long Rest? This will fully restore your HP, DT, and Mana pools to their maximum values and record the logs.
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

                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Speed</div>
                  <div className="text-2xl font-serif text-foreground font-bold">{character.speed} ft</div>
                </div>
              </div>

              {/* Resource Management HUD grids */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. DT (Damage Threshold) - Ordered First */}
                <div className={`rounded-md border p-3 flex flex-col justify-between gap-3 transition-colors duration-200 ${
                  dtFlash === "hit" ? "border-destructive/70 bg-destructive/10"
                  : dtFlash === "restore" ? "border-primary/70 bg-primary/10"
                  : "border-border/40 bg-background/30"
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Shield className="w-4 h-4 text-primary" /> Damage Threshold
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${
                      dtFlash === "hit" ? "text-destructive" 
                      : currentDt && currentDt > maxDt ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" 
                      : "text-foreground"
                    }`}>
                      {currentDt ?? character.currentDt}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxDt}</span>
                  </div>
                  <ResourceBar current={currentDt ?? character.currentDt} max={maxDt} color={currentDt && currentDt > maxDt ? "#f59e0b" : "hsl(var(--primary))"} />
                  
                  {/* dt quick actions: add/remove/buff */}
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtAdd} placeholder="Add val"
                        onChange={e => setDtAdd(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleDtAdd} disabled={!dtAdd}>
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtRemove} placeholder="DMG Val"
                        onChange={e => { setDtRemove(e.target.value); setDamageResult(null); }}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleApplyDamage} disabled={!dtRemove || applyDamageMut.isPending}>
                        Hit
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={dtBuff} placeholder="Buff val"
                        onChange={e => setDtBuff(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleDtBuff} disabled={!dtBuff}>
                        Buff
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                      onClick={handleRestoreDt}>
                      Full Restore DT
                    </Button>
                    {/* Fixed Height Container to prevent layout shifts */}
                    <div className="h-4 flex items-center justify-center mt-1">
                      {damageResult && (
                        <p className="text-[10px] font-mono text-center text-destructive">
                          {damageResult.absorbed ? "✦ Absorbed" : "−1 DT"}
                        </p>
                      )}
                    </div>
                    {/* DT History Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full h-7 text-[9px] text-muted-foreground/60 border border-dashed border-border/20 hover:bg-accent/40 rounded-md cursor-pointer mt-1 font-mono">
                          <Clock className="w-3 h-3 mr-1" /> Log History
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[420px] max-h-[60vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
                        <DialogHeader>
                          <DialogTitle className="font-serif text-lg text-primary font-bold flex items-center gap-2 border-b border-border/20 pb-2">
                            <Clock className="w-4 h-4" /> DT Changes History
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-2 space-y-2">
                          {rolls && rolls.filter(r => r.diceType === "dt-log").length > 0 ? (
                            rolls.filter(r => r.diceType === "dt-log").slice(0, 15).map(r => (
                              <div key={r.id} className="flex justify-between items-center text-xs border-b border-border/10 py-1.5 font-mono">
                                <span className="text-muted-foreground">{r.label || "DT Update"}</span>
                                <div className="flex items-center gap-2">
                                  <span className={r.result >= 0 ? "text-green-500 font-bold" : "text-destructive font-bold"}>
                                    {r.result >= 0 ? `+${r.result}` : r.result}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/50">
                                    {format(new Date(r.rolledAt), "MMM d, HH:mm")}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground/50 italic text-center py-6">No DT history recorded.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* 2. HP (Health) - Ordered Second */}
                <div className="rounded-md border border-border/40 bg-background/30 p-3 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Heart className="w-4 h-4 text-destructive" /> Health (HP)
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${hp && hp > maxHp ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      {hp ?? character.currentHp}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxHp}</span>
                  </div>
                  <ResourceBar current={hp ?? character.currentHp} max={maxHp} color={hp && hp > maxHp ? "#f59e0b" : "hsl(var(--destructive))"} />
                  
                  {/* hp quick actions: add/remove/buff */}
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpAdd} placeholder="Heal val"
                        onChange={e => setHpAdd(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleHpAdd} disabled={!hpAdd}>
                        Heal
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpRemove} placeholder="Dmg val"
                        onChange={e => setHpRemove(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleHpRemove} disabled={!hpRemove}>
                        Dmg
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={hpBuff} placeholder="Buff val"
                        onChange={e => setHpBuff(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleHpBuff} disabled={!hpBuff}>
                        Buff
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                      onClick={handleFullRestoreHp}>
                      Full Restore HP
                    </Button>
                    {/* Fixed Height Container to prevent layout shifts */}
                    <div className="h-4 flex items-center justify-center mt-1">
                      {damageResult && damageResult.hpLost > 0 && (
                        <p className="text-[10px] font-mono text-center text-destructive">
                          −{damageResult.hpLost} HP
                        </p>
                      )}
                    </div>
                    {/* HP History Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full h-7 text-[9px] text-muted-foreground/60 border border-dashed border-border/20 hover:bg-accent/40 rounded-md cursor-pointer mt-1 font-mono">
                          <Clock className="w-3 h-3 mr-1" /> Log History
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[420px] max-h-[60vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
                        <DialogHeader>
                          <DialogTitle className="font-serif text-lg text-primary font-bold flex items-center gap-2 border-b border-border/20 pb-2">
                            <Clock className="w-4 h-4" /> Health Changes History
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-2 space-y-2">
                          {rolls && rolls.filter(r => r.diceType === "hp-log").length > 0 ? (
                            rolls.filter(r => r.diceType === "hp-log").slice(0, 15).map(r => (
                              <div key={r.id} className="flex justify-between items-center text-xs border-b border-border/10 py-1.5 font-mono">
                                <span className="text-muted-foreground">{r.label || "HP Update"}</span>
                                <div className="flex items-center gap-2">
                                  <span className={r.result >= 0 ? "text-green-500 font-bold" : "text-destructive font-bold"}>
                                    {r.result >= 0 ? `+${r.result}` : r.result}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/50">
                                    {format(new Date(r.rolledAt), "MMM d, HH:mm")}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground/50 italic text-center py-6">No Health history recorded.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* 3. Mana (MP) - Ordered Third */}
                <div className="rounded-md border border-border/40 bg-background/30 p-3 flex flex-col justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-blue-400" /> Mana (MP)
                  </div>
                  <div className="text-center py-1">
                    <span className={`text-4xl font-mono font-bold ${mana && mana > maxMana ? "text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]" : "text-foreground"}`}>
                      {mana ?? character.currentMana}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono"> /{maxMana}</span>
                  </div>
                  <ResourceBar current={mana ?? character.currentMana} max={maxMana} color={mana && mana > maxMana ? "#f59e0b" : "#3b82f6"} />
                  
                  {/* mana quick actions: add/remove/buff */}
                  <div className="space-y-2 mt-1">
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaAdd} placeholder="Add val"
                        onChange={e => setManaAdd(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleManaAdd} disabled={!manaAdd}>
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaRemove} placeholder="Use val"
                        onChange={e => setManaRemove(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleManaRemove} disabled={!manaRemove}>
                        Use
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input
                        type="number" min="0" value={manaBuff} placeholder="Buff val"
                        onChange={e => setManaBuff(e.target.value)}
                        className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                      />
                      <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                        onClick={handleManaBuff} disabled={!manaBuff}>
                        Buff
                      </Button>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                      onClick={handleFullRestoreMana}>
                      Full Restore Mana
                    </Button>
                    {/* Fixed Height Container to prevent layout shifts */}
                    <div className="h-4 mt-1" />
                    {/* Mana History Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full h-7 text-[9px] text-muted-foreground/60 border border-dashed border-border/20 hover:bg-accent/40 rounded-md cursor-pointer mt-1 font-mono">
                          <Clock className="w-3 h-3 mr-1" /> Log History
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[420px] max-h-[60vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
                        <DialogHeader>
                          <DialogTitle className="font-serif text-lg text-primary font-bold flex items-center gap-2 border-b border-border/20 pb-2">
                            <Clock className="w-4 h-4" /> Mana Changes History
                          </DialogTitle>
                        </DialogHeader>
                        <div className="py-2 space-y-2">
                          {rolls && rolls.filter(r => r.diceType === "mana-log").length > 0 ? (
                            rolls.filter(r => r.diceType === "mana-log").slice(0, 15).map(r => (
                              <div key={r.id} className="flex justify-between items-center text-xs border-b border-border/10 py-1.5 font-mono">
                                <span className="text-muted-foreground">{r.label || "Mana Update"}</span>
                                <div className="flex items-center gap-2">
                                  <span className={r.result >= 0 ? "text-green-500 font-bold" : "text-destructive font-bold"}>
                                    {r.result >= 0 ? `+${r.result}` : r.result}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/50">
                                    {format(new Date(r.rolledAt), "MMM d, HH:mm")}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground/50 italic text-center py-6">No Mana history recorded.</p>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* ── Custom Favorites Hotbar ── */}
          <Card className="bg-card/75 border-border/40 p-4 rounded-none shadow-md">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Favorites Hotbar
            </h3>
            
            {/* 10 Card Stacked Grid (5-on-5) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {activeFavorites.map((fav, index) => {
                if (fav) {
                  const details = getSlotDetails(fav);
                  return (
                    <div 
                      key={index} 
                      onClick={() => handleExecuteFavorite(fav)}
                      className="min-h-[72px] bg-background/60 hover:bg-accent/40 border border-primary/45 hover:border-primary transition-all relative flex flex-col justify-between cursor-pointer p-2.5 rounded-md group shadow-sm"
                      title={`Favorite #${index + 1}: ${fav.label}`}
                    >
                      {/* Delete Slot Button */}
                      <button
                        onClick={(e) => handleClearFavorite(index, e)}
                        className="absolute top-1.5 right-1.5 h-4.5 w-4.5 bg-destructive hover:bg-destructive/95 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md border border-border cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>

                      {/* Header slot ID + Type badge */}
                      <div className="flex justify-between items-center w-full">
                        <span className="text-[9px] font-mono text-muted-foreground/75 font-semibold">#{index + 1}</span>
                        <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-primary border border-primary/20 px-1 py-0.25 rounded bg-primary/5">
                          {fav.type === "weapon" ? "Weapon" : fav.type === "ability" ? "Spell" : fav.type === "skill" ? "Skill" : fav.type === "familiar-ability" ? "Fam Ab" : fav.type === "familiar-attribute" ? "Fam Stat" : "Stat"}
                        </span>
                      </div>

                      {/* Name Row */}
                      <div className="text-[11px] font-bold text-foreground truncate max-w-full leading-tight font-serif text-left mt-1">
                        {details.name}
                      </div>

                      {/* Footer Cost + Stat */}
                      <div className="flex justify-between items-center w-full mt-1.5 border-t border-border/20 pt-1 text-[9px] font-mono">
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
                      className="min-h-[72px] bg-background/20 hover:bg-accent/30 border border-dashed border-border/50 hover:border-primary/50 transition-all flex flex-col items-center justify-center cursor-pointer text-muted-foreground hover:text-primary rounded-md p-3 text-xs gap-1 shadow-sm"
                      title={`Click to assign Favorite #${index + 1}`}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[10px] font-mono">Assign #{index + 1}</span>
                    </button>
                  );
                }
              })}
            </div>

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

                  {/* Weapons */}
                  {equipment.filter(e => e.equipped).length > 0 && (
                    <div>
                      <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Equipped Weapons / Gear</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {equipment.filter(e => e.equipped).map(eq => (
                          <Button 
                            key={eq.id} variant="outline" size="sm" className="h-6 text-[10px] rounded-none font-serif"
                            onClick={() => handleAssignFavorite(assigningSlotIndex!, "weapon", eq.id, eq.name)}
                          >
                            {eq.name} {eq.diceType ? `(${eq.diceType})` : ""}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Shaped Spells */}
                  {abilities.length > 0 && (
                    <div>
                      <h4 className="font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border/10 pb-0.5">Shaped Spells</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {abilities.map(ab => (
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
        </div>

        {/* COLUMN 2: DICE HUD (1/3 width) */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border/40 shadow-lg relative overflow-hidden h-full rounded-none">
            <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            <CardContent className="p-4 flex flex-col gap-3 h-full justify-between">
              
              <div className="space-y-3">
                {/* Tabs */}
                <div className="flex gap-1 bg-background/50 rounded-none p-1 border border-border/30">
                  <button
                    onClick={() => setRollTab("stats")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-none uppercase tracking-wider transition-all cursor-pointer ${
                      rollTab === "stats" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Stats
                  </button>
                  <button
                    onClick={() => setRollTab("dice")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-none uppercase tracking-wider transition-all cursor-pointer ${
                      rollTab === "dice" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Dice
                  </button>
                  <button
                    onClick={() => setRollTab("history")}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded-none uppercase tracking-wider transition-all cursor-pointer ${
                      rollTab === "history" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    History
                  </button>
                </div>

                {/* Stats tab */}
                {rollTab === "stats" && (
                  <div className="grid grid-cols-4 gap-1.5">
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
                          title={`${stat.desc} — ${dice}`}
                          className={`rounded-none p-1 text-center border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isRolling ? "border-primary bg-primary/10 animate-pulse"
                            : "border-border/40 hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                          }`}
                        >
                          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{stat.label}</div>
                          <div className="text-xl font-serif text-foreground leading-tight">{value}</div>
                          <div className="text-[10px] font-mono text-primary">+{mod}</div>
                          <div className="text-[8px] font-mono text-muted-foreground/60">{dice}</div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Dice tab */}
                {rollTab === "dice" && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={rollLabel}
                        onChange={e => setRollLabel(e.target.value)}
                        placeholder="Label (optional)"
                        className="bg-background/50 border-border/50 text-xs h-7 flex-1 rounded-none"
                      />
                      <Input
                        type="number"
                        value={rollMod}
                        onChange={e => setRollMod(e.target.value)}
                        className="bg-background/50 border-border/50 text-center font-mono text-xs h-7 w-14 flex-shrink-0 rounded-none"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {(["d4","d6","d8","d10","d12","d20","d100"] as const).map(d => (
                        <Button
                          key={d}
                          variant="outline"
                          size="sm"
                          className={`font-mono font-bold text-xs h-8 rounded-none cursor-pointer ${rollingDice === d ? "animate-pulse bg-primary/20 border-primary" : "bg-background/50 hover:border-primary/50"}`}
                          disabled={!!rollingDice}
                          onClick={() => handleRoll(d)}
                        >
                          {d}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* History tab */}
                {rollTab === "history" && (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {loadingRolls ? (
                      <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                    ) : rolls && rolls.length > 0 ? (
                      <div className="divide-y divide-border/20">
                        {rolls.map(roll => (
                          <div key={roll.id} className="py-2 flex justify-between items-center hover:bg-accent/10 px-1 transition-colors">
                            <div>
                              <div className="font-semibold text-xs text-foreground flex items-center gap-1">
                                {roll.label || "Roll"}
                                {roll.isCrit && <span className="text-[8px] font-bold text-yellow-500 uppercase tracking-widest">crit</span>}
                              </div>
                              <div className="text-[9px] text-muted-foreground font-mono">
                                {roll.diceType}{roll.modifier ? (roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier) : ""}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-base font-serif font-bold ${roll.isCrit ? "text-yellow-500 animate-pulse" : "text-primary"}`}>{roll.total}</div>
                              <div className="text-[8px] text-muted-foreground/45">{format(new Date(roll.rolledAt), "HH:mm")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground font-serif italic">No rolls recorded yet.</div>
                    )}
                  </div>
                )}
              </div>

              {/* LCD-Style Dice HUD Roll Screen */}
              <div
                className="p-4 border-2 border-slate-700/60 rounded-md text-center flex flex-col items-center justify-center transition-all duration-500 min-h-[150px] mt-4 bg-[#0c100e] shadow-[inset_0_0_15px_rgba(0,0,0,0.95)] relative overflow-hidden group"
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
                  <div className="animate-in zoom-in duration-200 w-full font-mono text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.4)]">
                    <p className="text-[10px] uppercase tracking-[0.25em] mb-2 font-bold animate-pulse" style={{ color: tier!.color }}>
                      ✦ {tier!.name} — Crit #{critChain.chainCount + 1} ✦
                    </p>
                    <div className="mb-1">
                      <span className="text-[10px] text-emerald-500/60 block uppercase tracking-wider">Rolled</span>
                      <span className="text-4xl font-bold" style={{ color: tier!.color }}>{critChain.lastRolledValue}</span>
                      <span className="text-[10px] uppercase tracking-wider block mt-0.5" style={{ color: tier!.color + "aa" }}>
                        {critChain.chainDie} — Max!
                      </span>
                    </div>
                    <div className="my-1 px-3 py-0.5 rounded border border-emerald-950 bg-emerald-950/20 inline-block text-xs text-emerald-500/75">
                      Running: {critChain.runningDiceTotal}
                      {critChain.modifier !== 0 && <span className="text-emerald-400"> +{critChain.modifier}</span>}
                    </div>
                    <div className="mt-2">
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
                  <div className="animate-in zoom-in duration-300 w-full font-mono text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.4)]">
                    {lastRoll.hadCrit ? (
                      <p className="text-xs font-bold tracking-[0.25em] uppercase mb-2" style={{ color: finalTier?.color ?? "#ffd700" }}>
                        ✦ {finalTier?.name ?? "Critical"} Hit! ✦
                      </p>
                    ) : (
                      <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/60 mb-2 font-semibold">{lastRoll.label}</p>
                    )}
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
            </CardContent>
          </Card>
        </div>

      </div>

      {/* ── TABBED TOOL SCREEN BAR ── */}
      <div className="flex gap-1 border-b border-border/40 mt-6 overflow-x-auto pb-1 flex-wrap">
        {[
          { key: "stats", label: "Base & Training", icon: Hammer },
          { key: "skills", label: "Skills Log", icon: BookText },
          { key: "inventory", label: "Bag / Gear", icon: Coins },
          { key: "essences", label: "Essence Confluence", icon: Layers },
          { key: "abilities", label: "Abilities", icon: Flame },
          { key: "notes", label: "Campaign Notes", icon: BookText },
          { key: "familiar", label: "Companion Familiar", icon: UserCheck }
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              variant="ghost"
              onClick={() => setActiveTab(tab.key as any)}
              className={`rounded-none border-b-2 font-serif text-sm px-4 py-2 flex items-center gap-1.5 h-10 cursor-pointer ${
                isActive ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      {/* ── ACTIVE TOOL SCREEN AREA ── */}
      <div className="mt-4 animate-in fade-in duration-300">

        {/* TAB 1: STATS & TRAINING (Base Stats Only) */}
        {activeTab === "stats" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(stat => {
              const baseValue = (character as any)[stat.key] as number;
              const trainingKey = `${stat.key}Training`;
              const curTraining = (character as any)[trainingKey] as number;

              return (
                <Card key={stat.key} className="bg-card border-border/50 shadow-sm flex flex-col justify-between rounded-none">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</h4>
                        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1">{stat.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between py-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-serif font-bold text-foreground">{baseValue}</span>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground/60">{getDiceLabel(baseValue)}</span>
                    </div>

                    {/* Stat training tracker */}
                    <div className="border-t border-border/30 pt-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-muted-foreground uppercase">Training Points</span>
                        <span className="text-primary font-bold">{curTraining}/{baseValue}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 bg-accent/40 h-1.5 rounded-none overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-none transition-all"
                            style={{ width: `${Math.min(100, (curTraining / baseValue) * 100)}%` }}
                          />
                        </div>
                        
                        {/* +/- Increment/Decrement group */}
                        <div className="flex border border-border/50">
                          <button
                            className="h-6 w-6 text-xs font-bold bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            onClick={() => handleStatTrain(stat.key, "down")}
                            disabled={curTraining === 0}
                          >
                            -
                          </button>
                          <div className="h-6 w-[1px] bg-border/50" />
                          <button
                            className="h-6 w-6 text-xs font-bold bg-background/50 hover:bg-accent text-primary hover:text-primary-foreground cursor-pointer"
                            onClick={() => handleStatTrain(stat.key, "up")}
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
        )}

        {/* TAB 2: SKILLS (Card click rolls) */}
        {activeTab === "skills" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <h3 className="text-lg font-serif text-primary font-bold">Skills Log</h3>
              <EditSkillsDialog characterId={id} />
            </div>

            {skills && skills.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {skills.map((skill) => (
                  <Card 
                    key={skill.id} 
                    onClick={() => handleSkillRoll(skill)}
                    className="bg-card border-border/50 hover:border-primary/60 transition-all cursor-pointer rounded-none flex flex-col justify-between group"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-serif text-lg font-bold text-foreground group-hover:text-primary transition-colors">{skill.name}</h4>
                        <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-background/40 rounded-none">{getDiceLabel(skill.value)}</Badge>
                      </div>

                      <div className="flex items-baseline gap-1 py-1">
                        <span className="text-3xl font-serif text-foreground font-bold">{skill.value}</span>
                        <span className="text-xs font-mono text-primary font-bold">+{Math.floor(skill.value / 3)}</span>
                      </div>

                      {/* Skill training */}
                      <div className="border-t border-border/30 pt-3 flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-muted-foreground uppercase">Skill Training</span>
                          <span className="text-primary font-bold">{skill.training}/{skill.value}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 bg-accent/40 h-1.5 rounded-none overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-none transition-all"
                              style={{ width: `${Math.min(100, (skill.training / skill.value) * 100)}%` }}
                            />
                          </div>
                          
                          {/* +/- training buttons */}
                          <div className="flex border border-border/50">
                            <button
                              className="h-6 w-6 text-xs font-bold bg-background/50 hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              onClick={() => handleSkillTrain(skill, "down")}
                              disabled={skill.training === 0}
                            >
                              -
                            </button>
                            <div className="h-6 w-[1px] bg-border/50" />
                            <button
                              className="h-6 w-6 text-xs font-bold bg-background/50 hover:bg-accent text-primary hover:text-primary-foreground cursor-pointer"
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
            ) : (
              <div className="text-center py-10 bg-card/30 border border-dashed border-border/40 rounded-none text-sm text-muted-foreground/60 italic font-serif">
                No custom skills added yet. Tap "Edit Skills" to register skills.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: INVENTORY */}
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            
            {/* Currencies */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-primary" /> Currencies
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2 rounded-none cursor-pointer" onClick={() => triggerAddInventory("currency")}>
                  [Add]
                </Button>
              </div>

              {currencies && currencies.length > 0 ? (
                <div className="space-y-2">
                  {currencies.map(c => (
                    <Card key={c.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all rounded-none">
                      <CardContent className="p-3 flex justify-between items-center">
                        <div className="font-serif font-semibold text-foreground">{c.name}</div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-lg text-primary">{c.amount}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground rounded-none cursor-pointer" onClick={() => triggerEditInventory("currency", c)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic font-serif text-center py-6">No currencies tracked.</p>
              )}
            </div>

            {/* Equipment */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Hammer className="w-4 h-4 text-primary" /> Equipment
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2 rounded-none cursor-pointer" onClick={() => triggerAddInventory("equipment")}>
                  [Add]
                </Button>
              </div>

              {equipment && equipment.length > 0 ? (
                <div className="space-y-2">
                  {equipment.map(eq => {
                    const bonusList = Object.entries(eq.statModifiers || {}).map(([stat, val]) => `${stat.toUpperCase()}: +${val}`);
                    if (eq.dtBonus > 0) bonusList.push(`DT: +${eq.dtBonus}`);
                    
                    return (
                      <Card key={eq.id} className={`bg-card/50 border-border/40 transition-all rounded-none ${eq.equipped ? "border-primary/40 shadow-sm bg-primary/[0.01]" : ""}`}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-serif font-bold text-foreground flex items-center gap-1.5">
                                {eq.name}
                                {eq.equipped && <span className="text-[8px] bg-primary/10 border border-primary/30 text-primary px-1 rounded-none uppercase font-semibold">Equipped</span>}
                              </div>
                              <p className="text-[10px] text-muted-foreground/80 font-serif line-clamp-1 mt-0.5">{eq.description}</p>
                            </div>
                            
                            <div className="flex items-center gap-1">
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

                          <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={eq.equipped}
                                onChange={(e) => updateEq.mutate({ id: eq.id, data: { equipped: e.target.checked } })}
                                className="rounded-none border-border/50 h-3 w-3 accent-primary"
                              />
                              Equipped
                            </label>
                            {eq.diceType && (
                              <label className="flex items-center gap-1 cursor-pointer opacity-70">
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
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/30 pb-2">
                <h4 className="font-serif text-lg text-primary font-bold flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-primary" /> General Items
                </h4>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary px-2 rounded-none cursor-pointer" onClick={() => triggerAddInventory("item")}>
                  [Add]
                </Button>
              </div>

              {inventory && inventory.length > 0 ? (
                <div className="space-y-2">
                  {inventory.map(item => (
                    <Card key={item.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-all rounded-none">
                      <CardContent className="p-3 flex justify-between items-center">
                        <div>
                          <div className="font-serif font-semibold text-foreground">
                            {item.name} <span className="font-mono text-muted-foreground/80 font-normal">x{item.quantity}</span>
                          </div>
                          {item.description && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary rounded-none cursor-pointer" onClick={() => triggerEditInventory("item", item)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive rounded-none cursor-pointer" onClick={() => deleteEq.mutate({ id: item.id, charId: id })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
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
            />
          </div>
        )}

        {/* TAB 4: ESSENCE CONFLUENCE */}
        {activeTab === "essences" && (
          <div className="space-y-4">
            <h3 className="text-lg font-serif text-primary font-bold border-b border-border/20 pb-2">Essence Confluence</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(slot => {
                const essence = essences.find(e => e.slot === slot);
                const label = slot === 1 ? "First Essence" : slot === 2 ? "Second Essence" : slot === 3 ? "Third Essence" : "Confluence";
                
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
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive rounded-none cursor-pointer" onClick={() => deleteEssence.mutate({ id: essence.id, charId: id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>

                      {essence ? (
                        <div className="space-y-1">
                          <h4 className={`font-serif text-lg font-bold ${slot === 4 ? "text-amber-400" : "text-foreground"}`}>{essence.name}</h4>
                          <p className="text-xs text-muted-foreground/80 font-serif leading-relaxed line-clamp-3">{essence.description}</p>
                        </div>
                      ) : slot === 4 ? (
                        <p className="text-xs text-muted-foreground/60 italic font-serif py-4">
                          Attune essences 1-3 to unleash Confluence.
                        </p>
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
        )}

        {/* TAB 5: ABILITIES */}
        {activeTab === "abilities" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <h3 className="text-lg font-serif text-primary font-bold">Abilities</h3>
              <EditAbilitiesDialog characterId={id} />
            </div>

            {abilities && abilities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {abilities.map((ability) => (
                  <Card key={ability.id} className="bg-card border-border/50 rounded-md">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-serif text-xl font-bold text-primary leading-tight">{ability.name}</h4>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <Badge variant="outline" className="text-[9px] font-mono border-primary/20 text-primary rounded-md bg-background/50">{ability.cost} MP</Badge>
                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-md bg-background/50">{ability.range}</Badge>
                            <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground rounded-md bg-background/50">{ability.speed}</Badge>
                            
                            {/* Level Incrementer */}
                            <div className="flex items-center gap-1 border border-border/50 px-1.5 py-0.5 rounded-md bg-background/50 text-[10px] font-semibold text-foreground font-mono">
                              <span>Lvl: {ability.level || 1}</span>
                              <button 
                                type="button"
                                onClick={() => handleAbilityLevelChange(ability.id, "down")} 
                                className="w-3.5 h-3.5 flex items-center justify-center bg-accent hover:bg-accent/80 text-foreground rounded text-[9px] font-bold cursor-pointer ml-1"
                              >
                                -
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleAbilityLevelChange(ability.id, "up")} 
                                className="w-3.5 h-3.5 flex items-center justify-center bg-accent hover:bg-accent/80 text-foreground rounded text-[9px] font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleAbilityRoll(ability)}
                          className="bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 h-8 font-serif rounded-md cursor-pointer"
                        >
                          <Dice5 className="w-3.5 h-3.5 mr-1" /> Use Ability
                        </Button>
                      </div>

                      <div
                        className="text-xs text-muted-foreground font-serif leading-relaxed border-t border-border/30 pt-3 whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(ability.description) }}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-card/30 border border-dashed border-border/40 rounded-md text-sm text-muted-foreground/60 italic font-serif">
                No abilities registered yet. Click "Edit Abilities" to manage.
              </div>
            )}
          </div>
        )}

        {/* TAB 6: CAMPAIGN NOTES (Search and Thematic Filter) */}
        {activeTab === "notes" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              
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
                          <option value="location">PLACE / LOCATION</option>
                          <option value="npc">PERSON / NPC</option>
                          <option value="item">THING / ITEM</option>
                          <option value="lore">FACT / LORE</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Content</label>
                        <Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Write thoughts..." className="bg-background min-h-[120px] text-sm font-serif rounded-none" />
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
                    {["all", "general", "npc", "location", "item", "lore"].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setNoteCategoryFilter(cat)}
                        className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider border transition-all rounded-none cursor-pointer ${
                          noteCategoryFilter === cat 
                            ? "bg-primary border-primary text-primary-foreground" 
                            : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/30"
                        }`}
                      >
                        {cat === "all" ? "All" : cat === "npc" ? "People" : cat === "location" ? "Places" : cat === "item" ? "Things" : cat === "lore" ? "Facts" : "Gen"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 pr-1 max-h-[460px]">
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
                                {note.category === "npc" ? "👤 Person / NPC" : note.category === "location" ? "📍 Place / Location" : note.category === "item" ? "📦 Thing / Item" : note.category === "lore" ? "📜 Fact / Lore" : "📝 General"}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground/80 font-serif leading-relaxed whitespace-pre-wrap">{note.content}</p>
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
        )}
        {/* TAB 7: COMPANION FAMILIAR */}
        {activeTab === "familiar" && (
          <div className="space-y-4">
            
            {/* If no familiar exists or user clicked 'Add', render binding creation card */}
            {isAddingFamiliar || !character.familiars || character.familiars.length === 0 ? (
              <Card className="bg-card border-border/50 rounded-md max-w-3xl mx-auto shadow-md">
                <CardContent className="p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-border/30 pb-3">
                    <div>
                      <h3 className="font-serif text-2xl text-primary font-bold">Add Companion Familiar</h3>
                      <p className="text-xs text-muted-foreground mt-1">Companions share your adventure and can execute actions and attacks directly from your Hotbar.</p>
                    </div>
                    {character.familiars && character.familiars.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setIsAddingFamiliar(false)} className="rounded-md">Cancel</Button>
                    )}
                  </div>

                  <form onSubmit={handleBindFamiliar} className="space-y-4 text-xs">
                    
                    {/* Basic specs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Companion Name</label>
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
                  <h3 className="font-serif text-2xl text-primary font-bold">Companion Familiars ({character.familiars.length})</h3>
                  <Button onClick={() => setIsAddingFamiliar(true)} className="bg-primary text-primary-foreground font-serif rounded-md cursor-pointer">
                    <Plus className="w-4 h-4 mr-1.5" /> Add Familiar
                  </Button>
                </div>

                {/* Grid List of Familiars */}
                <div className="grid grid-cols-1 gap-6">
                  {character.familiars.map(fam => {
                    const fMax = getFamiliarMaxValues(fam);
                    const isExpanded = expandedFamiliars[fam.id] ?? false;
                    const flash = famDtFlashes[fam.id] ?? null;
                    const dmgRes = famDamageResults[fam.id] ?? null;
                    const inputs = famInputs[fam.id] || {};
                    const isAddingAb = isAddingFamAbility[fam.id] ?? false;

                    return (
                      <Card key={fam.id} className="bg-card border border-border/40 shadow-md rounded-md p-5 space-y-4">
                        
                        {/* Title Banner */}
                        <div className="flex justify-between items-start flex-wrap gap-4 border-b border-border/20 pb-3">
                          <div>
                            <h4 className="font-serif text-xl text-primary font-bold">{fam.name}</h4>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                              {fam.race} · {fam.className} · {fam.speed} ft
                            </p>
                            {(fam.resistances || fam.immunities) && (
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-sans mt-2">
                                {fam.resistances && (
                                  <span>
                                    <strong className="text-foreground uppercase tracking-wider text-[10px]">Resistances:</strong> {fam.resistances}
                                  </span>
                                )}
                                {fam.immunities && (
                                  <span>
                                    <strong className="text-foreground uppercase tracking-wider text-[10px]">Immunities:</strong> {fam.immunities}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-md cursor-pointer h-8 text-xs font-bold" 
                            onClick={() => handleReleaseFamiliar(fam.id)}>
                            Release Companion
                          </Button>
                        </div>

                        {/* Resource HUD Columns (DT, HP, Mana) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          
                          {/* 1. DT (Damage Threshold) */}
                          <div className={`rounded-md border p-3 flex flex-col justify-between gap-3 transition-colors duration-200 bg-background/20 ${
                            flash === "hit" ? "border-destructive/70 bg-destructive/10"
                            : flash === "restore" ? "border-primary/70 bg-primary/10"
                            : "border-border/40"
                          }`}>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              <Shield className="w-4 h-4 text-primary" /> Companion DT
                            </div>
                            <div className="text-center py-1">
                              <span className={`text-4xl font-mono font-bold ${flash === "hit" ? "text-destructive" : "text-foreground"}`}>
                                {fam.currentDt}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono"> /{fMax.maxDt}</span>
                            </div>
                            <ResourceBar current={fam.currentDt} max={fMax.maxDt} color="hsl(var(--primary))" />
                            
                            <div className="space-y-2 mt-1">
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.dtAdd || ""} placeholder="Add val"
                                  onChange={e => updateFamInput(fam.id, "dtAdd", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamDtAdd(fam)} disabled={!inputs.dtAdd}>
                                  Add
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.dtRemove || ""} placeholder="DMG Val"
                                  onChange={e => { updateFamInput(fam.id, "dtRemove", e.target.value); setFamDamageResults(prev => ({ ...prev, [fam.id]: null })); }}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamDtRemove(fam)} disabled={!inputs.dtRemove}>
                                  Hit
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.dtBuff || ""} placeholder="Buff val"
                                  onChange={e => updateFamInput(fam.id, "dtBuff", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamDtBuff(fam)} disabled={!inputs.dtBuff}>
                                  Buff
                                </Button>
                              </div>
                              <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                                onClick={() => handleFamRestoreDt(fam)}>
                                Full Restore DT
                              </Button>
                              {/* Fixed Height Container to prevent layout shifts */}
                              <div className="h-4 flex items-center justify-center mt-1">
                                {dmgRes && (
                                  <p className={`text-[10px] font-mono text-center ${dmgRes.absorbed ? "text-primary" : "text-destructive"}`}>
                                    {dmgRes.absorbed ? "✦ Absorbed" : dmgRes.hpLost > 0 ? `−${dmgRes.hpLost} HP` : "DT hit"}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 2. HP (Health) */}
                          <div className="rounded-md border border-border/40 p-3 flex flex-col justify-between gap-3 bg-background/20">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              <Heart className="w-4 h-4 text-destructive" /> Companion HP
                            </div>
                            <div className="text-center py-1">
                              <span className="text-4xl font-mono font-bold text-foreground">
                                {fam.currentHp}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono"> /{fMax.maxHp}</span>
                            </div>
                            <ResourceBar current={fam.currentHp} max={fMax.maxHp} color="hsl(var(--destructive))" />
                            
                            <div className="space-y-2 mt-1">
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.hpAdd || ""} placeholder="Heal val"
                                  onChange={e => updateFamInput(fam.id, "hpAdd", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamHpAdd(fam)} disabled={!inputs.hpAdd}>
                                  Heal
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.hpRemove || ""} placeholder="Dmg val"
                                  onChange={e => updateFamInput(fam.id, "hpRemove", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamHpRemove(fam)} disabled={!inputs.hpRemove}>
                                  Dmg
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.hpBuff || ""} placeholder="Buff val"
                                  onChange={e => updateFamInput(fam.id, "hpBuff", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamHpBuff(fam)} disabled={!inputs.hpBuff}>
                                  Buff
                                </Button>
                              </div>
                              <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                                onClick={() => handleFamFullRestoreHp(fam)}>
                                Full Restore HP
                              </Button>
                              {/* Fixed Height placeholder to match DT layout height */}
                              <div className="h-4 mt-1" />
                            </div>
                          </div>

                          {/* 3. Mana (MP) */}
                          <div className="rounded-md border border-border/40 p-3 flex flex-col justify-between gap-3 bg-background/20">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                              <Sparkles className="w-4 h-4 text-blue-400" /> Companion Mana
                            </div>
                            <div className="text-center py-1">
                              <span className="text-4xl font-mono font-bold text-foreground">
                                {fam.currentMana}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono"> /{fMax.maxMana}</span>
                            </div>
                            <ResourceBar current={fam.currentMana} max={fMax.maxMana} color="#3b82f6" />
                            
                            <div className="space-y-2 mt-1">
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.manaAdd || ""} placeholder="Add val"
                                  onChange={e => updateFamInput(fam.id, "manaAdd", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-green-600/40 text-green-500 hover:bg-green-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamManaAdd(fam)} disabled={!inputs.manaAdd}>
                                  Add
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.manaRemove || ""} placeholder="Use val"
                                  onChange={e => updateFamInput(fam.id, "manaRemove", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="destructive" size="sm" className="h-7 text-xs px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamManaRemove(fam)} disabled={!inputs.manaRemove}>
                                  Use
                                </Button>
                              </div>
                              <div className="flex gap-1.5">
                                <Input
                                  type="number" min="0" value={inputs.manaBuff || ""} placeholder="Buff val"
                                  onChange={e => updateFamInput(fam.id, "manaBuff", e.target.value)}
                                  className="h-7 text-xs text-center font-mono flex-1 bg-background/50 border-border/50 px-1 rounded-md"
                                />
                                <Button variant="outline" size="sm" className="h-7 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 w-16 rounded-md cursor-pointer font-bold"
                                  onClick={() => handleFamManaBuff(fam)} disabled={!inputs.manaBuff}>
                                  Buff
                                </Button>
                              </div>
                              <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] text-muted-foreground border border-border/20 hover:bg-accent/50 mt-1 rounded-md cursor-pointer"
                                onClick={() => handleFamFullRestoreMana(fam)}>
                                Full Restore Mana
                              </Button>
                              {/* Fixed Height placeholder to match DT layout height */}
                              <div className="h-4 mt-1" />
                            </div>
                          </div>

                        </div>

                        {/* Companion Attributes */}
                        <div className="space-y-2 pt-2 border-t border-border/20">
                          <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Attributes (Click to Roll)</h5>
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {STATS.map(stat => {
                              const val = (fam as any)[stat.key] as number;
                              const mod = Math.floor(val / 3);
                              return (
                                <button
                                  type="button"
                                  key={stat.key}
                                  onClick={() => handleFamiliarStatRoll(fam.id, stat.key, stat.label, val)}
                                  className="rounded-md border border-border/30 bg-card/60 p-2 text-center hover:border-primary transition-all cursor-pointer"
                                >
                                  <div className="text-[9px] font-bold text-muted-foreground uppercase">{stat.label}</div>
                                  <div className="text-xl font-serif text-foreground font-bold mt-0.5">{val}</div>
                                  <div className="text-[10px] font-mono text-primary">+{mod}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Collapsible Abilities Drawer */}
                        <div className="pt-2 border-t border-border/20 space-y-3">
                          <div className="flex justify-between items-center">
                            <button
                              type="button"
                              onClick={() => setExpandedFamiliars(prev => ({ ...prev, [fam.id]: !isExpanded }))}
                              className="text-[11px] font-bold text-primary hover:text-primary-foreground hover:bg-primary/10 border border-primary/20 px-3 py-1 rounded-md transition-colors cursor-pointer"
                            >
                              {isExpanded ? "Hide Abilities & Actions" : "Show Abilities & Actions"}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                              
                              <div className="flex justify-between items-center border-b border-border/20 pb-1">
                                <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Attacks & Actions</h5>
                                <Button 
                                  size="sm" 
                                  className="bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 h-6 text-[10px] rounded-md cursor-pointer"
                                  onClick={() => setIsAddingFamAbility(prev => ({ ...prev, [fam.id]: !isAddingAb }))}
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Add Action
                                </Button>
                              </div>

                              {/* Add Action Form inside expansion */}
                              {isAddingAb && (
                                <Card className="bg-background border border-primary/20 rounded-md">
                                  <CardContent className="p-4 space-y-4">
                                    <h5 className="font-serif text-sm text-primary font-bold">New Action / Spell for {fam.name}</h5>
                                    <form onSubmit={(e) => handleCreateFamAbility(fam.id, e)} className="space-y-3 text-xs">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Name</label>
                                          <Input value={famAbilityName} onChange={e => setFamAbilityName(e.target.value)} required placeholder="e.g. Bite, Fire Spit" className="bg-background text-sm rounded-md h-8" />
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Cost (MP)</label>
                                          <Input type="number" min={0} value={famAbilityCost} onChange={e => setFamAbilityCost(Number(e.target.value))} required className="bg-background text-sm rounded-md h-8 font-mono" />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description</label>
                                        <Textarea value={famAbilityDesc} onChange={e => setFamAbilityDesc(e.target.value)} placeholder="Describe effect details..." className="bg-background text-sm font-serif rounded-md min-h-[60px]" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold text-primary uppercase block mb-1">Roll Formula (optional)</label>
                                        <Input value={famAbilityFormula} onChange={e => setFamAbilityFormula(e.target.value)} placeholder="e.g. d6 + 2, POW*2" className="bg-background text-sm rounded-md h-8 font-mono" />
                                      </div>
                                      <div className="flex justify-end gap-1.5 pt-2 border-t border-border/30">
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingFamAbility(prev => ({ ...prev, [fam.id]: false }))} className="rounded-md">Cancel</Button>
                                        <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-serif rounded-md">Save Action</Button>
                                      </div>
                                    </form>
                                  </CardContent>
                                </Card>
                              )}

                              {/* Action items list */}
                              {fam.abilities && fam.abilities.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {fam.abilities.map(ab => (
                                    <Card key={ab.id} className="bg-background border border-border/30 rounded-md relative group">
                                      <div className="absolute top-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-md cursor-pointer" onClick={() => handleDeleteFamAbility(fam.id, ab.id)}>
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                      <CardContent className="p-3.5 space-y-2">
                                        <div className="flex justify-between items-start pr-6">
                                          <div>
                                            <h6 className="font-serif text-sm font-bold text-primary">{ab.name}</h6>
                                            <div className="flex gap-1.5 mt-1">
                                              <Badge variant="outline" className="text-[8px] font-mono border-primary/20 text-primary rounded-md bg-background/50">{ab.cost} MP</Badge>
                                              {ab.rollFormula && <Badge variant="outline" className="text-[8px] font-mono border-border/50 text-muted-foreground rounded-md bg-background/50">Formula: {ab.rollFormula}</Badge>}
                                            </div>
                                          </div>
                                          <Button
                                            size="sm"
                                            onClick={() => handleFamiliarAbilityRoll(fam, ab)}
                                            className="bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 h-6 font-serif text-[10px] rounded-md cursor-pointer"
                                          >
                                            Execute
                                          </Button>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground/80 font-serif leading-relaxed mt-1.5 whitespace-pre-wrap">{ab.description}</p>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground/50 italic font-serif text-center py-2">No unique actions configured for {fam.name}.</p>
                              )}
                            </div>
                          )}
                        </div>

                      </Card>
                    );
                  })}
                </div>

              </div>
            )}

          </div>
        )}

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
            <Button variant="destructive" size="sm" onClick={() => deleteChar.mutate({ id }, { onSuccess: () => setLocation("/") })} className="rounded-md font-bold">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
