import { useId, useState } from "react";
import { BONUS_FIELDS, hasModifierValue } from "../../lib/ability-bonuses";
import type { AbilityBonuses } from "../../lib/ability-bonuses";
import { Button } from "../ui/button";
import { SectionHelp } from "./section-help";

interface Props {
  bonuses: AbilityBonuses;
  onChange: (bonuses: AbilityBonuses) => void;
  skillNames?: string[];
  newEffect?: "Modifier" | "Immunity" | "Temporary resource";
}
type NumericKey = typeof BONUS_FIELDS[number][0];
type ModifierKey = NumericKey | "resistances" | "immunities" | "vulnerabilities";
const legacy = new Set<ModifierKey>(["bonusHp", "bonusMana", "bonusDt"]);
const labelOverrides: Partial<Record<ModifierKey, string>> = {
  hpAdd: "Restore HP", hpBuff: "Temporary max HP", manaAdd: "Restore MP", manaBuff: "Temporary max MP",
  dtAdd: "Restore DT", dtBuff: "Temporary max DT",
  bonusHp: "Health · Buff (legacy)", bonusMana: "Mana · Buff (legacy)", bonusDt: "Damage Threshold · Buff (legacy)",
};
const choices: [ModifierKey, string][] = [
  ...BONUS_FIELDS.map(([key, label]) => [key, labelOverrides[key] ?? label] as [ModifierKey, string]),
  ["resistances", "Resistances"], ["immunities", "Immune to"], ["vulnerabilities", "Vulnerabilities"],
];
const temporaryChoices: [ModifierKey, string][] = [["hpBuff", "HP"], ["manaBuff", "MP"], ["dtBuff", "DT"]];
const modifierChoices = choices.filter(([key]) => !legacy.has(key) && key !== "immunities" && !temporaryChoices.some(([resourceKey]) => resourceKey === key));
const resourceKeys = new Set<ModifierKey>(["hpAdd", "hpBuff", "manaAdd", "manaBuff", "dtAdd", "dtBuff", "bonusHp", "bonusMana", "bonusDt"]);
const rollKeys = new Set<ModifierKey>(["bonusInitiative", "bonusAttackRoll", "bonusSkillCheck", "bonusResistanceRoll"]);
const textKeys = new Set<ModifierKey>(["resistances", "immunities", "vulnerabilities"]);
const defenseKeys = new Set<ModifierKey>([...textKeys, "bonusDodgeRoll", "damageReduction", "armorPenetration", "dtPenetration"]);
const groups = ["Attributes & movement", "Resources", "Rolls", "Defense"] as const;
const groupFor = (key: ModifierKey) => resourceKeys.has(key) ? groups[1] : rollKeys.has(key) ? groups[2] : defenseKeys.has(key) ? groups[3] : groups[0];
const attributeNames = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];
const field = "block w-full min-w-0 rounded-md border border-border/50 bg-background px-2 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary";

export function ModifierFields({ bonuses, onChange, skillNames = [], newEffect }: Props) {
  const id = useId();
  const newChoices = newEffect === "Temporary resource" ? temporaryChoices : modifierChoices;
  const [selection, setSelection] = useState<ModifierKey | "">(() => {
    if (newEffect !== "Modifier" && newEffect !== "Temporary resource") return "";
    const savedKeys = choices.filter(([key]) => Object.prototype.hasOwnProperty.call(bonuses, key));
    return savedKeys.length === 1 && newChoices.some(([key]) => key === savedKeys[0][0]) ? savedKeys[0][0] : "";
  });
  const [editing, setEditing] = useState<ModifierKey | null>(null);
  const selectedKey = newEffect === "Immunity" ? "immunities" : newEffect && newChoices.some(([key]) => key === selection) ? selection : "";
  const rows = choices.filter(([key]) => key !== selectedKey && (hasModifierValue(bonuses[key]) || editing === key));
  const available = newChoices.filter(([key]) => key === selectedKey || !hasModifierValue(bonuses[key]));
  const amountLabel = selection && textKeys.has(selection) ? "Damage types or effects" : "Amount / formula";
  const checkChoices = [...new Map([...attributeNames, ...skillNames, ...(bonuses.checkSkills ?? [])].map(name => [name.toLowerCase(), name])).values()];
  const known = new Set<string>([...choices.map(([key]) => key), "checkSkills", "resistanceAttributes"]);
  const untouchedKeys = Object.keys(bonuses).filter(key => !known.has(key));
  const remove = (key: ModifierKey) => {
    const next = { ...bonuses };
    delete next[key];
    onChange(next);
    setEditing(null);
  };
  const changeType = (nextKey: ModifierKey | "") => {
    if (nextKey === selectedKey || (nextKey && !available.some(([key]) => key === nextKey))) return;
    const next = { ...bonuses };
    // Move the new row's value, rather than leaving a second bonus behind.
    const previous = selectedKey && nextKey && textKeys.has(selectedKey) === textKeys.has(nextKey) ? bonuses[selectedKey] : "";
    if (selectedKey) delete next[selectedKey];
    if (nextKey) next[nextKey] = String(previous ?? "");
    setSelection(nextKey);
    onChange(next);
  };
  return <fieldset className="min-w-0 space-y-3">
    <legend className="sr-only">{newEffect ?? "Resource, stat & defense changes"}</legend>
    {rows.map(([key, label]) => <div key={key} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(5rem,1fr)_auto] items-end gap-2 rounded-md border border-border/30 bg-background/20 p-2" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setEditing(current => current === key ? null : current); }}>
      <label htmlFor={`${id}-${key}`} className="min-w-0 py-2 text-xs leading-snug">{label}</label>
      <input id={`${id}-${key}`} className={`${field} ${textKeys.has(key) ? "" : "font-mono"}`} value={bonuses[key] ?? ""} onFocus={() => setEditing(key)} onChange={event => onChange({ ...bonuses, [key]: event.target.value })} />
      <Button type="button" variant="ghost" size="sm" className="px-2 text-destructive" onClick={() => remove(key)} aria-label={`Remove effect: ${label}`}>×</Button>
    </div>)}
    {newEffect === "Immunity" && <label className="block min-w-0 text-xs">Immune to<input className={`${field} mt-1`} value={bonuses.immunities ?? ""} onChange={event => onChange({ ...bonuses, immunities: event.target.value })} /></label>}
    {(newEffect === "Modifier" || newEffect === "Temporary resource") && <div className="grid min-w-0 gap-2 sm:grid-cols-2">
      <label className="min-w-0 text-xs">{newEffect === "Modifier" ? "Modifier type" : "Increase maximum resource"}<select className={`${field} mt-1`} value={selectedKey} onChange={event => changeType(event.target.value as ModifierKey | "")}>
        <option value="">{newEffect === "Modifier" ? "Choose modifier" : "Choose resource"}</option>
        {newEffect === "Temporary resource" ? available.map(([key, label]) => <option key={key} value={key}>{label}</option>) : groups.map(group => {
          const modifiers = available.filter(([key]) => groupFor(key) === group);
          return modifiers.length > 0 && <optgroup key={group} label={group}>{modifiers.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</optgroup>;
        })}
      </select></label>
      <label className="min-w-0 text-xs">{amountLabel}<input className={`${field} mt-1 ${selection && textKeys.has(selection) ? "" : "font-mono"} disabled:opacity-50`} value={selectedKey ? bonuses[selectedKey] ?? "" : ""} disabled={!selectedKey} onChange={event => { if (selectedKey) onChange({ ...bonuses, [selectedKey]: event.target.value }); }} /></label>
    </div>}
    {(hasModifierValue(bonuses.bonusSkillCheck) || !!bonuses.checkSkills?.length) && <div className="relative min-w-0">
      <details className="rounded-md border border-border/30 p-3">
        <summary className="cursor-pointer pr-8 text-xs">Skill/check scope · {bonuses.checkSkills?.length ? bonuses.checkSkills.join(", ") : "All skill/check rolls"}</summary>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!bonuses.checkSkills?.length} onChange={() => onChange({ ...bonuses, checkSkills: [] })} />All skill/check rolls</label>
          {checkChoices.map(name => <label key={name.toLowerCase()} className="flex items-center gap-2 text-xs capitalize"><input type="checkbox" checked={bonuses.checkSkills?.some(value => value.toLowerCase() === name.toLowerCase()) ?? false} onChange={event => onChange({ ...bonuses, checkSkills: event.target.checked ? [...(bonuses.checkSkills ?? []), name] : bonuses.checkSkills?.filter(value => value.toLowerCase() !== name.toLowerCase()) })} />{name}</label>)}
        </div>
      </details>
      <div className="absolute right-2 top-2"><SectionHelp label="Skill/check scope">Choose specific skills or attribute checks to limit this modifier. All skill/check rolls applies it to every skill and check roll.</SectionHelp></div>
    </div>}
    {(hasModifierValue(bonuses.bonusResistanceRoll) || !!bonuses.resistanceAttributes?.length) && <div className="relative min-w-0">
      <details className="rounded-md border border-border/30 p-3">
        <summary className="cursor-pointer pr-8 text-xs">Resistance roll scope · {bonuses.resistanceAttributes?.length ? bonuses.resistanceAttributes.join(", ") : "All attributes"}</summary>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!bonuses.resistanceAttributes?.length} onChange={() => onChange({ ...bonuses, resistanceAttributes: [] })} />All attributes</label>{[...new Set([...attributeNames, ...(bonuses.resistanceAttributes ?? [])])].map(name => <label key={name} className="flex items-center gap-2 text-xs capitalize"><input type="checkbox" checked={bonuses.resistanceAttributes?.includes(name) ?? false} onChange={event => onChange({ ...bonuses, resistanceAttributes: event.target.checked ? [...(bonuses.resistanceAttributes ?? []), name] : bonuses.resistanceAttributes?.filter(value => value !== name) })} />{name}</label>)}</div>
      </details>
      <div className="absolute right-2 top-2"><SectionHelp label="Resistance roll scope">Choose which attributes a resistance roll must use to receive this modifier. All attributes applies it to any resistance roll.</SectionHelp></div>
    </div>}
    {!!untouchedKeys.length && <p className="text-xs text-muted-foreground">{untouchedKeys.length} additional imported modifier {untouchedKeys.length === 1 ? "field is" : "fields are"} retained unchanged.</p>}
  </fieldset>;
}
