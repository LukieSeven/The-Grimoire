import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Trash2, Plus } from "lucide-react";
import { Familiar, FamiliarAbility, evaluateFormula, parseFormulaOrNum } from "@/lib/storage";

interface EditFamiliarDialogProps {
  familiar: Familiar;
  onSave: (updated: Familiar) => void;
}

export function EditFamiliarDialog({ familiar, onSave }: EditFamiliarDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [name, setName] = useState(familiar.name);
  const [race, setRace] = useState(familiar.race);
  const [className, setClassName] = useState(familiar.className); // Rank
  const [speed, setSpeed] = useState(familiar.speed);
  const [level, setLevel] = useState(familiar.level || 1);

  // Attributes
  const [power, setPower] = useState(familiar.power);
  const [vitality, setVitality] = useState(familiar.vitality);
  const [spirit, setSpirit] = useState(familiar.spirit);
  const [agility, setAgility] = useState(familiar.agility);
  const [endurance, setEndurance] = useState(familiar.endurance);
  const [precision, setPrecision] = useState(familiar.precision);
  const [willpower, setWillpower] = useState(familiar.willpower);
  const [charisma, setCharisma] = useState(familiar.charisma);

  // Formulas
  const [hpFormula, setHpFormula] = useState(familiar.hpFormula || "Vitality * 8");
  const [manaFormula, setManaFormula] = useState(familiar.manaFormula || "Spirit * 5");
  const [dtFormula, setDtFormula] = useState(familiar.dtFormula || "Endurance * 1");

  // Resistances/Immunities
  const [resistances, setResistances] = useState(familiar.resistances || "");
  const [immunities, setImmunities] = useState(familiar.immunities || "");

  // Familiar Abilities state
  const [abilities, setAbilities] = useState<FamiliarAbility[]>(familiar.abilities || []);

  // Secondary Ability Form view state
  const [isEditingAbility, setIsEditingAbility] = useState(false);
  const [abilityIndexToEdit, setAbilityIndexToEdit] = useState<number | null>(null);
  const [abilityName, setAbilityName] = useState("");
  const [abilityNickname, setAbilityNickname] = useState("");
  const [abilityType, setAbilityType] = useState("");
  const [abilityDescription, setAbilityDescription] = useState("");
  const [abilityRollFormula, setAbilityRollFormula] = useState("");
  const [abilityCost, setAbilityCost] = useState(0);
  const [abilityCooldown, setAbilityCooldown] = useState(0);
  const [abilityRange, setAbilityRange] = useState("Self");
  const [abilitySpeed, setAbilitySpeed] = useState("Instant");
  const [abilityLinkedStats, setAbilityLinkedStats] = useState<string[]>([]);
  const [abilityResistances, setAbilityResistances] = useState("");
  const [abilityImmunities, setAbilityImmunities] = useState("");

  const [abilityBonusPower, setAbilityBonusPower] = useState<string | number>("");
  const [abilityBonusVitality, setAbilityBonusVitality] = useState<string | number>("");
  const [abilityBonusSpirit, setAbilityBonusSpirit] = useState<string | number>("");
  const [abilityBonusAgility, setAbilityBonusAgility] = useState<string | number>("");
  const [abilityBonusEndurance, setAbilityBonusEndurance] = useState<string | number>("");
  const [abilityBonusPrecision, setAbilityBonusPrecision] = useState<string | number>("");
  const [abilityBonusWillpower, setAbilityBonusWillpower] = useState<string | number>("");
  const [abilityBonusCharisma, setAbilityBonusCharisma] = useState<string | number>("");

  const [abilityHpAdd, setAbilityHpAdd] = useState<string | number>("");
  const [abilityHpBuff, setAbilityHpBuff] = useState<string | number>("");
  const [abilityManaAdd, setAbilityManaAdd] = useState<string | number>("");
  const [abilityManaBuff, setAbilityManaBuff] = useState<string | number>("");
  const [abilityDtAdd, setAbilityDtAdd] = useState<string | number>("");
  const [abilityDtBuff, setAbilityDtBuff] = useState<string | number>("");
  const [abilityBonusInitiative, setAbilityBonusInitiative] = useState<string | number>("");

  const handleStartAddAbility = () => {
    setAbilityIndexToEdit(null);
    setAbilityName("");
    setAbilityNickname("");
    setAbilityType("");
    setAbilityDescription("");
    setAbilityRollFormula("");
    setAbilityCost(0);
    setAbilityCooldown(0);
    setAbilityRange("Self");
    setAbilitySpeed("Instant");
    setAbilityLinkedStats([]);
    setAbilityResistances("");
    setAbilityImmunities("");
    setAbilityBonusPower("");
    setAbilityBonusVitality("");
    setAbilityBonusSpirit("");
    setAbilityBonusAgility("");
    setAbilityBonusEndurance("");
    setAbilityBonusPrecision("");
    setAbilityBonusWillpower("");
    setAbilityBonusCharisma("");
    setAbilityHpAdd("");
    setAbilityHpBuff("");
    setAbilityManaAdd("");
    setAbilityManaBuff("");
    setAbilityDtAdd("");
    setAbilityDtBuff("");
    setAbilityBonusInitiative("");
    setIsEditingAbility(true);
  };

  const handleStartEditAbility = (ab: FamiliarAbility, idx: number) => {
    setAbilityIndexToEdit(idx);
    setAbilityName(ab.name);
    setAbilityNickname(ab.nickname || "");
    setAbilityType(ab.type || "");
    setAbilityDescription(ab.description || "");
    setAbilityRollFormula(ab.rollFormula || "");
    setAbilityCost(ab.cost || 0);
    setAbilityCooldown(ab.cooldown || 0);
    setAbilityRange(ab.range || "Self");
    setAbilitySpeed(ab.speed || "Instant");
    setAbilityLinkedStats(ab.linkedStats || []);
    setAbilityResistances(ab.resistances || "");
    setAbilityImmunities(ab.immunities || "");
    setAbilityBonusPower(ab.bonusPower ?? "");
    setAbilityBonusVitality(ab.bonusVitality ?? "");
    setAbilityBonusSpirit(ab.bonusSpirit ?? "");
    setAbilityBonusAgility(ab.bonusAgility ?? "");
    setAbilityBonusEndurance(ab.bonusEndurance ?? "");
    setAbilityBonusPrecision(ab.bonusPrecision ?? "");
    setAbilityBonusWillpower(ab.bonusWillpower ?? "");
    setAbilityBonusCharisma(ab.bonusCharisma ?? "");
    setAbilityHpAdd(ab.hpAdd ?? "");
    setAbilityHpBuff(ab.hpBuff ?? "");
    setAbilityManaAdd(ab.manaAdd ?? "");
    setAbilityManaBuff(ab.manaBuff ?? "");
    setAbilityDtAdd(ab.dtAdd ?? "");
    setAbilityDtBuff(ab.dtBuff ?? "");
    setAbilityBonusInitiative(ab.bonusInitiative ?? "");
    setIsEditingAbility(true);
  };

  const handleSaveAbility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!abilityName.trim()) return;

    const newAbility: FamiliarAbility = {
      id: abilityIndexToEdit !== null ? (abilities[abilityIndexToEdit].id || Date.now()) : Date.now(),
      name: abilityName,
      nickname: abilityNickname ? abilityNickname.substring(0, 6) : undefined,
      type: abilityType || undefined,
      description: abilityDescription,
      rollFormula: abilityRollFormula,
      cost: abilityCost,
      cooldown: abilityCooldown,
      range: abilityRange,
      speed: abilitySpeed,
      linkedStats: abilityLinkedStats,
      assignedToQuickRolls: false,
      resistances: abilityResistances || undefined,
      immunities: abilityImmunities || undefined,
      bonusPower: abilityBonusPower !== "" ? abilityBonusPower : undefined,
      bonusVitality: abilityBonusVitality !== "" ? abilityBonusVitality : undefined,
      bonusSpirit: abilityBonusSpirit !== "" ? abilityBonusSpirit : undefined,
      bonusAgility: abilityBonusAgility !== "" ? abilityBonusAgility : undefined,
      bonusEndurance: abilityBonusEndurance !== "" ? abilityBonusEndurance : undefined,
      bonusPrecision: abilityBonusPrecision !== "" ? abilityBonusPrecision : undefined,
      bonusWillpower: abilityBonusWillpower !== "" ? abilityBonusWillpower : undefined,
      bonusCharisma: abilityBonusCharisma !== "" ? abilityBonusCharisma : undefined,
      hpAdd: abilityHpAdd !== "" ? abilityHpAdd : undefined,
      hpBuff: abilityHpBuff !== "" ? abilityHpBuff : undefined,
      manaAdd: abilityManaAdd !== "" ? abilityManaAdd : undefined,
      manaBuff: abilityManaBuff !== "" ? abilityManaBuff : undefined,
      dtAdd: abilityDtAdd !== "" ? abilityDtAdd : undefined,
      dtBuff: abilityDtBuff !== "" ? abilityDtBuff : undefined,
      bonusInitiative: abilityBonusInitiative !== "" ? abilityBonusInitiative : undefined,
      subAbilities: abilityIndexToEdit !== null ? abilities[abilityIndexToEdit].subAbilities : undefined,
    };

    if (abilityIndexToEdit !== null) {
      const next = [...abilities];
      next[abilityIndexToEdit] = newAbility;
      setAbilities(next);
    } else {
      setAbilities([...abilities, newAbility]);
    }
    setIsEditingAbility(false);
  };

  const STAT_OPTIONS = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Recalculate max resource values statically
    const vars = {
      power, pow: power,
      vitality, vit: vitality,
      spirit, spi: spirit,
      agility, agi: agility,
      endurance, end: endurance,
      precision, pre: precision,
      willpower, wil: willpower,
      charisma, cha: charisma,
      dtbonus: parseFormulaOrNum(familiar.dtBonus, {}),
    };

    const calculatedMaxHp = Math.max(1, evaluateFormula(hpFormula, vars));
    const calculatedMaxMana = Math.max(0, evaluateFormula(manaFormula, vars));
    const calculatedMaxDt = Math.max(0, evaluateFormula(dtFormula, vars));

    // Clamp current values to new maximums
    const currentHp = Math.min(familiar.currentHp, calculatedMaxHp);
    const currentMana = Math.min(familiar.currentMana, calculatedMaxMana);
    const currentDt = Math.min(familiar.currentDt, calculatedMaxDt);

    const updated: Familiar = {
      ...familiar,
      name,
      race,
      className,
      speed,
      level,
      power,
      vitality,
      spirit,
      agility,
      endurance,
      precision,
      willpower,
      charisma,
      hpFormula,
      manaFormula,
      dtFormula,
      resistances,
      immunities,
      currentHp,
      currentMana,
      currentDt,
      abilities, // Save updated abilities
    };

    onSave(updated);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) setIsEditingAbility(false); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-primary/40 text-primary hover:bg-primary/10 rounded-none cursor-pointer text-xs font-bold font-serif px-3">
          <Edit2 className="w-3 h-3 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-[800px] lg:max-w-[900px] sm:max-w-[650px] w-[95vw] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none p-6">
        <div className="absolute inset-1 border border-border/10 pointer-events-none" />
        <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

        <DialogHeader className="border-b border-border/20 pb-2 z-10 relative">
          <DialogTitle className="font-serif text-lg text-primary font-bold">
            {isEditingAbility 
              ? `${abilityIndexToEdit !== null ? "Edit" : "Add"} Familiar Ability` 
              : `Edit Familiar: ${familiar.name}`
            }
          </DialogTitle>
        </DialogHeader>

        {isEditingAbility ? (
          <form onSubmit={handleSaveAbility} className="space-y-4 mt-4 text-xs font-sans z-10 relative">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Name</label>
                <Input value={abilityName} onChange={e => setAbilityName(e.target.value)} required placeholder="e.g. Bite, Shadow Dash" className="bg-background rounded-none font-serif" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">CIT Nick Name (Max 6 Chars)</label>
                <Input 
                  value={abilityNickname} 
                  onChange={e => setAbilityNickname(e.target.value.substring(0, 6))} 
                  placeholder="e.g. Bite" 
                  maxLength={6}
                  className="bg-background rounded-none font-mono" 
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Type</label>
                <select 
                  value={abilityType} 
                  onChange={e => setAbilityType(e.target.value)} 
                  className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">None</option>
                  <option value="Attack">Attack</option>
                  <option value="Buff">Buff</option>
                  <option value="Debuff">Debuff</option>
                  <option value="Defense">Defense</option>
                  <option value="Movement">Movement</option>
                  <option value="Utility">Utility</option>
                </select>
              </div>
            </div>

            {/* Linked Attributes checkboxes */}
            <div className="border-t border-border/20 pt-3">
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">Linked Attributes (For Roll Modifiers)</label>
              <div className="grid grid-cols-4 gap-2">
                {STAT_OPTIONS.map(stat => {
                  const isChecked = abilityLinkedStats.includes(stat);
                  return (
                    <div key={stat} className="flex items-center gap-2 bg-background border border-border/40 p-2 rounded-none">
                      <Checkbox 
                        id={`fam_link_${stat}`} 
                        checked={isChecked} 
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setAbilityLinkedStats([...abilityLinkedStats, stat]);
                          } else {
                            setAbilityLinkedStats(abilityLinkedStats.filter(s => s !== stat));
                          }
                        }} 
                      />
                      <label htmlFor={`fam_link_${stat}`} className="text-[10px] font-mono font-bold uppercase cursor-pointer">
                        {stat.substring(0, 3)}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Cost (MP)</label>
                <Input type="number" min={0} value={abilityCost} onChange={e => setAbilityCost(Number(e.target.value))} required className="bg-background font-mono rounded-none h-9 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Cooldown</label>
                <Input type="number" min={0} value={abilityCooldown} onChange={e => setAbilityCooldown(Number(e.target.value))} required className="bg-background font-mono rounded-none h-9 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Range</label>
                <Input value={abilityRange} onChange={e => setAbilityRange(e.target.value)} required placeholder="e.g. 5 ft, Self" className="bg-background font-serif rounded-none h-9 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
                <Input value={abilitySpeed} onChange={e => setAbilitySpeed(e.target.value)} required placeholder="e.g. Instant" className="bg-background font-serif rounded-none h-9 text-xs" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Roll Formula / Action Modifier (Optional)</label>
              <Input value={abilityRollFormula} onChange={e => setAbilityRollFormula(e.target.value)} placeholder="e.g. 1d6+powr, d20+pre" className="bg-background font-mono rounded-none h-9 text-xs" />
            </div>

            {/* Active Modifiers (Granted While Active) */}
            <div className="border border-border/60 bg-background/40 p-3 rounded-none space-y-3">
              <h5 className="font-serif font-bold text-primary text-xs uppercase tracking-wider">Active Modifiers</h5>
              <div className="grid grid-cols-4 gap-2">
                {STAT_OPTIONS.map(stat => {
                  const stateSetter = {
                    power: [abilityBonusPower, setAbilityBonusPower],
                    vitality: [abilityBonusVitality, setAbilityBonusVitality],
                    spirit: [abilityBonusSpirit, setAbilityBonusSpirit],
                    agility: [abilityBonusAgility, setAbilityBonusAgility],
                    endurance: [abilityBonusEndurance, setAbilityBonusEndurance],
                    precision: [abilityBonusPrecision, setAbilityBonusPrecision],
                    willpower: [abilityBonusWillpower, setAbilityBonusWillpower],
                    charisma: [abilityBonusCharisma, setAbilityBonusCharisma]
                  }[stat];
                  if (!stateSetter) return null;
                  const [val, setter] = stateSetter as [string | number, (v: string | number) => void];
                  return (
                    <div key={stat}>
                      <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">{stat.substring(0,3)}</label>
                      <Input value={val} onChange={e => setter(e.target.value)} className="bg-background font-mono h-7 text-xs rounded-none text-center" />
                    </div>
                  );
                })}
              </div>

              {/* Vitals Modifiers Grid */}
              <div className="grid grid-cols-4 gap-3 border-t border-border/20 pt-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block">HP</label>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                      <Input value={abilityHpAdd} onChange={e => setAbilityHpAdd(e.target.value)} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                      <Input value={abilityHpBuff} onChange={e => setAbilityHpBuff(e.target.value)} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block">Mana</label>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                      <Input value={abilityManaAdd} onChange={e => setAbilityManaAdd(e.target.value)} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                      <Input value={abilityManaBuff} onChange={e => setAbilityManaBuff(e.target.value)} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block">DT</label>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                      <Input value={abilityDtAdd} onChange={e => setAbilityDtAdd(e.target.value)} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                    <div>
                      <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                      <Input value={abilityDtBuff} onChange={e => setAbilityDtBuff(e.target.value)} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase block">Initiative</label>
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-0.5">Bonus</label>
                    <Input value={abilityBonusInitiative} onChange={e => setAbilityBonusInitiative(e.target.value)} placeholder="Bonus" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Resistances (Granted while active)</label>
                <Input value={abilityResistances} onChange={e => setAbilityResistances(e.target.value)} placeholder="e.g. Fire, Piercing" className="bg-background rounded-none h-9 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Immunities (Granted while active)</label>
                <Input value={abilityImmunities} onChange={e => setAbilityImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background rounded-none h-9 text-xs" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description / Effects</label>
              <Textarea value={abilityDescription} onChange={e => setAbilityDescription(e.target.value)} placeholder="Describe what this action does..." className="bg-background font-serif min-h-[70px] rounded-none" />
            </div>

            <div className="flex justify-end gap-2 border-t border-border/20 pt-3 mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsEditingAbility(false)} className="rounded-none">Back</Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-none">
                Save Ability
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 mt-4 text-xs font-sans z-10 relative">
            {/* Base Info */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Familiar Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} required className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Species / Race</label>
                <Input value={race} onChange={e => setRace(e.target.value)} required className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Familiar Rank</label>
                <select 
                  value={className} 
                  onChange={e => setClassName(e.target.value)} 
                  className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="Lesser">Lesser</option>
                  <option value="Greater">Greater</option>
                  <option value="Ascendant">Ascendant</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Level</label>
                <Input type="number" min={1} value={level} onChange={e => setLevel(Number(e.target.value))} required className="bg-background font-mono rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
                <Input type="number" min={0} value={speed} onChange={e => setSpeed(Number(e.target.value))} required className="bg-background font-mono rounded-none" />
              </div>
            </div>

            {/* Attributes Grid */}
            <div className="border-t border-border/20 pt-3">
              <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 font-serif">Attributes</h4>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "POW", val: power, set: setPower },
                  { label: "VIT", val: vitality, set: setVitality },
                  { label: "SPI", val: spirit, set: setSpirit },
                  { label: "AGI", val: agility, set: setAgility },
                  { label: "END", val: endurance, set: setEndurance },
                  { label: "PRE", val: precision, set: setPrecision },
                  { label: "WIL", val: willpower, set: setWillpower },
                  { label: "CHA", val: charisma, set: setCharisma },
                ].map(stat => (
                  <div key={stat.label}>
                    <label className="text-[9px] font-bold text-muted-foreground block mb-0.5">{stat.label}</label>
                    <Input 
                      type="number" 
                      min={0}
                      value={stat.val} 
                      onChange={e => stat.set(Number(e.target.value))} 
                      className="bg-background h-8 font-mono text-center rounded-none text-xs" 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Formulas Grid */}
            <div className="border-t border-border/20 pt-3 space-y-3">
              <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest font-serif">Resource Formulas</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground block mb-0.5">HP Formula</label>
                  <Input value={hpFormula} onChange={e => setHpFormula(e.target.value)} required className="bg-background font-mono text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground block mb-0.5">Mana Formula</label>
                  <Input value={manaFormula} onChange={e => setManaFormula(e.target.value)} required className="bg-background font-mono text-xs rounded-none" />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-muted-foreground block mb-0.5">DT Formula</label>
                  <Input value={dtFormula} onChange={e => setDtFormula(e.target.value)} required className="bg-background font-mono text-xs rounded-none" />
                </div>
              </div>
            </div>

            {/* Resistances & Immunities */}
            <div className="border-t border-border/20 pt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Resistances</label>
                <Input value={resistances} onChange={e => setResistances(e.target.value)} placeholder="e.g. Fire, Slashing" className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Immunities</label>
                <Input value={immunities} onChange={e => setImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background rounded-none" />
              </div>
            </div>

            {/* Familiar Abilities List inside edit dialog */}
            <div className="border-t border-border/20 pt-4 mt-3 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest block font-serif">Familiar Abilities / Actions</label>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => handleStartAddAbility()}
                  className="h-6 text-[9px] uppercase font-mono tracking-wider border-primary/45 text-primary hover:bg-primary/5 rounded-none"
                >
                  + Add Ability
                </Button>
              </div>
              
              {abilities.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 italic font-serif pl-1">No abilities or actions compiled for this familiar.</p>
              ) : (
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {abilities.map((ab, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-background/50 border border-border/40 p-2 text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-serif font-bold text-foreground block truncate">{ab.name}</span>
                        {ab.description && <span className="text-[10px] text-muted-foreground/80 block line-clamp-1 truncate font-serif">{ab.description}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEditAbility(ab, idx)}
                          className="h-6 w-6 text-primary hover:bg-primary/10 rounded-none cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Erase ability "${ab.name}"?`)) {
                              setAbilities(abilities.filter((_, i) => i !== idx));
                            }
                          }}
                          className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-none cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save / Back */}
            <div className="flex justify-end gap-2 border-t border-border/20 pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-none">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-none">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
