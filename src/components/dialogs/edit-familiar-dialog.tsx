import React, { useEffect, useRef, useState } from "react";
import { LiveAbilityEditor } from "./ability-builder";
import { previewAbilityDialogClass, previewAbilityHeaderClass, previewAbilityTitleClass } from "../ability-editor-prototype/preview-entry";
import type { Ability } from "@/lib/storage";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Familiar, FamiliarAbility } from "@/lib/storage";
import { parseFormulaOrNum } from "@/lib/storage";
import { getFamiliarMovementSpeed, familiarMovementExpression, FAMILIAR_RANKS } from "@/lib/familiar-values";

interface EditFamiliarDialogProps {
  characterId: number;
  familiar: Familiar;
  onSave: (updated: Familiar, callbacks: { onSuccess: () => void; onError: (error: Error) => void }) => void;
}

export function EditFamiliarDialog({ familiar, onSave, characterId }: EditFamiliarDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [name, setName] = useState(familiar.name);
  const [race, setRace] = useState(familiar.race);
  const [className, setClassName] = useState(familiar.className); // Rank
  const [movement, setMovement] = useState(() => familiarMovementExpression(familiar));
  const [movementEdited, setMovementEdited] = useState(false);
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
  const savedAbilities = useRef(familiar.abilities || []);

  const [isEditingAbility, setIsEditingAbility] = useState(false);
  const [abilityIndexToEdit, setAbilityIndexToEdit] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnControl = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const handleStartAddAbility = () => { setAbilityIndexToEdit(null); setIsEditingAbility(true); };
  const handleStartEditAbility = (_ability: FamiliarAbility, index: number) => { setAbilityIndexToEdit(index); setIsEditingAbility(true); };
  const closeAbilityEditor = () => { restoreFocus.current = true; setIsEditingAbility(false); };
  const initialAbility = abilityIndexToEdit === null ? null : { ...abilities[abilityIndexToEdit], characterId } as Ability;
  const owner = { kind: "familiar" as const, name: familiar.name, familiarId: familiar.id };

  useEffect(() => {
    if (isEditingAbility) titleRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      returnControl.current?.focus();
    }
  }, [isEditingAbility]);

  const movementStats = { power, vitality, spirit, agility, endurance, precision, willpower, charisma, rank: className };
  const movementSpeed = getFamiliarMovementSpeed(movement, { ...movementStats, dtbonus: parseFormulaOrNum(familiar.dtBonus, movementStats) });
  const movementChanged = movementEdited && movement.trim() !== familiarMovementExpression(familiar).trim();
  const invalidMovement = movementChanged && movementSpeed === undefined;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || invalidMovement || saving) return;

    const updated: Familiar = {
      ...familiar,
      name,
      race,
      className,
      ...(movementChanged && movementSpeed !== undefined
        ? { speed: movementSpeed, speedFormula: movement.trim() }
        : {}),
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
      abilities, // Save updated abilities
    };

    setSaving(true);
    onSave(updated, {
      onSuccess: () => { setSaving(false); setIsOpen(false); },
      onError: error => { setSaving(false); toast.error(error.message); },
    });
  };

  const saveAbility = (draft: Omit<Ability, "id">) => {
    if (saving) return;
    const existing = abilityIndexToEdit === null ? undefined : abilities[abilityIndexToEdit];
    const ability = { ...existing, ...draft, id: existing?.id ?? Date.now() } as FamiliarAbility;
    const updateList = (list: FamiliarAbility[]) => existing
      ? list.map(entry => entry.id === existing.id ? ability : entry)
      : [...list, ability];
    const next = updateList(savedAbilities.current);
    setSaving(true);
    // Save only the child edit. Pending changes (including deletions) in the parent form still need its Save Changes.
    onSave({ ...familiar, abilities: next }, {
      onSuccess: () => {
        savedAbilities.current = next;
        setAbilities(updateList);
        setSaving(false);
        toast.success("Familiar ability saved.");
        closeAbilityEditor();
      },
      onError: error => { setSaving(false); toast.error(error.message); },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && saving) return;
      if (!open && isEditingAbility) { closeAbilityEditor(); return; }
      if (open) {
        setName(familiar.name);
        setRace(familiar.race);
        setClassName(familiar.className);
        setMovement(familiarMovementExpression(familiar));
        setMovementEdited(false);
        setLevel(familiar.level || 1);
        setPower(familiar.power);
        setVitality(familiar.vitality);
        setSpirit(familiar.spirit);
        setAgility(familiar.agility);
        setEndurance(familiar.endurance);
        setPrecision(familiar.precision);
        setWillpower(familiar.willpower);
        setCharisma(familiar.charisma);
        setHpFormula(familiar.hpFormula || "Vitality * 8");
        setManaFormula(familiar.manaFormula || "Spirit * 5");
        setDtFormula(familiar.dtFormula || "Endurance * 1");
        setResistances(familiar.resistances || "");
        setImmunities(familiar.immunities || "");
        savedAbilities.current = familiar.abilities || [];
        setAbilities(savedAbilities.current);
      }
      setIsOpen(open);
      if (!open) setIsEditingAbility(false);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-primary/40 text-primary hover:bg-primary/10 rounded-none cursor-pointer text-xs font-bold font-serif px-3">
          <Edit2 className="w-3 h-3 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className={isEditingAbility ? previewAbilityDialogClass : "md:max-w-[800px] lg:max-w-[900px] sm:max-w-[650px] w-[95vw] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none p-6"}>
        {!isEditingAbility && <>
          <div className="absolute inset-1 border border-border/10 pointer-events-none" />
          <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />
        </>}

        <DialogHeader className={isEditingAbility ? previewAbilityHeaderClass : "border-b border-border/20 pb-2 z-10 relative"}>
          <DialogTitle ref={isEditingAbility ? titleRef : undefined} tabIndex={isEditingAbility ? -1 : undefined} className={isEditingAbility ? previewAbilityTitleClass : "font-serif text-lg text-primary font-bold"}>
            {isEditingAbility
              ? `${abilityIndexToEdit === null ? "New" : "Edit"} Familiar Ability: ${familiar.name}`
              : `Edit Familiar: ${familiar.name}`
            }
          </DialogTitle>
          {isEditingAbility && <DialogDescription>Save an ability for this familiar without changing its other details.</DialogDescription>}
        </DialogHeader>

        {isEditingAbility ? (
          <LiveAbilityEditor characterId={characterId} owner={owner} initial={initialAbility} source={familiar.name} pending={saving} onSave={saveAbility} onClose={closeAbilityEditor} />
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
                <label htmlFor={`familiar-rank-${familiar.id}`} className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Familiar Rank</label>
                <select 
                  id={`familiar-rank-${familiar.id}`}
                  value={className} 
                  onChange={e => setClassName(e.target.value)} 
                  className="w-full h-9 rounded-none border border-border/60 bg-background px-3 py-1 text-xs shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {!FAMILIAR_RANKS.includes(familiar.className) && <option value={familiar.className}>{familiar.className || "Unspecified (saved)"}</option>}
                  {FAMILIAR_RANKS.map(rank => <option key={rank} value={rank}>{rank}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Level</label>
                <Input type="number" min={1} value={level} onChange={e => setLevel(Number(e.target.value))} required className="bg-background font-mono rounded-none" />
              </div>
              <div>
                <label htmlFor={`familiar-movement-${familiar.id}`} className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Movement Speed</label>
                <Input id={`familiar-movement-${familiar.id}`} value={movement} onChange={e => { setMovement(e.target.value); setMovementEdited(true); }} placeholder="e.g. 25 or Agility * 5" className="bg-background font-mono rounded-none" aria-describedby={`familiar-movement-help-${familiar.id}`} aria-invalid={invalidMovement || undefined} />
                <output id={`familiar-movement-help-${familiar.id}`} htmlFor={`familiar-movement-${familiar.id}`} className={`mt-1 block ${invalidMovement ? "text-destructive" : "text-muted-foreground"}`}>
                  {movementSpeed !== undefined ? `${movementSpeed} ft (base)` : invalidMovement ? "Enter a valid movement formula or a number of feet, including 0." : "Existing formula retained. Enter a valid formula to change movement."}
                </output>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                  ref={abilityIndexToEdit === null ? returnControl : undefined}
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
                    <div key={ab.id} className="flex justify-between items-center bg-background/50 border border-border/40 p-2 text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-serif font-bold text-foreground block truncate">{ab.name}</span>
                        {ab.description && <span className="text-[10px] text-muted-foreground/80 block line-clamp-1 truncate font-serif">{ab.description}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          ref={abilityIndexToEdit === idx ? returnControl : undefined}
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ability: ${ab.name}`}
                          onClick={() => handleStartEditAbility(ab, idx)}
                          className="h-6 w-6 text-primary hover:bg-primary/10 rounded-none cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ability: ${ab.name}`}
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
              <Button type="button" variant="ghost" disabled={saving} onClick={() => setIsOpen(false)} className="rounded-none">Cancel</Button>
              <Button type="submit" disabled={saving || invalidMovement} className="bg-primary text-primary-foreground font-serif rounded-none">
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
