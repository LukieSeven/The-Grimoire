import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Trash2, Plus } from "lucide-react";
import { Familiar, FamiliarAbility, evaluateFormula } from "@/lib/storage";

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
  const [abilityDescription, setAbilityDescription] = useState("");
  const [abilityRollFormula, setAbilityRollFormula] = useState("");
  const [abilityCost, setAbilityCost] = useState(0);
  const [abilityRange, setAbilityRange] = useState("Self");
  const [abilitySpeed, setAbilitySpeed] = useState("Instant");
  const [abilityHpAdd, setAbilityHpAdd] = useState<number>(0);
  const [abilityHpBuff, setAbilityHpBuff] = useState<number>(0);
  const [abilityManaAdd, setAbilityManaAdd] = useState<number>(0);
  const [abilityManaBuff, setAbilityManaBuff] = useState<number>(0);
  const [abilityDtAdd, setAbilityDtAdd] = useState<number>(0);
  const [abilityDtBuff, setAbilityDtBuff] = useState<number>(0);

  const handleStartAddAbility = () => {
    setAbilityIndexToEdit(null);
    setAbilityName("");
    setAbilityDescription("");
    setAbilityRollFormula("");
    setAbilityCost(0);
    setAbilityRange("Self");
    setAbilitySpeed("Instant");
    setAbilityHpAdd(0);
    setAbilityHpBuff(0);
    setAbilityManaAdd(0);
    setAbilityManaBuff(0);
    setAbilityDtAdd(0);
    setAbilityDtBuff(0);
    setIsEditingAbility(true);
  };

  const handleStartEditAbility = (ab: FamiliarAbility, idx: number) => {
    setAbilityIndexToEdit(idx);
    setAbilityName(ab.name);
    setAbilityDescription(ab.description);
    setAbilityRollFormula(ab.rollFormula || "");
    setAbilityCost(ab.cost || 0);
    setAbilityRange(ab.range || "Self");
    setAbilitySpeed(ab.speed || "Instant");
    setAbilityHpAdd(ab.hpAdd || 0);
    setAbilityHpBuff(ab.hpBuff || 0);
    setAbilityManaAdd(ab.manaAdd || 0);
    setAbilityManaBuff(ab.manaBuff || 0);
    setAbilityDtAdd(ab.dtAdd || 0);
    setAbilityDtBuff(ab.dtBuff || 0);
    setIsEditingAbility(true);
  };

  const handleSaveAbility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!abilityName.trim()) return;

    const newAbility: FamiliarAbility = {
      id: abilityIndexToEdit !== null ? (abilities[abilityIndexToEdit].id || Date.now()) : Date.now(),
      name: abilityName,
      description: abilityDescription,
      rollFormula: abilityRollFormula,
      cost: abilityCost,
      range: abilityRange,
      speed: abilitySpeed,
      hpAdd: abilityHpAdd,
      hpBuff: abilityHpBuff,
      manaAdd: abilityManaAdd,
      manaBuff: abilityManaBuff,
      dtAdd: abilityDtAdd,
      dtBuff: abilityDtBuff,
      cooldown: 0,
      linkedStats: [],
      assignedToQuickRolls: false
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
      dtbonus: familiar.dtBonus || 0,
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
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none p-6">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Name</label>
                <Input value={abilityName} onChange={e => setAbilityName(e.target.value)} required placeholder="e.g. Bite, Shadow Dash" className="bg-background rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Cost (MP)</label>
                <Input type="number" min={0} value={abilityCost} onChange={e => setAbilityCost(Number(e.target.value))} required className="bg-background font-mono rounded-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description / Effects</label>
              <Textarea value={abilityDescription} onChange={e => setAbilityDescription(e.target.value)} placeholder="Describe what this action does..." className="bg-background font-serif min-h-[70px] rounded-none" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Roll Formula / Action Modifier (Optional)</label>
                <Input value={abilityRollFormula} onChange={e => setAbilityRollFormula(e.target.value)} placeholder="e.g. 1d6+powr, d20+pre" className="bg-background font-mono rounded-none" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Range</label>
                <Input value={abilityRange} onChange={e => setAbilityRange(e.target.value)} required placeholder="e.g. 5 ft" className="bg-background font-serif rounded-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
                <Input value={abilitySpeed} onChange={e => setAbilitySpeed(e.target.value)} required placeholder="e.g. Instant" className="bg-background font-serif rounded-none" />
              </div>
            </div>

            {/* Vitals Modifiers Grid */}
            <div className="grid grid-cols-3 gap-3 border-t border-border/20 pt-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase block">HP</label>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                    <Input type="number" value={abilityHpAdd} onChange={e => setAbilityHpAdd(Number(e.target.value))} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                  </div>
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                    <Input type="number" value={abilityHpBuff} onChange={e => setAbilityHpBuff(Number(e.target.value))} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase block">Mana</label>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                    <Input type="number" value={abilityManaAdd} onChange={e => setAbilityManaAdd(Number(e.target.value))} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                  </div>
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                    <Input type="number" value={abilityManaBuff} onChange={e => setAbilityManaBuff(Number(e.target.value))} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-muted-foreground uppercase block">DT</label>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                    <Input type="number" value={abilityDtAdd} onChange={e => setAbilityDtAdd(Number(e.target.value))} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                  </div>
                  <div>
                    <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                    <Input type="number" value={abilityDtBuff} onChange={e => setAbilityDtBuff(Number(e.target.value))} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                  </div>
                </div>
              </div>
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
