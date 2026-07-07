import React, { useState, useEffect } from "react";
import { useAddAbility, useUpdateAbility } from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Ability } from "@/lib/storage";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  characterId: number;
  equipmentId: number | null;
  inventoryItemId: number | null;
  initialData: Ability | null;
}

const STAT_OPTIONS = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];

export function EditItemAbilityDialog({ isOpen, onOpenChange, characterId, equipmentId, inventoryItemId, initialData }: Props) {
  const addAbility = useAddAbility();
  const updateAbility = useUpdateAbility();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [range, setRange] = useState("Self");
  const [speed, setSpeed] = useState("Instant");
  const [rollFormula, setRollFormula] = useState("");
  const [type, setType] = useState("");
  const [linkedStats, setLinkedStats] = useState<string[]>([]);
  const [assignedToQuickRolls, setAssignedToQuickRolls] = useState(false);
  const [resistances, setResistances] = useState("");
  const [immunities, setImmunities] = useState("");

  // Usage & Charges State
  const [usageType, setUsageType] = useState<"standard" | "one-time" | "rechargeable">("standard");
  const [maxCharges, setMaxCharges] = useState<number>(0);

  // Stat Modifiers
  const [bonusPower, setBonusPower] = useState<number>(0);
  const [bonusVitality, setBonusVitality] = useState<number>(0);
  const [bonusSpirit, setBonusSpirit] = useState<number>(0);
  const [bonusAgility, setBonusAgility] = useState<number>(0);
  const [bonusEndurance, setBonusEndurance] = useState<number>(0);
  const [bonusPrecision, setBonusPrecision] = useState<number>(0);
  const [bonusWillpower, setBonusWillpower] = useState<number>(0);
  const [bonusCharisma, setBonusCharisma] = useState<number>(0);

  const [hpAdd, setHpAdd] = useState<number>(0);
  const [hpBuff, setHpBuff] = useState<number>(0);
  const [manaAdd, setManaAdd] = useState<number>(0);
  const [manaBuff, setManaBuff] = useState<number>(0);
  const [dtAdd, setDtAdd] = useState<number>(0);
  const [dtBuff, setDtBuff] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || "");
        setDescription(initialData.description || "");
        setCost(initialData.cost || 0);
        setCooldown(initialData.cooldown || 0);
        setRange(initialData.range || "Self");
        setSpeed(initialData.speed || "Instant");
        setRollFormula(initialData.rollFormula || "");
        setType(initialData.type || "");
        setLinkedStats(initialData.linkedStats || []);
        setAssignedToQuickRolls(!!initialData.assignedToQuickRolls);
        setResistances(initialData.resistances || "");
        setImmunities(initialData.immunities || "");
        setBonusPower(initialData.bonusPower || 0);
        setBonusVitality(initialData.bonusVitality || 0);
        setBonusSpirit(initialData.bonusSpirit || 0);
        setBonusAgility(initialData.bonusAgility || 0);
        setBonusEndurance(initialData.bonusEndurance || 0);
        setBonusPrecision(initialData.bonusPrecision || 0);
        setBonusWillpower(initialData.bonusWillpower || 0);
        setBonusCharisma(initialData.bonusCharisma || 0);
        setHpAdd(initialData.hpAdd || 0);
        setHpBuff(initialData.hpBuff || 0);
        setManaAdd(initialData.manaAdd || 0);
        setManaBuff(initialData.manaBuff || 0);
        setDtAdd(initialData.dtAdd || 0);
        setDtBuff(initialData.dtBuff || 0);
        
        // Load usage
        setUsageType((initialData.usageType as any) || "standard");
        setMaxCharges(initialData.maxCharges || 0);
      } else {
        setName("");
        setDescription("");
        setCost(0);
        setCooldown(0);
        setRange("Self");
        setSpeed("Instant");
        setRollFormula("");
        setType("");
        setLinkedStats([]);
        setAssignedToQuickRolls(false);
        setResistances("");
        setImmunities("");
        setBonusPower(0);
        setBonusVitality(0);
        setBonusSpirit(0);
        setBonusAgility(0);
        setBonusEndurance(0);
        setBonusPrecision(0);
        setBonusWillpower(0);
        setBonusCharisma(0);
        setHpAdd(0);
        setHpBuff(0);
        setManaAdd(0);
        setManaBuff(0);
        setDtAdd(0);
        setDtBuff(0);

        // Reset usage
        setUsageType("standard");
        setMaxCharges(0);
      }
    }
  }, [isOpen, initialData]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      characterId,
      equipmentId: equipmentId || null,
      inventoryItemId: inventoryItemId || null,
      name,
      description,
      cost,
      cooldown,
      range,
      speed,
      rollFormula,
      type,
      linkedStats,
      assignedToQuickRolls,
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
      level: initialData ? initialData.level : 1,
      active: initialData ? !!initialData.active : false,
      usageType,
      maxCharges: usageType === "rechargeable" ? maxCharges : 0,
      currentCharges: initialData && initialData.usageType === usageType
        ? (initialData.currentCharges ?? maxCharges)
        : maxCharges
    };

    if (initialData) {
      updateAbility.mutate({
        id: initialData.id,
        data: payload
      }, {
        onSuccess: () => {
          toast.success("Item ability updated.");
          onOpenChange(false);
        }
      });
    } else {
      addAbility.mutate(payload, {
        onSuccess: () => {
          toast.success("Item ability added.");
          onOpenChange(false);
        }
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none p-5">
        <div className="absolute inset-1 border border-border/10 pointer-events-none" />
        <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

        <DialogHeader className="border-b border-border/30 pb-2 z-10 relative">
          <DialogTitle className="font-serif text-2xl text-primary font-bold">
            {initialData ? "Edit Item Ability" : "Add Item Ability"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-3 font-sans text-xs z-10 relative">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ability Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Cleave, Fireball" className="bg-background font-serif rounded-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Type</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value)} 
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

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Description / Effects</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the effects of this ability..." className="bg-background font-serif min-h-[70px] rounded-none" />
          </div>

          {/* Usage Type & Charges settings */}
          <div className="grid grid-cols-2 gap-3 border-t border-border/20 pt-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Usage Type</label>
              <select 
                value={usageType} 
                onChange={e => setUsageType(e.target.value as any)} 
                className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm text-foreground focus:outline-none"
              >
                <option value="standard">Standard / Infinite</option>
                <option value="one-time">One time use (Deducts Quantity)</option>
                <option value="rechargeable">Rechargeable (Uses Charges)</option>
              </select>
            </div>
            {usageType === "rechargeable" && (
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Max Charges</label>
                <Input 
                  type="number" 
                  min={1} 
                  value={maxCharges} 
                  onChange={e => setMaxCharges(Math.max(1, Number(e.target.value)))} 
                  required 
                  className="bg-background font-mono rounded-none h-9 text-xs" 
                />
              </div>
            )}
          </div>

          {/* Linked Attributes checkboxes */}
          <div className="border-t border-border/20 pt-3">
            <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">Linked Attributes (For Roll Modifiers)</label>
            <div className="grid grid-cols-4 gap-2">
              {STAT_OPTIONS.map(stat => {
                const isChecked = linkedStats.includes(stat);
                return (
                  <div key={stat} className="flex items-center gap-2 bg-background border border-border/40 p-2 rounded-none">
                    <Checkbox 
                      id={`item_link_${stat}`} 
                      checked={isChecked} 
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setLinkedStats([...linkedStats, stat]);
                        } else {
                          setLinkedStats(linkedStats.filter(s => s !== stat));
                        }
                      }} 
                    />
                    <label htmlFor={`item_link_${stat}`} className="text-[10px] font-mono font-bold uppercase cursor-pointer">
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
              <Input type="number" min={0} value={cost} onChange={e => setCost(Number(e.target.value))} required className="bg-background font-mono rounded-none h-9 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Cooldown</label>
              <Input type="number" min={0} value={cooldown} onChange={e => setCooldown(Number(e.target.value))} required className="bg-background font-mono rounded-none h-9 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Range</label>
              <Input value={range} onChange={e => setRange(e.target.value)} required placeholder="e.g. 5 ft, Self" className="bg-background font-serif rounded-none h-9 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Speed</label>
              <Input value={speed} onChange={e => setSpeed(e.target.value)} required placeholder="e.g. Instant, 1 action" className="bg-background font-serif rounded-none h-9 text-xs" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Roll Formula / Modifier (Optional)</label>
            <Input value={rollFormula} onChange={e => setRollFormula(e.target.value)} placeholder="e.g. d20+powr+6, 2d6+prer" className="bg-background font-mono rounded-none h-9 text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border/20 pt-3">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Resistances (Granted while active)</label>
              <Input value={resistances} onChange={e => setResistances(e.target.value)} placeholder="e.g. Fire, Piercing" className="bg-background rounded-none h-9 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Immunities (Granted while active)</label>
              <Input value={immunities} onChange={e => setImmunities(e.target.value)} placeholder="e.g. Poison, Stun" className="bg-background rounded-none h-9 text-xs" />
            </div>
          </div>

          {/* Stat Modifiers Grid */}
          <div className="border-t border-border/20 pt-3 space-y-2">
            <h5 className="font-serif font-bold text-primary text-sm">Stat Modifiers (Granted while active)</h5>
            <div className="grid grid-cols-4 gap-2">
              {STAT_OPTIONS.map(stat => {
                const stateSetter = {
                  power: [bonusPower, setBonusPower],
                  vitality: [bonusVitality, setBonusVitality],
                  spirit: [bonusSpirit, setBonusSpirit],
                  agility: [bonusAgility, setBonusAgility],
                  endurance: [bonusEndurance, setBonusEndurance],
                  precision: [bonusPrecision, setBonusPrecision],
                  willpower: [bonusWillpower, setBonusWillpower],
                  charisma: [bonusCharisma, setBonusCharisma]
                }[stat];
                if (!stateSetter) return null;
                const [val, setter] = stateSetter;
                return (
                  <div key={stat}>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-0.5">{stat.substring(0,3)}</label>
                    <Input type="number" value={val as number} onChange={e => (setter as any)(Number(e.target.value))} className="bg-background font-mono h-7 text-xs rounded-none text-center" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vitals Modifiers Grid */}
          <div className="grid grid-cols-3 gap-3 border-t border-border/20 pt-3">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted-foreground uppercase block">HP</label>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                  <Input type="number" value={hpAdd} onChange={e => setHpAdd(Number(e.target.value))} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                  <Input type="number" value={hpBuff} onChange={e => setHpBuff(Number(e.target.value))} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted-foreground uppercase block">Mana</label>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                  <Input type="number" value={manaAdd} onChange={e => setManaAdd(Number(e.target.value))} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                  <Input type="number" value={manaBuff} onChange={e => setManaBuff(Number(e.target.value))} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-muted-foreground uppercase block">DT</label>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <label className="text-[8px] text-muted-foreground block mb-0.5">Add</label>
                  <Input type="number" value={dtAdd} onChange={e => setDtAdd(Number(e.target.value))} placeholder="Add" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                </div>
                <div>
                  <label className="text-[8px] text-muted-foreground block mb-0.5">Buff</label>
                  <Input type="number" value={dtBuff} onChange={e => setDtBuff(Number(e.target.value))} placeholder="Buff" className="bg-background font-mono h-7 text-[10px] rounded-none text-center p-0.5" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox 
              id="item_quick_roll" 
              checked={assignedToQuickRolls} 
              onCheckedChange={(checked) => setAssignedToQuickRolls(!!checked)} 
            />
            <label htmlFor="item_quick_roll" className="font-bold text-[10px] text-muted-foreground uppercase cursor-pointer">
              Assign to Quick Rolls list
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/30 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-none">Cancel</Button>
            <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-none">
              Save Ability
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
