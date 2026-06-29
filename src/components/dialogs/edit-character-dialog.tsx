import React, { useState, useEffect } from "react";
import { useUpdateCharacter } from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit2 } from "lucide-react";
import { Character } from "@/lib/storage";

interface Props {
  character: Character;
}

export function EditCharacterDialog({ character }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const updateChar = useUpdateCharacter();

  // Form State
  const [name, setName] = useState(character.name);
  const [rank, setRank] = useState(character.rank || "Iron");
  const [race, setRace] = useState(character.race);
  const [level, setLevel] = useState(character.level);
  const [speed, setSpeed] = useState(character.speed);
  const [dtBonus, setDtBonus] = useState(character.dtBonus);
  const [resistances, setResistances] = useState(character.resistances || "");
  const [immunities, setImmunities] = useState(character.immunities || "");

  // Stats
  const [power, setPower] = useState(character.power);
  const [vitality, setVitality] = useState(character.vitality);
  const [spirit, setSpirit] = useState(character.spirit);
  const [agility, setAgility] = useState(character.agility);
  const [endurance, setEndurance] = useState(character.endurance);
  const [precision, setPrecision] = useState(character.precision);
  const [willpower, setWillpower] = useState(character.willpower);
  const [charisma, setCharisma] = useState(character.charisma);

  // Formulas
  const [hpFormula, setHpFormula] = useState(character.hpFormula || "Vitality * 10 + Endurance * 5");
  const [manaFormula, setManaFormula] = useState(character.manaFormula || "Spirit * 10 + Willpower * 5");
  const [dtFormula, setDtFormula] = useState(character.dtFormula || "Endurance * 2 + dtBonus");

  const [background, setBackground] = useState(character.background || "");
  const [backstory, setBackstory] = useState(character.backstory || "");

  // Sync state with prop updates
  useEffect(() => {
    if (character) {
      setName(character.name);
      setRank(character.rank || "Iron");
      setRace(character.race);
      setLevel(character.level);
      setSpeed(character.speed);
      setDtBonus(character.dtBonus);
      setResistances(character.resistances || "");
      setImmunities(character.immunities || "");
      setPower(character.power);
      setVitality(character.vitality);
      setSpirit(character.spirit);
      setAgility(character.agility);
      setEndurance(character.endurance);
      setPrecision(character.precision);
      setWillpower(character.willpower);
      setCharisma(character.charisma);
      setHpFormula(character.hpFormula);
      setManaFormula(character.manaFormula);
      setDtFormula(character.dtFormula);
      setBackground(character.background || "");
      setBackstory(character.backstory || "");
    }
  }, [character, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateChar.mutate(
      {
        id: character.id,
        data: {
          name,
          rank,
          race,
          level: character.level,
          speed,
          dtBonus,
          resistances,
          immunities,
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
          background: background || null,
          backstory: backstory || null,
        },
      },
      {
        onSuccess: () => setIsOpen(false),
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
          <Edit2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-primary font-bold">
            Forge Hero Attributes
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4 font-sans text-sm">
          {/* Base details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} required className="bg-background" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Rank</label>
              <select
                value={rank}
                onChange={e => setRank(e.target.value)}
                className="w-full bg-background border border-input h-10 px-3 rounded-md text-sm outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="Iron">Iron</option>
                <option value="Bronze">Bronze</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Diamond">Diamond</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Race</label>
              <Input value={race} onChange={e => setRace(e.target.value)} required className="bg-background" />
            </div>
          </div>

          {/* Level, speed, flat DT bonus */}
          {/* Speed & DT Bonus */}
          <div className="grid grid-cols-2 gap-4 border-t border-border/30 pt-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Speed (Feet)</label>
              <Input type="number" min={0} value={speed} onChange={e => setSpeed(Number(e.target.value))} required className="bg-background font-mono" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Base DT Bonus (Armor)</label>
              <Input type="number" min={0} value={dtBonus} onChange={e => setDtBonus(Number(e.target.value))} required className="bg-background font-mono" />
            </div>
          </div>

          {/* Resistances & Immunities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/30 pt-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Resistances</label>
              <Input value={resistances} onChange={e => setResistances(e.target.value)} placeholder="e.g. Fire, Slash" className="bg-background" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Immunities</label>
              <Input value={immunities} onChange={e => setImmunities(e.target.value)} placeholder="e.g. Poison, Fear" className="bg-background" />
            </div>
          </div>

          {/* Attributes */}
          <div className="border-t border-border/30 pt-4">
            <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Base Stats</h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Power (POW)", val: power, set: setPower },
                { label: "Vitality (VIT)", val: vitality, set: setVitality },
                { label: "Spirit (SPI)", val: spirit, set: setSpirit },
                { label: "Agility (AGI)", val: agility, set: setAgility },
                { label: "Endurance (END)", val: endurance, set: setEndurance },
                { label: "Precision (PRE)", val: precision, set: setPrecision },
                { label: "Willpower (WIL)", val: willpower, set: setWillpower },
                { label: "Charisma (CHA)", val: charisma, set: setCharisma },
              ].map(stat => (
                <div key={stat.label} className="bg-background/40 p-2.5 rounded-md border border-border/40 text-center">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">{stat.label}</label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={stat.val}
                    onChange={e => stat.set(Math.min(30, Math.max(0, Number(e.target.value))))}
                    className="text-center font-mono h-8 bg-background"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Custom Formulas */}
          <div className="border-t border-border/30 pt-4 space-y-3">
            <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Derived Attribute Formulas</h3>
            <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
              Define standard math strings using variable tags (e.g. <code className="text-primary bg-accent px-1 rounded">Vitality</code>, <code className="text-primary bg-accent px-1 rounded">Endurance</code>, <code className="text-primary bg-accent px-1 rounded">Spirit</code>, <code className="text-primary bg-accent px-1 rounded">Willpower</code>, <code className="text-primary bg-accent px-1 rounded">dtBonus</code>).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">HP Formula</label>
                <Input value={hpFormula} onChange={e => setHpFormula(e.target.value)} required className="bg-background font-mono text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Mana Formula</label>
                <Input value={manaFormula} onChange={e => setManaFormula(e.target.value)} required className="bg-background font-mono text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">DT Formula</label>
                <Input value={dtFormula} onChange={e => setDtFormula(e.target.value)} required className="bg-background font-mono text-xs" />
              </div>
            </div>
          </div>

          {/* Lore fields */}
          <div className="grid grid-cols-1 gap-4 border-t border-border/30 pt-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Background Summary</label>
              <Input value={background} onChange={e => setBackground(e.target.value)} placeholder="e.g. Captain of the walls" className="bg-background" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Backstory (Markdown supported)</label>
              <Textarea
                value={backstory}
                onChange={e => setBackstory(e.target.value)}
                className="min-h-[120px] bg-background font-serif"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-border/30 pt-4 gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button type="submit" className="bg-primary text-primary-foreground font-serif">Save Modifications</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
