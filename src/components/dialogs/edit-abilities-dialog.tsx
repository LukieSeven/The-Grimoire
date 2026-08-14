import React, { useState, useEffect } from "react";
import { useListEssences, useAddAbility, useUpdateAbility, useDeleteAbility, useGetCharacter } from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Edit2, Trash2, Zap, Plus } from "lucide-react";
import { Ability, SubAbility, EvolutionModifier, AbilityEffect, AbilityTrigger, EVOLUTION_THRESHOLDS_TABLE, calculateAbilityEvolutions } from "@/lib/storage";

interface Props {
  characterId: number;
  abilities: Ability[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialAbilityId?: number | null;
}

const STAT_OPTIONS = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];

export function EditAbilitiesDialog({ characterId, abilities, open, onOpenChange, initialAbilityId }: Props) {
  const { data: essences } = useListEssences(characterId);
  const { data: character } = useGetCharacter(characterId);
  const addAbility = useAddAbility();
  const updateAbility = useUpdateAbility();
  const deleteAbility = useDeleteAbility();

  const [internalOpen, setInternalOpen] = useState(false);
  const isDialogOpen = open !== undefined ? open : internalOpen;
  const setDialogOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    setInternalOpen(v);
  };

  const playerAbilities = abilities.filter(a => !a.equipmentId && !a.inventoryItemId);

  // Mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [range, setRange] = useState("");
  const [speed, setSpeed] = useState("");
  const [rollFormula, setRollFormula] = useState("");
  const [type, setType] = useState("");
  const [primaryStat, setPrimaryStat] = useState("power");
  const [evolutionModifiers, setEvolutionModifiers] = useState<EvolutionModifier[]>([]);
  const [subAbilities, setSubAbilities] = useState<SubAbility[]>([]);
  const [abilityEffects, setAbilityEffects] = useState<AbilityEffect[]>([]);
  const [triggers, setTriggers] = useState<AbilityTrigger[]>([]);
  const [expandedMods, setExpandedMods] = useState<Record<number, boolean>>({});
  const [linkedStats, setLinkedStats] = useState<string[]>([]);
  const [assignedToQuickRolls, setAssignedToQuickRolls] = useState(false);
  const [assignedToMechanicsTracker, setAssignedToMechanicsTracker] = useState(false);
  const [essenceId, setEssenceId] = useState<number | null>(null);
  const [isInnatePassive, setIsInnatePassive] = useState<boolean>(false);
  const [resistances, setResistances] = useState("");
  const [immunities, setImmunities] = useState("");

  // Bonus states (support numbers or formula strings like '2+wil')
  const [bonusPower, setBonusPower] = useState<string | number>("");
  const [bonusVitality, setBonusVitality] = useState<string | number>("");
  const [bonusSpirit, setBonusSpirit] = useState<string | number>("");
  const [bonusAgility, setBonusAgility] = useState<string | number>("");
  const [bonusEndurance, setBonusEndurance] = useState<string | number>("");
  const [bonusPrecision, setBonusPrecision] = useState<string | number>("");
  const [bonusWillpower, setBonusWillpower] = useState<string | number>("");
  const [bonusCharisma, setBonusCharisma] = useState<string | number>("");
  const [hpAdd, setHpAdd] = useState<string | number>("");
  const [hpBuff, setHpBuff] = useState<string | number>("");
  const [manaAdd, setManaAdd] = useState<string | number>("");
  const [manaBuff, setManaBuff] = useState<string | number>("");
  const [dtAdd, setDtAdd] = useState<string | number>("");
  const [dtBuff, setDtBuff] = useState<string | number>("");
  const [bonusInitiative, setBonusInitiative] = useState<string | number>("");

  const resetForm = () => {
    setName("");
    setNickname("");
    setDescription("");
    setCost(0);
    setCooldown(0);
    setRange("");
    setSpeed("");
    setRollFormula("");
    setType("");
    setPrimaryStat("power");
    setEvolutionModifiers([]);
    setSubAbilities([]);
    setAbilityEffects([]);
    setTriggers([]);
    setExpandedMods({});
    setLinkedStats([]);
    setAssignedToQuickRolls(false);
    setAssignedToMechanicsTracker(false);
    setEssenceId(null);
    setIsInnatePassive(false);
    setResistances("");
    setImmunities("");
    setBonusPower("");
    setBonusVitality("");
    setBonusSpirit("");
    setBonusAgility("");
    setBonusEndurance("");
    setBonusPrecision("");
    setBonusWillpower("");
    setBonusCharisma("");
    setHpAdd("");
    setHpBuff("");
    setManaAdd("");
    setManaBuff("");
    setDtAdd("");
    setDtBuff("");
    setBonusInitiative("");
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setMode("add");
  };

  const handleOpenEdit = (ability: any) => {
    setEditingId(ability.id);
    setName(ability.name);
    setNickname(ability.nickname || "");
    setDescription(ability.description);
    setCost(ability.cost);
    setCooldown(ability.cooldown);
    setRange(ability.range);
    setSpeed(ability.speed);
    setRollFormula(ability.rollFormula);
    setType(ability.type || "");
    setPrimaryStat(ability.primaryStat || "power");
    setEvolutionModifiers(ability.evolutionModifiers ? [...ability.evolutionModifiers] : []);
    setSubAbilities(ability.subAbilities ? [...ability.subAbilities] : []);
    setAbilityEffects(ability.abilityEffects ? [...ability.abilityEffects] : []);
    setTriggers(ability.triggers ? [...ability.triggers] : []);
    setLinkedStats(ability.linkedStats || (ability.linkedStat ? [ability.linkedStat] : []));
    setAssignedToQuickRolls(!!ability.assignedToQuickRolls);
    setAssignedToMechanicsTracker(!!ability.assignedToMechanicsTracker);
    const isIp = !!(ability.isInnatePassive || ability.essenceId === -1 || ability.type === "Innate Passive");
    setIsInnatePassive(isIp);
    setEssenceId(isIp ? null : (ability.essenceId || null));
    setResistances(ability.resistances || "");
    setImmunities(ability.immunities || "");
    setBonusPower(ability.bonusPower ?? "");
    setBonusVitality(ability.bonusVitality ?? "");
    setBonusSpirit(ability.bonusSpirit ?? "");
    setBonusAgility(ability.bonusAgility ?? "");
    setBonusEndurance(ability.bonusEndurance ?? "");
    setBonusPrecision(ability.bonusPrecision ?? "");
    setBonusWillpower(ability.bonusWillpower ?? "");
    setBonusCharisma(ability.bonusCharisma ?? "");
    setHpAdd(ability.hpAdd ?? "");
    setHpBuff(ability.hpBuff ?? "");
    setManaAdd(ability.manaAdd ?? "");
    setManaBuff(ability.manaBuff ?? "");
    setDtAdd(ability.dtAdd ?? "");
    setDtBuff(ability.dtBuff ?? "");
    setBonusInitiative(ability.bonusInitiative ?? "");
    setMode("edit");
  };

  useEffect(() => {
    if (initialAbilityId) {
      const target = abilities.find(a => a.id === initialAbilityId);
      if (target) {
        handleOpenEdit(target);
      }
    }
  }, [initialAbilityId, abilities]);

  const handleAddEvolutionModifier = () => {
    const nextIdx = evolutionModifiers.length;
    if (nextIdx >= EVOLUTION_THRESHOLDS_TABLE.length) {
      toast.error("Maximum of 24 Evolution Modifier slots reached.");
      return;
    }
    const info = EVOLUTION_THRESHOLDS_TABLE[nextIdx];
    const newMod: EvolutionModifier = {
      id: `mod-${Date.now()}-${nextIdx}`,
      name: "",
      rankLabel: info.rankLabel,
      requiredStat: info.requiredStat,
      effect: "",
    };
    setEvolutionModifiers(prev => [...prev, newMod]);
  };

  const handleUpdateEvolutionModifier = (idx: number, field: keyof EvolutionModifier, val: any) => {
    setEvolutionModifiers(prev => {
      const copy = [...prev];
      if (copy[idx]) {
        copy[idx] = { ...copy[idx], [field]: val };
      }
      return copy;
    });
  };

  const handleRemoveEvolutionModifier = (idx: number) => {
    setEvolutionModifiers(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Validate 5-ability cap per Essence
    if (essenceId !== null && !isInnatePassive) {
      const activeEssenceAbilities = abilities?.filter(a => a.essenceId === essenceId && a.id !== editingId) || [];
      if (activeEssenceAbilities.length >= 5) {
        toast.error("This Essence already has the maximum of 5 shaped abilities. Reassign or delete one first.");
        return;
      }
    }

    const payload = {
      characterId,
      name,
      nickname,
      description,
      cost,
      cooldown,
      range,
      speed,
      rollFormula,
      type,
      primaryStat,
      evolutionModifiers,
      subAbilities,
      abilityEffects,
      triggers,
      linkedStats,
      assignedToQuickRolls,
      assignedToMechanicsTracker,
      essenceId: isInnatePassive ? null : essenceId,
      isInnatePassive,
      resistances,
      immunities,
      bonusPower,
      bonusVitality,
      bonusSpirit,
      bonusAgility,
      bonusEndurance,
      bonusPrecision,
      bonusWillpower,
      bonusCharisma,
      hpAdd,
      hpBuff,
      manaAdd,
      manaBuff,
      dtAdd,
      dtBuff,
      bonusInitiative,
      level: editingId ? (abilities.find(a => a.id === editingId)?.level || 1) : 1,
      active: editingId ? !!(abilities.find(a => a.id === editingId)?.active) : false,
    };

    if (mode === "add") {
      addAbility.mutate(payload, {
        onSuccess: () => setMode("list"),
      });
    } else if (mode === "edit" && editingId) {
      updateAbility.mutate({
        id: editingId,
        data: payload,
      }, {
        onSuccess: () => setMode("list"),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Remove this shaped ability?")) {
      deleteAbility.mutate({ id, charId: characterId });
    }
  };

  const characterAbilities = playerAbilities;

  return (
    <Dialog open={isDialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setMode("list"); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 font-serif text-sm rounded-none">
          Edit Abilities
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-[800px] lg:max-w-[900px] sm:max-w-[650px] w-[95vw] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none p-5">
        <DialogHeader className="border-b border-border/30 pb-2">
          <DialogTitle className="font-serif text-2xl text-primary font-bold flex justify-between items-center">
            <span>
              {mode === "list" ? "Manage Abilities" : mode === "add" ? "Shape New Ability" : "Edit Shaped Ability"}
            </span>
            {mode === "list" && (
              <Button size="sm" onClick={handleOpenAdd} className="bg-primary text-primary-foreground font-serif rounded-none cursor-pointer">
                + Add Ability
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-3 mt-4 text-xs">
            {characterAbilities.length > 0 ? (
              <div className="divide-y divide-border/40">
                {characterAbilities.map((ability) => (
                  <div key={ability.id} className="py-3 flex justify-between items-start group">
                    <div className="space-y-1">
                      <div className="font-serif text-base text-foreground font-semibold flex items-center gap-2 flex-wrap">
                        {ability.name}
                        {ability.type && (
                          <span className="text-[9px] uppercase bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-none font-bold font-sans tracking-wide">{ability.type}</span>
                        )}
                        {ability.assignedToQuickRolls && (
                          <span className="text-[9px] uppercase bg-primary/10 border border-primary/30 text-primary px-1.5 py-0.5 rounded-none font-bold font-sans">Quick Roll</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        Cost: {ability.cost} MP | Cooldown: {ability.cooldown}s | Range: {ability.range} | Speed: {ability.speed}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(ability)} className="h-8 w-8 text-primary hover:bg-primary/10 rounded-none cursor-pointer">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(ability.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-none cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground font-serif italic">
                No abilities shaped. Tap "Add Ability" to build spells or attacks.
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 mt-4 text-xs font-sans">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Fireball, Cleave" className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">CIT Nick Name (Max 6 Chars)</label>
                <Input 
                  value={nickname} 
                  onChange={e => setNickname(e.target.value.substring(0, 6))} 
                  placeholder="e.g. Fball" 
                  maxLength={6}
                  className="bg-background rounded-none font-mono" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Essence Source</label>
                <select 
                  value={isInnatePassive ? "innate" : (essenceId === null ? "" : String(essenceId))} 
                  onChange={e => {
                    const val = e.target.value;
                    if (val === "innate") {
                      setIsInnatePassive(true);
                      setEssenceId(null);
                    } else if (val === "") {
                      setIsInnatePassive(false);
                      setEssenceId(null);
                    } else {
                      setIsInnatePassive(false);
                      setEssenceId(Number(val));
                    }
                  }} 
                  className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None (Unassigned)</option>
                  <option value="innate">✨ Innate Passive</option>
                  {essences?.map(ess => (
                    <option key={ess.id} value={ess.id}>
                      Slot {ess.slot}: {ess.name || "Unnamed Essence"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Linked Attributes checkboxes */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">Linked Attributes (For Roll Modifiers)</label>
              <div className="grid grid-cols-4 gap-2">
                {STAT_OPTIONS.map(stat => {
                  const isChecked = linkedStats.includes(stat);
                  return (
                    <div key={stat} className="flex items-center gap-2 bg-background border border-border/40 p-2 rounded-none">
                      <Checkbox 
                        id={`link_${stat}`} 
                        checked={isChecked} 
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setLinkedStats([...linkedStats, stat]);
                          } else {
                            setLinkedStats(linkedStats.filter(s => s !== stat));
                          }
                        }} 
                      />
                      <label htmlFor={`link_${stat}`} className="text-[10px] font-mono font-bold uppercase cursor-pointer">
                        {stat.substring(0, 3)}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Cost</label>
                <Input type="number" min={0} value={cost} onChange={e => setCost(Number(e.target.value))} required className="bg-background font-mono rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Cooldown (sec)</label>
                <Input type="number" min={0} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} required className="bg-background font-mono rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Range</label>
                <Input value={range} onChange={e => setRange(e.target.value)} placeholder="e.g. Melee, 30ft" className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
                <Input value={speed} onChange={e => setSpeed(e.target.value)} placeholder="e.g. Standard, Instant" className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Type</label>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value)} 
                  className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None</option>
                  <option value="Passive">Passive</option>
                  <option value="Attack">Attack</option>
                  <option value="Buff">Buff</option>
                  <option value="Debuff">Debuff</option>
                  <option value="Defense">Defense</option>
                  <option value="Movement">Movement</option>
                  <option value="Utility">Utility</option>
                  <option value="Stance">Stance</option>
                  <option value="Reaction">Reaction</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Roll Formula / Modifier (Optional)</label>
              <Input value={rollFormula} onChange={e => setRollFormula(e.target.value)} placeholder="e.g. d20+powr+6, 2d6+prer" className="bg-background font-mono rounded-none" />
            </div>

            {/* Active Modifiers (Granted While Active) */}
            <div className="border border-border/60 bg-background/40 p-3 rounded-none space-y-3">
              <h5 className="font-serif font-bold text-primary text-xs uppercase tracking-wider">Active Modifiers</h5>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Power</label>
                  <Input value={bonusPower} onChange={e => setBonusPower(e.target.value)} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Vitality</label>
                  <Input value={bonusVitality} onChange={e => setBonusVitality(e.target.value)} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Spirit</label>
                  <Input value={bonusSpirit} onChange={e => setBonusSpirit(e.target.value)} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Agility</label>
                  <Input value={bonusAgility} onChange={e => setBonusAgility(e.target.value)} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Endurance</label>
                  <Input value={bonusEndurance} onChange={e => setBonusEndurance(e.target.value)} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Precision</label>
                  <Input value={bonusPrecision} onChange={e => setBonusPrecision(e.target.value)} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Willpower</label>
                  <Input value={bonusWillpower} onChange={e => setBonusWillpower(e.target.value)} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Charisma</label>
                  <Input value={bonusCharisma} onChange={e => setBonusCharisma(e.target.value)} className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
              </div>

              {/* Vitals Modifiers Grid */}
              <div className="grid grid-cols-4 gap-3 border-t border-border/20 pt-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block">HP</label>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                      <Input value={hpAdd} onChange={e => setHpAdd(e.target.value)} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                      <Input value={hpBuff} onChange={e => setHpBuff(e.target.value)} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block">Mana</label>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                      <Input value={manaAdd} onChange={e => setManaAdd(e.target.value)} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                      <Input value={manaBuff} onChange={e => setManaBuff(e.target.value)} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block">DT</label>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                      <Input value={dtAdd} onChange={e => setDtAdd(e.target.value)} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                      <Input value={dtBuff} onChange={e => setDtBuff(e.target.value)} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block">Initiative</label>
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-0.5">Bonus</label>
                    <Input value={bonusInitiative} onChange={e => setBonusInitiative(e.target.value)} placeholder="Bonus" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                  </div>
                </div>
              </div>

              {/* Resistances & Immunities Grid */}
              <div className="grid grid-cols-2 gap-3 border-t border-border/20 pt-2">
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Resistances</label>
                  <Input value={resistances} onChange={e => setResistances(e.target.value)} placeholder="e.g. Fire, Piercing" className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">Immunities</label>
                  <Input value={immunities} onChange={e => setImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background font-mono h-7 text-xs rounded-none" />
                </div>
              </div>
            </div>

            {/* Ability Effects Section */}
            <div className="space-y-3 border-t border-border/30 pt-3">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Effects</label>
              {abilityEffects.map((eff, effIdx) => (
                <div key={eff.id || effIdx} className="bg-amber-500/5 border border-amber-500/20 p-3 space-y-3 rounded-none">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Ability Effect #{effIdx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAbilityEffects(prev => prev.filter((_, i) => i !== effIdx))}
                      className="h-6 text-[10px] text-destructive hover:bg-destructive/10 rounded-none cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remove Effect
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Effect Name</label>
                      <Input
                        value={eff.name || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setAbilityEffects(prev => {
                            const copy = [...prev];
                            copy[effIdx] = { ...copy[effIdx], name: val };
                            return copy;
                          });
                        }}
                        placeholder="Effect name..."
                        className="bg-background rounded-none font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Category</label>
                      <select
                        value={eff.category || "debuff"}
                        onChange={e => {
                          const val = e.target.value;
                          setAbilityEffects(prev => {
                            const copy = [...prev];
                            copy[effIdx] = { ...copy[effIdx], category: val };
                            return copy;
                          });
                        }}
                        className="w-full h-9 rounded-none border border-border/60 bg-background px-2 text-xs font-serif text-foreground"
                      >
                        <option value="debuff">Debuff</option>
                        <option value="buff">Buff</option>
                        <option value="dot">DoT</option>
                        <option value="mark">Mark</option>
                        <option value="status">Status</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Duration</label>
                      <Input
                        value={eff.duration || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setAbilityEffects(prev => {
                            const copy = [...prev];
                            copy[effIdx] = { ...copy[effIdx], duration: val };
                            return copy;
                          });
                        }}
                        placeholder="e.g. 2 rounds"
                        className="bg-background rounded-none text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Effect Description / Rules</label>
                    <Textarea
                      value={eff.description || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setAbilityEffects(prev => {
                          const copy = [...prev];
                          copy[effIdx] = { ...copy[effIdx], description: val };
                          return copy;
                        });
                      }}
                      placeholder="Describe the effect rules and passives..."
                      className="bg-background min-h-[100px] rounded-none font-serif text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id={`eff-mechanics-${effIdx}`}
                      checked={!!eff.assignedToMechanicsTracker}
                      onCheckedChange={chk => {
                        setAbilityEffects(prev => {
                          const copy = [...prev];
                          copy[effIdx] = { ...copy[effIdx], assignedToMechanicsTracker: !!chk };
                          return copy;
                        });
                      }}
                    />
                    <label htmlFor={`eff-mechanics-${effIdx}`} className="text-xs font-serif text-muted-foreground cursor-pointer select-none">
                      Mechanics Tracker
                    </label>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newEff: AbilityEffect = {
                    id: `effect-${Date.now()}-${abilityEffects.length}`,
                    name: "",
                    category: "debuff",
                    duration: "",
                    description: "",
                    assignedToMechanicsTracker: false,
                  };
                  setAbilityEffects(prev => [...prev, newEff]);
                }}
                className="w-full h-8 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 rounded-none font-serif text-xs flex items-center justify-center gap-2 cursor-pointer font-bold my-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Ability Effect</span>
              </Button>
            </div>

            {/* Description textarea */}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description / Base Effect</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the base effects of this ability..." className="bg-background min-h-[240px] rounded-none font-serif text-sm" />
            </div>

            {/* Sub-Abilities / Additional Base Effects Section */}
            <div className="space-y-3 pt-2">
              {subAbilities.map((sub, subIdx) => (
                <div key={sub.id || subIdx} className="bg-primary/5 border border-primary/20 p-3 space-y-3 rounded-none">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-xs font-bold text-primary uppercase tracking-wider">
                      Additional Effect #{subIdx + 2}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSubAbilities(prev => prev.filter((_, i) => i !== subIdx))}
                      className="h-6 text-[10px] text-destructive hover:bg-destructive/10 rounded-none cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remove Effect
                    </Button>
                  </div>

                  {/* Top row: Name & Nickname */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Sub-Effect Name</label>
                      <Input
                        value={sub.name || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setSubAbilities(prev => {
                            const copy = [...prev];
                            copy[subIdx] = { ...copy[subIdx], name: val };
                            return copy;
                          });
                        }}
                        placeholder={`Sub-effect name (default: ${name || "Ability"} (${subIdx + 2}))...`}
                        className="bg-background rounded-none font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Nickname</label>
                      <Input
                        value={sub.nickname || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setSubAbilities(prev => {
                            const copy = [...prev];
                            copy[subIdx] = { ...copy[subIdx], nickname: val };
                            return copy;
                          });
                        }}
                        placeholder="Short nickname..."
                        className="bg-background rounded-none"
                      />
                    </div>
                  </div>

                  {/* Linked Attributes checkboxes */}
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">Linked Attributes (For Roll Modifiers)</label>
                    <div className="grid grid-cols-4 gap-2">
                      {STAT_OPTIONS.map(stat => {
                        const isChecked = (sub.linkedStats || []).includes(stat);
                        return (
                          <div key={stat} className="flex items-center gap-2 bg-background border border-border/40 p-2 rounded-none">
                            <Checkbox
                              id={`sub_${subIdx}_link_${stat}`}
                              checked={isChecked}
                              onCheckedChange={checked => {
                                setSubAbilities(prev => {
                                  const copy = [...prev];
                                  const curLinked = copy[subIdx].linkedStats || [];
                                  const nextLinked = checked
                                    ? [...curLinked, stat]
                                    : curLinked.filter(s => s !== stat);
                                  copy[subIdx] = { ...copy[subIdx], linkedStats: nextLinked };
                                  return copy;
                                });
                              }}
                            />
                            <label htmlFor={`sub_${subIdx}_link_${stat}`} className="text-[10px] font-mono font-bold uppercase cursor-pointer">
                              {stat.substring(0, 3)}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 5-Column Header Vitals Row */}
                  <div className="grid grid-cols-5 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Cost</label>
                      <Input
                        type="number"
                        min={0}
                        value={sub.cost ?? 0}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setSubAbilities(prev => {
                            const copy = [...prev];
                            copy[subIdx] = { ...copy[subIdx], cost: val };
                            return copy;
                          });
                        }}
                        className="bg-background font-mono rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Cooldown (sec)</label>
                      <Input
                        type="number"
                        min={0}
                        value={sub.cooldown ?? 0}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setSubAbilities(prev => {
                            const copy = [...prev];
                            copy[subIdx] = { ...copy[subIdx], cooldown: val };
                            return copy;
                          });
                        }}
                        className="bg-background font-mono rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Range</label>
                      <Input
                        value={sub.range || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setSubAbilities(prev => {
                            const copy = [...prev];
                            copy[subIdx] = { ...copy[subIdx], range: val };
                            return copy;
                          });
                        }}
                        placeholder="e.g. Melee, 30ft"
                        className="bg-background rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
                      <Input
                        value={sub.speed || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setSubAbilities(prev => {
                            const copy = [...prev];
                            copy[subIdx] = { ...copy[subIdx], speed: val };
                            return copy;
                          });
                        }}
                        placeholder="e.g. Standard, Instant"
                        className="bg-background rounded-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Type</label>
                      <select
                        value={sub.type || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setSubAbilities(prev => {
                            const copy = [...prev];
                            copy[subIdx] = { ...copy[subIdx], type: val };
                            return copy;
                          });
                        }}
                        className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">None</option>
                        <option value="Passive">Passive</option>
                        <option value="Attack">Attack</option>
                        <option value="Buff">Buff</option>
                        <option value="Debuff">Debuff</option>
                        <option value="Defense">Defense</option>
                        <option value="Movement">Movement</option>
                        <option value="Utility">Utility</option>
                        <option value="Stance">Stance</option>
                        <option value="Reaction">Reaction</option>
                      </select>
                    </div>
                  </div>

                  {/* Roll Formula */}
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Roll Formula / Modifier (Optional)</label>
                    <Input
                      value={sub.rollFormula || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setSubAbilities(prev => {
                          const copy = [...prev];
                          copy[subIdx] = { ...copy[subIdx], rollFormula: val };
                          return copy;
                        });
                      }}
                      placeholder="e.g. d20+powr+6, 2d6+prer"
                      className="bg-background font-mono rounded-none"
                    />
                  </div>

                  {/* Active Modifiers (Granted While Active) */}
                  <div className="border border-border/60 bg-background/40 p-3 rounded-none space-y-3">
                    <h5 className="font-serif font-bold text-primary text-xs uppercase tracking-wider">Active Modifiers</h5>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Power</label>
                        <Input
                          value={sub.bonusPower ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], bonusPower: val };
                              return copy;
                            });
                          }}
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Vitality</label>
                        <Input
                          value={sub.bonusVitality ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], bonusVitality: val };
                              return copy;
                            });
                          }}
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Spirit</label>
                        <Input
                          value={sub.bonusSpirit ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], bonusSpirit: val };
                              return copy;
                            });
                          }}
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Agility</label>
                        <Input
                          value={sub.bonusAgility ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], bonusAgility: val };
                              return copy;
                            });
                          }}
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Endurance</label>
                        <Input
                          value={sub.bonusEndurance ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], bonusEndurance: val };
                              return copy;
                            });
                          }}
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Precision</label>
                        <Input
                          value={sub.bonusPrecision ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], bonusPrecision: val };
                              return copy;
                            });
                          }}
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Willpower</label>
                        <Input
                          value={sub.bonusWillpower ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], bonusWillpower: val };
                              return copy;
                            });
                          }}
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">Charisma</label>
                        <Input
                          value={sub.bonusCharisma ?? ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], bonusCharisma: val };
                              return copy;
                            });
                          }}
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                    </div>

                    {/* Vitals Modifiers Grid */}
                    <div className="grid grid-cols-4 gap-3 border-t border-border/20 pt-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block">HP</label>
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                            <Input
                              value={sub.hpAdd ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setSubAbilities(prev => {
                                  const copy = [...prev];
                                  copy[subIdx] = { ...copy[subIdx], hpAdd: val };
                                  return copy;
                                });
                              }}
                              placeholder="Add"
                              className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                            <Input
                              value={sub.hpBuff ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setSubAbilities(prev => {
                                  const copy = [...prev];
                                  copy[subIdx] = { ...copy[subIdx], hpBuff: val };
                                  return copy;
                                });
                              }}
                              placeholder="Buff"
                              className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block">Mana</label>
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                            <Input
                              value={sub.manaAdd ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setSubAbilities(prev => {
                                  const copy = [...prev];
                                  copy[subIdx] = { ...copy[subIdx], manaAdd: val };
                                  return copy;
                                });
                              }}
                              placeholder="Add"
                              className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                            <Input
                              value={sub.manaBuff ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setSubAbilities(prev => {
                                  const copy = [...prev];
                                  copy[subIdx] = { ...copy[subIdx], manaBuff: val };
                                  return copy;
                                });
                              }}
                              placeholder="Buff"
                              className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block">DT</label>
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                            <Input
                              value={sub.dtAdd ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setSubAbilities(prev => {
                                  const copy = [...prev];
                                  copy[subIdx] = { ...copy[subIdx], dtAdd: val };
                                  return copy;
                                });
                              }}
                              placeholder="Add"
                              className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                            <Input
                              value={sub.dtBuff ?? ""}
                              onChange={e => {
                                const val = e.target.value;
                                setSubAbilities(prev => {
                                  const copy = [...prev];
                                  copy[subIdx] = { ...copy[subIdx], dtBuff: val };
                                  return copy;
                                });
                              }}
                              placeholder="Buff"
                              className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block">Initiative</label>
                        <div>
                          <label className="text-[8px] text-muted-foreground block mb-0.5">Bonus</label>
                          <Input
                            value={sub.bonusInitiative ?? ""}
                            onChange={e => {
                              const val = e.target.value;
                              setSubAbilities(prev => {
                                const copy = [...prev];
                                copy[subIdx] = { ...copy[subIdx], bonusInitiative: val };
                                return copy;
                              });
                            }}
                            placeholder="Bonus"
                            className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Resistances & Immunities 2-Column Grid */}
                    <div className="grid grid-cols-2 gap-3 border-t border-border/20 pt-2">
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">RESISTANCES</label>
                        <Input
                          value={sub.resistances || ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], resistances: val };
                              return copy;
                            });
                          }}
                          placeholder="e.g. Fire, Piercing"
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-1">IMMUNITIES</label>
                        <Input
                          value={sub.immunities || ""}
                          onChange={e => {
                            const val = e.target.value;
                            setSubAbilities(prev => {
                              const copy = [...prev];
                              copy[subIdx] = { ...copy[subIdx], immunities: val };
                              return copy;
                            });
                          }}
                          placeholder="e.g. Poison, Stun"
                          className="bg-background font-mono h-7 text-xs rounded-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description textarea */}
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description / Base Effect</label>
                    <Textarea
                      value={sub.description || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setSubAbilities(prev => {
                          const copy = [...prev];
                          copy[subIdx] = { ...copy[subIdx], description: val };
                          return copy;
                        });
                      }}
                      placeholder="Describe the secondary effect..."
                      className="bg-background min-h-[140px] rounded-none font-serif text-sm"
                    />
                  </div>

                  {/* Assign to Favorites / Mechanics Tracker Toggles */}
                  <div className="flex items-center gap-4 pt-1 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`sub-quickroll-${subIdx}`}
                        checked={!!sub.assignedToQuickRolls}
                        onCheckedChange={chk => {
                          setSubAbilities(prev => {
                            const copy = [...prev];
                            copy[subIdx] = { ...copy[subIdx], assignedToQuickRolls: !!chk };
                            return copy;
                          });
                        }}
                      />
                      <label htmlFor={`sub-quickroll-${subIdx}`} className="text-xs font-serif text-muted-foreground cursor-pointer select-none">
                        Assign Sub-Effect to Quick Rolls / Favorites Hotbar
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`sub-mechanics-${subIdx}`}
                        checked={!!sub.assignedToMechanicsTracker}
                        onCheckedChange={chk => {
                          setSubAbilities(prev => {
                            const copy = [...prev];
                            copy[subIdx] = { ...copy[subIdx], assignedToMechanicsTracker: !!chk };
                            return copy;
                          });
                        }}
                      />
                      <label htmlFor={`sub-mechanics-${subIdx}`} className="text-xs font-serif text-muted-foreground cursor-pointer select-none">
                        Mechanics Tracker
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              {/* Multi-Sequential + Sub Ability Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newSub: SubAbility = {
                    id: `sub-${Date.now()}-${subAbilities.length}`,
                    name: "",
                    type: "",
                    description: "",
                    cost: 0,
                    rollFormula: "",
                    linkedStats: [],
                    assignedToQuickRolls: false,
                    assignedToMechanicsTracker: false,
                  };
                  setSubAbilities(prev => [...prev, newSub]);
                }}
                className="w-full h-8 bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 rounded-none font-serif text-xs flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Sub Ability</span>
              </Button>
            </div>

            {/* Ability Triggers Section */}
            <div className="space-y-3 pt-2 border-t border-border/30">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Triggers</label>
              {triggers.map((trig, trigIdx) => (
                <div key={trig.id || trigIdx} className="bg-cyan-500/5 border border-cyan-500/20 p-3 space-y-3 rounded-none">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      Ability Trigger #{trigIdx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setTriggers(prev => prev.filter((_, i) => i !== trigIdx))}
                      className="h-6 text-[10px] text-destructive hover:bg-destructive/10 rounded-none cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remove Trigger
                    </Button>
                  </div>

                  {/* Trigger Name & Nickname */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Trigger Name</label>
                      <Input
                        value={trig.name || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setTriggers(prev => {
                            const copy = [...prev];
                            copy[trigIdx] = { ...copy[trigIdx], name: val };
                            return copy;
                          });
                        }}
                        placeholder="Trigger name..."
                        className="bg-background rounded-none font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Nickname</label>
                      <Input
                        value={trig.nickname || ""}
                        onChange={e => {
                          const val = e.target.value;
                          setTriggers(prev => {
                            const copy = [...prev];
                            copy[trigIdx] = { ...copy[trigIdx], nickname: val };
                            return copy;
                          });
                        }}
                        placeholder="Short nickname..."
                        className="bg-background rounded-none"
                      />
                    </div>
                  </div>

                  {/* 1-Line Threshold Builder */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Resource</label>
                      <select
                        value={trig.resource || "hp"}
                        onChange={e => {
                          const val = e.target.value as any;
                          setTriggers(prev => {
                            const copy = [...prev];
                            copy[trigIdx] = { ...copy[trigIdx], resource: val };
                            return copy;
                          });
                        }}
                        className="w-full h-9 rounded-none border border-border/60 bg-background px-2 text-xs font-serif text-foreground"
                      >
                        <option value="hp">Health (HP)</option>
                        <option value="mana">Mana</option>
                        <option value="dt">DT</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Operator</label>
                      <select
                        value={trig.operator || "below_percent"}
                        onChange={e => {
                          const val = e.target.value as any;
                          setTriggers(prev => {
                            const copy = [...prev];
                            copy[trigIdx] = { ...copy[trigIdx], operator: val };
                            return copy;
                          });
                        }}
                        className="w-full h-9 rounded-none border border-border/60 bg-background px-2 text-xs font-serif text-foreground font-mono"
                      >
                        <option value="below_percent">&lt; %</option>
                        <option value="below_value">&lt;= Val</option>
                        <option value="depleted">= 0</option>
                        <option value="above_percent">&gt;= %</option>
                        <option value="full">= Max</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Threshold Value</label>
                      <Input
                        type="number"
                        value={trig.threshold ?? 50}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setTriggers(prev => {
                            const copy = [...prev];
                            copy[trigIdx] = { ...copy[trigIdx], threshold: val };
                            return copy;
                          });
                        }}
                        className="bg-background rounded-none font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* Point to Target Selector */}
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Point to Existing Target (Optional)</label>
                    <select
                      value={trig.linkedTargetId || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setTriggers(prev => {
                          const copy = [...prev];
                          if (!val) {
                            copy[trigIdx] = { ...copy[trigIdx], linkedTargetType: "none", linkedTargetId: "" };
                          } else {
                            const subMatch = subAbilities.find(s => s.id === val);
                            const effMatch = abilityEffects.find(ef => ef.id === val);
                            const modMatch = evolutionModifiers.find(m => m.id === val);
                            let tType: any = "none";
                            if (subMatch) tType = "sub-ability";
                            else if (effMatch) tType = "effect";
                            else if (modMatch) tType = "modifier";

                            copy[trigIdx] = { ...copy[trigIdx], linkedTargetType: tType, linkedTargetId: val };
                          }
                          return copy;
                        });
                      }}
                      className="w-full h-9 rounded-none border border-border/60 bg-background px-2 text-xs font-serif text-foreground"
                    >
                      <option value="">None / Custom</option>
                      {subAbilities.map((s, idx) => (
                        <option key={s.id || idx} value={s.id}>Sub-Ability: {s.name || `Sub #${idx + 2}`}</option>
                      ))}
                      {abilityEffects.map((ef, idx) => (
                        <option key={ef.id || idx} value={ef.id}>Ability Effect: {ef.name || `Effect #${idx + 1}`}</option>
                      ))}
                      {evolutionModifiers.map((m, idx) => (
                        <option key={m.id || idx} value={m.id}>Ability Mod: {m.name || `Mod #${idx + 1}`}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description textarea */}
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Trigger Description / Effect</label>
                    <Textarea
                      value={trig.description || ""}
                      onChange={e => {
                        const val = e.target.value;
                        setTriggers(prev => {
                          const copy = [...prev];
                          copy[trigIdx] = { ...copy[trigIdx], description: val };
                          return copy;
                        });
                      }}
                      placeholder="Describe what happens when this trigger fires..."
                      className="bg-background min-h-[100px] rounded-none font-serif text-sm"
                    />
                  </div>

                  {/* Options Toggles */}
                  <div className="flex items-center gap-4 pt-1 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`trig-quickroll-${trigIdx}`}
                        checked={!!trig.assignedToQuickRolls}
                        onCheckedChange={chk => {
                          setTriggers(prev => {
                            const copy = [...prev];
                            copy[trigIdx] = { ...copy[trigIdx], assignedToQuickRolls: !!chk };
                            return copy;
                          });
                        }}
                      />
                      <label htmlFor={`trig-quickroll-${trigIdx}`} className="text-xs font-serif text-muted-foreground cursor-pointer select-none">
                        Assign Trigger to Quick Rolls / Hotbar
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`trig-mechanics-${trigIdx}`}
                        checked={!!trig.assignedToMechanicsTracker}
                        onCheckedChange={chk => {
                          setTriggers(prev => {
                            const copy = [...prev];
                            copy[trigIdx] = { ...copy[trigIdx], assignedToMechanicsTracker: !!chk };
                            return copy;
                          });
                        }}
                      />
                      <label htmlFor={`trig-mechanics-${trigIdx}`} className="text-xs font-serif text-muted-foreground cursor-pointer select-none">
                        Mechanics Tracker
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newTrig: AbilityTrigger = {
                    id: `trig-${Date.now()}-${triggers.length}`,
                    name: "",
                    resource: "hp",
                    operator: "below_percent",
                    threshold: 50,
                    description: "",
                    assignedToMechanicsTracker: false,
                  };
                  setTriggers(prev => [...prev, newTrig]);
                }}
                className="w-full h-8 bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 rounded-none font-serif text-xs flex items-center justify-center gap-2 cursor-pointer font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Ability Trigger</span>
              </Button>
            </div>

            {/* Ability Evolution Section (Only renders box if there are active earned slots) */}
            {(() => {
              const currentDraftAbility: Ability = {
                id: editingId || 0,
                characterId,
                name: name || "Draft Ability",
                description,
                cost,
                cooldown,
                range,
                speed,
                rollFormula,
                linkedStats,
                assignedToQuickRolls,
                evolutionModifiers,
              };

              const charStats: Record<string, number> = {
                power: character?.power || 0,
                vitality: character?.vitality || 0,
                spirit: character?.spirit || 0,
                agility: character?.agility || 0,
                endurance: character?.endurance || 0,
                precision: character?.precision || 0,
                willpower: character?.willpower || 0,
                charisma: character?.charisma || 0,
              };

              const evolRes = calculateAbilityEvolutions(
                currentDraftAbility,
                character?.rank || "Iron",
                charStats
              );

              // ONLY show box IF active earned slots exist (> 0)
              if (evolRes.isDormant || evolRes.earnedSlotCount === 0 || !linkedStats || linkedStats.length === 0) {
                return null;
              }

              return (
                <div className="border-t border-border/30 pt-3 space-y-2 bg-primary/5 p-3 border border-primary/20">
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {Array.from({ length: evolRes.earnedSlotCount }).map((_, slotIdx) => {
                      const slotMeta = EVOLUTION_THRESHOLDS_TABLE[slotIdx];
                      const existingMod = evolutionModifiers[slotIdx];
                      const isOpen = !!expandedMods[slotIdx];
                      const titleText = existingMod?.name?.trim()
                        ? `${slotMeta.rankLabel} - ${existingMod.name.trim()}`
                        : `${slotMeta.rankLabel} - Ability Mod`;

                      return (
                        <div key={slotIdx} className="bg-background/80 border border-border/60 rounded-none overflow-hidden">
                          {/* Row Header (Click to expand/collapse) */}
                          <div
                            onClick={() => setExpandedMods(prev => ({ ...prev, [slotIdx]: !isOpen }))}
                            className="flex items-center justify-between p-2 bg-primary/10 hover:bg-primary/20 cursor-pointer select-none border-b border-border/30"
                          >
                            <div className="flex items-center gap-2">
                              <div className="bg-primary/20 text-primary border border-primary/40 text-[10px] font-bold font-mono px-2 py-0.5 rounded-none">
                                {slotMeta.rankLabel}
                              </div>
                              <span className="font-serif text-xs font-bold text-primary">{titleText}</span>
                            </div>
                            <svg className={`w-3.5 h-3.5 text-primary/80 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                          </div>

                          {/* Expandable Body */}
                          {isOpen && (
                            <div className="p-3 space-y-2.5 bg-background/90 border-t border-border/30">
                              <div>
                                <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1">Modifier Name</label>
                                <Input
                                  value={existingMod?.name || ""}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setEvolutionModifiers(prev => {
                                      const copy = [...prev];
                                      const base = copy[slotIdx] || {
                                        id: `mod-${Date.now()}-${slotIdx}`,
                                        name: "",
                                        rankLabel: slotMeta.rankLabel,
                                        requiredStat: slotMeta.requiredStat,
                                        effect: "",
                                      };
                                      copy[slotIdx] = { ...base, name: val };
                                      return copy;
                                    });
                                  }}
                                  placeholder="Modifier name..."
                                  className="h-8 text-xs bg-background rounded-none font-bold"
                                />
                              </div>

                              <div>
                                <label className="text-[9px] font-bold uppercase text-muted-foreground block mb-1">Evolution Info / Effect</label>
                                <Textarea
                                  value={existingMod?.effect || ""}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setEvolutionModifiers(prev => {
                                      const copy = [...prev];
                                      const base = copy[slotIdx] || {
                                        id: `mod-${Date.now()}-${slotIdx}`,
                                        name: "",
                                        rankLabel: slotMeta.rankLabel,
                                        requiredStat: slotMeta.requiredStat,
                                        effect: "",
                                      };
                                      copy[slotIdx] = { ...base, effect: val };
                                      return copy;
                                    });
                                  }}
                                  placeholder="Describe the modifier effect..."
                                  className="min-h-[80px] text-xs bg-background rounded-none font-serif"
                                />
                              </div>

                              <div className="flex justify-between items-center pt-1">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`mod-mechanics-${slotIdx}`}
                                    checked={!!existingMod?.assignedToMechanicsTracker}
                                    onCheckedChange={chk => {
                                      setEvolutionModifiers(prev => {
                                        const copy = [...prev];
                                        const base = copy[slotIdx] || {
                                          id: `mod-${Date.now()}-${slotIdx}`,
                                          name: "",
                                          rankLabel: slotMeta.rankLabel,
                                          requiredStat: slotMeta.requiredStat,
                                          effect: "",
                                        };
                                        copy[slotIdx] = { ...base, assignedToMechanicsTracker: !!chk };
                                        return copy;
                                      });
                                    }}
                                  />
                                  <label htmlFor={`mod-mechanics-${slotIdx}`} className="text-[10px] font-serif text-muted-foreground cursor-pointer select-none">
                                    Mechanics Tracker
                                  </label>
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEvolutionModifiers(prev => prev.filter((_, i) => i !== slotIdx));
                                  }}
                                  className="h-6 text-[10px] text-destructive hover:bg-destructive/10 rounded-none cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3 mr-1" /> Remove Modifier
                                </Button>
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
            <div className="flex items-center gap-4 pt-1 flex-wrap">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="quick_roll" 
                  checked={assignedToQuickRolls} 
                  onCheckedChange={(checked) => setAssignedToQuickRolls(!!checked)} 
                />
                <label htmlFor="quick_roll" className="font-bold text-[10px] text-muted-foreground uppercase cursor-pointer">
                  Assign to Quick Rolls HUD
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="mechanics_tracker" 
                  checked={assignedToMechanicsTracker} 
                  onCheckedChange={(checked) => setAssignedToMechanicsTracker(!!checked)} 
                />
                <label htmlFor="mechanics_tracker" className="font-bold text-[10px] text-muted-foreground uppercase cursor-pointer">
                  Mechanics Tracker
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/30 pt-4">
              <Button type="button" variant="ghost" onClick={resetForm} className="rounded-none">Reset</Button>
              <Button type="button" variant="ghost" onClick={() => setMode("list")} className="rounded-none">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-none">
                {mode === "add" ? "Shape Ability" : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
