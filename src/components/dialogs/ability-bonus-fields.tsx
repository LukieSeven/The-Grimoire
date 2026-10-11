import { BONUS_FIELDS } from "../../lib/ability-bonuses";
import type { AbilityBonuses } from "../../lib/ability-bonuses";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

type BonusKey = typeof BONUS_FIELDS[number][0];
const resources = [
  { name: "Health", unit: "HP", keys: ["hpAdd", "hpBuff"] },
  { name: "Mana", unit: "MP", keys: ["manaAdd", "manaBuff"] },
  { name: "Damage Threshold", unit: "DT", keys: ["dtAdd", "dtBuff"] },
] as const;

export function AbilityBonusFields({ bonuses, onChange, skillNames = [] }: { bonuses: AbilityBonuses; onChange: (bonuses: AbilityBonuses) => void; skillNames?: string[] }) {
  const selected = bonuses.checkSkills ?? [];
  const choices = [...new Map([...BONUS_FIELDS.slice(0, 8).map(([, label]) => label.toLowerCase()), ...skillNames, ...selected].map(value => [value.toLowerCase(), value])).values()];
  const field = "block w-full min-w-0 h-8 rounded-md border border-border/50 bg-background/70 px-2 text-xs font-mono text-foreground transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30";
  const input = (key: BonusKey, label: string) => <input aria-label={label} className={field} value={bonuses[key] ?? ""} onChange={event => onChange({ ...bonuses, [key]: event.target.value })}/>;
  return <fieldset className="min-w-0 space-y-4 border-t border-border/40 pt-3">
    <legend className="text-xs font-semibold text-primary px-1">Bonuses & Debuffs</legend>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{BONUS_FIELDS.slice(0, 8).map(([key, label]) => <label key={key} className="min-w-0 rounded-md border border-border/30 bg-background/20 p-2 space-y-1.5"><span className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>{input(key, `${label} modifier`)}</label>)}</div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{resources.map(resource => <fieldset key={resource.unit} className="min-w-0 rounded-md border border-border/40 bg-background/20 p-2.5 space-y-2">
      <legend className="px-1 text-xs font-semibold text-foreground">{resource.name} <span className="text-muted-foreground text-[10px]">{resource.unit}</span></legend>
      {resource.keys.map((key, index) => <label key={key} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2 text-[11px] text-muted-foreground"><span>{["Add", "Buff"][index]}</span>{input(key, `${resource.name} ${["Add", "Buff"][index]}`)}</label>)}
    </fieldset>)}</div>
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)] gap-2">
      <label className="min-w-0 space-y-1.5"><span className="block text-[11px] text-muted-foreground">Initiative</span>{input("bonusInitiative", "Initiative modifier")}</label>
      {(["resistances", "immunities", "vulnerabilities"] as const).map(key => <label key={key} className="min-w-0 space-y-1.5"><span className="block text-[11px] text-muted-foreground capitalize">{key}</span><input className={`${field} font-sans`} value={bonuses[key] ?? ""} onChange={event => onChange({ ...bonuses, [key]: event.target.value })}/></label>)}
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{BONUS_FIELDS.slice(18).map(([key, label]) => <label key={key} className="text-xs">{label}{input(key, label)}</label>)}</div>
    <fieldset><legend className="text-xs">Resistance roll attributes (none selected = all)</legend><div className="flex flex-wrap gap-3">{["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"].map(stat => <label key={stat} className="text-xs capitalize"><input type="checkbox" checked={bonuses.resistanceAttributes?.includes(stat) ?? false} onChange={event => onChange({ ...bonuses, resistanceAttributes: event.target.checked ? [...(bonuses.resistanceAttributes ?? []), stat] : bonuses.resistanceAttributes?.filter(value => value !== stat) })}/> {stat}</label>)}</div></fieldset>
    <div className="text-xs"><span className="block">Applies to</span><Popover><PopoverTrigger asChild><button type="button" aria-label="Applies to" className={`${field} text-left font-sans truncate`}>{selected.length ? selected.map(value => value.charAt(0).toUpperCase() + value.slice(1)).join(", ") : "All skill/check rolls"}</button></PopoverTrigger><PopoverContent className="max-h-64 overflow-y-auto space-y-2"><label className="flex gap-2 items-center text-xs"><input type="checkbox" checked={!selected.length} onChange={() => onChange({ ...bonuses, checkSkills: [] })}/>All skill/check rolls</label>{choices.map(value => <label key={value.toLowerCase()} className="flex gap-2 items-center text-xs capitalize"><input type="checkbox" checked={selected.some(entry => entry.toLowerCase() === value.toLowerCase())} onChange={event => onChange({ ...bonuses, checkSkills: event.target.checked ? [...selected, value] : selected.filter(entry => entry.toLowerCase() !== value.toLowerCase()) })}/>{value}</label>)}</PopoverContent></Popover></div>
    <p className="text-[11px] text-muted-foreground">Positive or negative values and attribute formulas. Leave unused fields blank.</p>
  </fieldset>;
}
