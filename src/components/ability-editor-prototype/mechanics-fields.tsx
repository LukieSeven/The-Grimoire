import { useId, useState, type ReactNode } from "react";
import { Button } from "../ui/button";
import { SectionHelp } from "./section-help";

export type RuleValue = string | number | boolean | null | RuleValue[] | RuleRecord;
export interface RuleRecord { [key: string]: RuleValue }

/** Check imported reference data without treating class instances or cycles as records. */
export function isRuleRecord(value: unknown): value is RuleRecord {
  const active = new Set<object>();
  const isValue = (entry: unknown): entry is RuleValue => {
    if (entry === null || typeof entry === "string" || typeof entry === "boolean") return true;
    if (typeof entry === "number") return Number.isFinite(entry);
    if (typeof entry !== "object" || active.has(entry)) return false;
    if (!Array.isArray(entry) && Object.getPrototypeOf(entry) !== Object.prototype && Object.getPrototypeOf(entry) !== null) return false;
    active.add(entry);
    const valid = Object.values(entry).every(isValue);
    active.delete(entry);
    return valid;
  };
  return value !== null && typeof value === "object" && !Array.isArray(value) && isValue(value);
}

const conditionPresets: RuleRecord = { any: [], all: [] };
const opposedRollPresets: RuleRecord = { source: "", defending_stat: "", opponent: "", opposing_stat: "" };
const damagePresets: RuleRecord = { formula: "", damage_type: "", target: "", timing: "", condition: "" };
const statusPresets: RuleRecord = { status: "", duration_seconds: null, target: "", movement_multiplier: null };
const modifierPresets: RuleRecord = { modifier: null, affected_roll: "", target: "", application: "", duration_seconds: null, applies_to: [] };
const escapePresets: RuleRecord = { action_cost: null, roll_stat: "", opposing_stat: "", on_success: {}, condition: "" };
const markPoolFields: RuleRecord = { name: "", max_stacks: null, duration_seconds: null, gain_on: "", spend_on: "" };
const modeFields: RuleRecord = { name: "", target: "", effects: {} };
const marginFields: RuleRecord = { failure_by_at_least: null, effects: {} };
const followUpFields: RuleRecord = { event: "", frequency: "", expires_on: "" };
const opposedCheckFields: RuleRecord = {
  caster_stats: [], defender_stats: [], scope: "", compare_rolls: "",
  caster_win: "", caster_loss: "", critical_outcome: "",
  failure_margin: { failure_by_at_least: null, effect: "" },
};
const conditionalModifierFields: RuleRecord = {
  modifier: null, affected_roll: "", target: "", condition: "", expires_on: "",
};
const delayedDamageFields: RuleRecord = { ...damagePresets, duration_seconds: null, delayed_damage_prevention: {} };
const effectsPresets: RuleRecord = {
  default: {}, on_success: {}, on_failure: {}, alternative: {}, branches: [], conditions: {}, target: "", condition: "", timing: "",
  damage_formula: "", damage_type: "", damage: {}, immediate_damage: {}, delayed_damage: {}, apply_status: {},
  status: "", status_applied: null, duration_seconds: null, movement_multiplier: null,
  modifier: null, affected_roll: "", application: "", applies_to: [], action_bonus: {}, escape_penalty: {},
  restrictions: {}, allowed_actions: {}, escape: {}, consume_status: {}, with_ability: "", by_counterattack_weapon: {},
  failure_margin: marginFields, trigger_window: followUpFields,
};

export const abilityMechanicsPresets: RuleRecord = {
  opposed_check: opposedCheckFields, delayed_damage: delayedDamageFields, escape: escapePresets, conditional_modifier: conditionalModifierFields,
  mark_pool: markPoolFields, activation_modes: [modeFields], failure_margin: marginFields, trigger_window: followUpFields,
  id: "", category: "", trigger: "", triggers: {}, frequency: "",
  activation: {}, resistance: {}, requirements: {}, effects: {},
};

const groupPresets: Record<string, RuleRecord> = {
  activation: { action_cost: null, range_feet: null, frequency: "" },
  resistance: { ...opposedRollPresets, on_success: {}, on_failure: {}, failure_margin: marginFields },
  opposed_check: { ...opposedCheckFields, ...opposedRollPresets },
  conditional_modifier: conditionalModifierFields,
  mark_pool: { ...markPoolFields, tracked_on: "", simultaneous_targets: null, expiry_at_cap: "", per_stack_formula: "", effects: {} },
  activation_modes: { ...modeFields, range_feet: null, requirements: {}, resistance: {}, opposed_check: opposedCheckFields, conditional_modifier: conditionalModifierFields, trigger_window: followUpFields },
  failure_margin: { ...marginFields, effect: "" },
  trigger_window: { ...followUpFields, duration_seconds: null, resolution_timing: "", source_ability: "", follow_up: "", conditions: {}, effects: {} },
  conditions: conditionPresets, triggers: conditionPresets, required_result: conditionPresets, weapon: conditionPresets,
  trigger: { event: "", source_ability: "", required_result: {}, weapon: {} },
  requirement: { both_weapons_equipped: null, weapons: [] },
  requirements: { both_weapons_equipped: null, weapons: [], counterattack_weapon: "", target: "", time_limit_seconds: null },
  effects: effectsPresets, default: effectsPresets, on_success: { ...effectsPresets, end_status: "", remove_binding: null }, on_failure: effectsPresets,
  damage: damagePresets, immediate_damage: damagePresets, delayed_damage: delayedDamageFields, bonus_damage: { ...damagePresets, by_counterattack_weapon: {} },
  apply_status: statusPresets, consume_status: { event: "", status: "", expires_immediately: null },
  action_bonus: modifierPresets, escape_penalty: modifierPresets, escape: escapePresets,
  allowed_actions: { attack: null, defend: null, use_essence_abilities: null },
  restrictions: { cannot_willingly_move_away: null },
  delayed_damage_prevention: { condition: "", prevent_delayed_damage: null },
};

const aliases: Record<string, string> = {
  id: "ID", any: "Any of these", all: "All of these", on_success: "On success", on_failure: "On failure",
  duration_seconds: "Duration (seconds)", time_limit_seconds: "Time limit (seconds)", range_feet: "Range (feet)",
  source_ability: "Source ability ID", with_ability: "Linked ability ID", both_weapons_equipped: "Requires both weapons equipped",
  total_dt_bonus: "Total DT bonus (reference)", dt_bonus: "DT bonus", dt: "DT", primary_stat: "Primary stat",
  alternative: "Alternative outcome", branches: "Ordered outcomes", default: "Default outcome",
  mark_pool: "Marks & stacks", max_stacks: "Stack cap", gain_on: "Gain marks on", spend_on: "Spend marks on",
  tracked_on: "Tracked on", expiry_at_cap: "Expiry at stack cap",
  activation_modes: "Activation choices", failure_margin: "Failed resistance margin",
  failure_by_at_least: "Failed by at least", trigger_window: "Trigger & expiry", expires_on: "Expires on",
  opposed_check: "Opposed check", caster_stats: "Caster’s roll options", defender_stats: "Defender’s roll options",
  scope: "Who or what this check covers", compare_rolls: "Compare rolls and ties",
  caster_win: "On caster win", caster_loss: "On caster loss", critical_outcome: "On critical",
  conditional_modifier: "Conditional roll modifier", follow_up: "Follow-up action",
  delayed_damage: "Delayed damage", delayed_damage_prevention: "How to prevent the damage", escape: "Break free",
  roll_stat: "Stat used to break free", resistance: "Resistance (imported rule format)",
};
const groupHelp: Record<string, string> = {
  opposed_check: "Record each side’s permitted stats, how to compare their rolls, and the effects. These notes do not resolve the opposing roll automatically.",
  delayed_damage: "Record how much damage happens later, when it happens, and whether the target can avoid it. Damage is not applied automatically.",
  escape: "Record the action cost and check to break free of the effect. Set what happens if the escape succeeds.",
  conditional_modifier: "Record a bonus or penalty, the roll it changes, when it applies, and when it expires.",
  mark_pool: "Record what adds or spends marks, their stack cap, and when they expire.",
  activation_modes: "List the modes you can choose when activating the ability. Each mode can have its own targets, range, and effects.",
  failure_margin: "Record an additional effect for when the resistance roll fails by at least the specified amount.",
  trigger_window: "Record the event that starts this rule, how often it can trigger, and when it expires.",
};
const acronyms = new Set(["id", "dt", "mp", "hp", "agi", "end", "pow", "spi", "vit", "pre", "wil", "cha"]);
const flagKeys = new Set(["attack", "defend", "use_essence_abilities", "status_applied", "apply_rooted", "remove_binding", "expires_immediately", "both_weapons_equipped", "cannot_willingly_move_away", "prevent_delayed_damage", "available_while_rooted", "applies_even_if_only_hindered"]);
const blockedKeys = new Set(["__proto__", "prototype", "constructor"]);
const owns = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);
const field = "block w-full min-w-0 rounded-md border border-border/50 bg-background px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary";
const statOptions = ["POW", "VIT", "SPI", "AGI", "END", "PRE", "WIL", "CHA"] as const;
const narrativeFields = new Set(["description", "details", "combat_effect", "scope", "compare_rolls", "caster_win", "caster_loss", "critical_outcome", "effect"]);

function ruleLabel(key: string): string {
  if (owns(aliases, key)) return aliases[key];
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().split(/\s+/);
  return words.map((word, index) => acronyms.has(word.toLowerCase()) ? word.toUpperCase() : index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word).join(" ") || "Unnamed field";
}

type Kind = "text" | "number" | "yes-no" | "group" | "list";
function emptyValue(kind: Kind): RuleValue {
  switch (kind) {
    case "group": return {};
    case "list": return [];
    case "number": return null;
    case "yes-no": return false;
    default: return "";
  }
}

function kindOf(value: RuleValue): Kind {
  if (Array.isArray(value)) return "list";
  if (value === null || typeof value === "number") return "number";
  if (typeof value === "boolean") return "yes-no";
  if (typeof value === "object") return "group";
  return "text";
}

function KindSelect({ value, onChange, label }: { value: Kind; onChange: (value: Kind) => void; label: string }) {
  return <select aria-label={label} className={field} value={value} onChange={event => onChange(event.target.value as Kind)}>
    <option value="text">Text</option><option value="number">Number</option><option value="yes-no">Yes / no</option><option value="group">Group</option><option value="list">List</option>
  </select>;
}

function NumericField({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  const id = useId();
  const [editing, setEditing] = useState<string>();
  const validNumber = (text: string) => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim()) && Number.isFinite(Number(text));
  const invalid = editing !== undefined && editing.trim() !== "" && !validNumber(editing);
  return <label className="block min-w-0 text-xs">{label}
    <input className={`${field} mt-1 font-mono`} inputMode="decimal" value={editing ?? (value === null ? "" : String(value))} aria-invalid={invalid || undefined} aria-describedby={invalid ? id : undefined} onFocus={() => setEditing(value === null ? "" : String(value))} onBlur={() => setEditing(undefined)} onChange={event => {
      const text = event.target.value;
      setEditing(text);
      if (!text.trim()) onChange(null);
      else if (validNumber(text)) onChange(Number(text));
    }} />
    {invalid && <span id={id} className="mt-1 block text-destructive">Enter a signed number or leave this blank.</span>}
  </label>;
}

function RuleDisclosure({ name, label, count, showHelp, children }: { name: string; label: string; count: number; showHelp: boolean; children: ReactNode }) {
  const help = showHelp && owns(groupHelp, name) ? groupHelp[name] : undefined;
  const disclosure = <details className="min-w-0 rounded-md border border-border/40 bg-background/25">
    <summary className={`cursor-pointer break-words px-3 py-2 text-sm font-medium text-primary${help ? " pr-10" : ""}`}>{label} <span className="text-xs font-normal text-muted-foreground">· {count}</span></summary>
    {children}
  </details>;
  return help ? <div className="relative min-w-0">
    {disclosure}
    <div className="absolute right-2 top-1.5"><SectionHelp label={label}>{help}</SectionHelp></div>
  </div> : disclosure;
}

function ValueField({ name, label, value, onChange, showHelp = true }: { name: string; label: string; value: RuleValue; onChange: (next: RuleValue) => void; showHelp?: boolean }) {
  const [multiline] = useState(() => typeof value === "string" && (value.includes("\n") || value.length > 96 || narrativeFields.has(name)));
  if (Array.isArray(value) && (name === "caster_stats" || name === "defender_stats") && value.every(entry => statOptions.some(stat => stat === entry)) && new Set(value).size === value.length) {
    return <fieldset className="min-w-0 space-y-1">
      <legend className="text-xs">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {statOptions.map(stat => <label key={stat} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border/50 px-2 py-1 text-xs has-[:checked]:border-primary/70 has-[:checked]:text-primary">
          <input className="accent-primary" type="checkbox" checked={value.includes(stat)} onChange={event => onChange(event.target.checked ? [...value, stat] : value.filter(entry => entry !== stat))} />
          {stat}
        </label>)}
      </div>
    </fieldset>;
  }
  if (Array.isArray(value)) return <ListFields name={name} label={label} value={value} onChange={onChange} showHelp={showHelp} />;
  if (value !== null && typeof value === "object") return <RuleDisclosure name={name} label={label} count={Object.keys(value).length} showHelp={showHelp}>
    <div className="border-t border-border/30 p-2 sm:p-3"><MechanicsFields label={`${label} fields`} value={value} presets={owns(groupPresets, name) ? groupPresets[name] : effectsPresets} onChange={onChange} /></div>
  </RuleDisclosure>;
  if (typeof value === "boolean" || (value === null && flagKeys.has(name))) return <label className="block min-w-0 text-xs">{label}<select className={`${field} mt-1`} value={value === null ? "" : value ? "yes" : "no"} onChange={event => onChange(event.target.value === "" ? null : event.target.value === "yes")}>
    {flagKeys.has(name) && <option value="">Not set</option>}<option value="yes">Yes</option><option value="no">No</option>
  </select></label>;
  if (typeof value === "number" || value === null) return <NumericField label={label} value={value} onChange={onChange} />;
  return <label className="block min-w-0 text-xs">{label}
    {multiline ? <textarea className={`${field} mt-1`} rows={2} value={value} onChange={event => onChange(event.target.value)} /> : <input className={`${field} mt-1 ${name.includes("formula") || name.endsWith("_stat") || name.endsWith("_id") ? "font-mono" : ""}`} value={value} onChange={event => onChange(event.target.value)} />}
  </label>;
}

function ListFields({ name, label, value, onChange, showHelp }: { name: string; label: string; value: RuleValue[]; onChange: (value: RuleValue[]) => void; showHelp: boolean }) {
  const activationModes = name === "activation_modes";
  const [kind, setKind] = useState<Kind>(value.length ? kindOf(value[0]) : name === "branches" ? "group" : "text");
  const move = (from: number, to: number) => {
    const next = [...value];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };
  return <RuleDisclosure name={name} label={label} count={value.length} showHelp={showHelp}>
    <div className="space-y-2 border-t border-border/30 p-2 sm:p-3">
      {value.map((entry, index) => <div key={index} className="flex flex-wrap items-end gap-1.5">
        <div className="min-w-[9rem] max-w-full grow basis-40"><ValueField name={name} label={activationModes ? (isRuleRecord(entry) && typeof entry.name === "string" && entry.name.trim() ? entry.name : `Mode ${index + 1}`) : `${label} ${index + 1}`} value={entry} onChange={next => onChange(value.map((entryValue, position) => position === index ? next : entryValue))} showHelp={false} /></div>
        <div className="flex flex-wrap gap-1">
          {value.length > 1 && <><Button type="button" variant="ghost" size="sm" disabled={index === 0} aria-label={`Move ${label} ${index + 1} up`} onClick={() => move(index, index - 1)}>↑</Button><Button type="button" variant="ghost" size="sm" disabled={index === value.length - 1} aria-label={`Move ${label} ${index + 1} down`} onClick={() => move(index, index + 1)}>↓</Button></>}
          <Button type="button" variant="ghost" size="sm" className="text-destructive" aria-label={`Remove ${label} ${index + 1}`} onClick={() => onChange(value.filter((_, position) => position !== index))}>Remove</Button>
        </div>
      </div>)}
      <div className="flex flex-wrap items-center gap-2">
        {!activationModes && <div className="max-w-full"><KindSelect label={`New entry type for ${label}`} value={kind} onChange={setKind} /></div>}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, activationModes ? structuredClone(modeFields) : emptyValue(kind)])}>{activationModes ? "Add mode" : "Add entry"}</Button>
      </div>
    </div>
  </RuleDisclosure>;
}

export function MechanicsFields({ value, onChange, presets = abilityMechanicsPresets, label = "Rule fields", reservedKeys = [] }: { value: RuleRecord; onChange: (value: RuleRecord) => void; presets?: RuleRecord; label?: string; reservedKeys?: readonly string[] }) {
  const [adding, setAdding] = useState(false);
  const [choice, setChoice] = useState("");
  const [custom, setCustom] = useState("");
  const [kind, setKind] = useState<Kind>("text");
  const suggested = Object.keys(presets).filter(key => !owns(value, key) && !blockedKeys.has(key) && !reservedKeys.includes(key));
  const customChoice = choice === "custom";
  const key = customChoice ? custom.trim() : choice.slice(7);
  const canAdd = !!key && !blockedKeys.has(key) && !owns(value, key) && !reservedKeys.includes(key) && (customChoice || owns(presets, key));
  const resetAdd = () => { setAdding(false); setChoice(""); setCustom(""); setKind("text"); };

  return <fieldset aria-label={label} className="min-w-0 space-y-2">
    {Object.entries(value).map(([name, entry]) => {
      const entryLabel = ruleLabel(name);
      return <div key={name} className="flex flex-wrap items-start gap-1.5">
        <div className="min-w-[9rem] max-w-full grow basis-40"><ValueField name={name} label={entryLabel} value={entry} onChange={next => onChange({ ...value, [name]: next })} /></div>
        <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${entryLabel}`} className="text-destructive" onClick={() => { const next = { ...value }; delete next[name]; onChange(next); }}>Remove</Button>
      </div>;
    })}
    {adding ? <div className="space-y-2 rounded-md border border-primary/30 p-2 sm:p-3">
      <label className="block text-xs">Field to add<select className={`${field} mt-1`} value={choice} onChange={event => setChoice(event.target.value)}>
        <option value="">Choose a field</option>{suggested.map(name => <option key={name} value={`preset:${name}`}>{ruleLabel(name)}</option>)}<option value="custom">Custom field…</option>
      </select></label>
      {customChoice && <div className="grid min-w-0 gap-2 sm:grid-cols-2"><label className="block min-w-0 text-xs">Custom field name<input className={`${field} mt-1`} value={custom} onChange={event => setCustom(event.target.value)} /></label><div className="min-w-0 self-end"><KindSelect label="Custom field type" value={kind} onChange={setKind} /></div></div>}
      {customChoice && key && !canAdd && <p className="text-xs text-destructive">Choose an unused field name.</p>}
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={!canAdd} onClick={() => { if (!canAdd) return; onChange({ ...value, [key]: customChoice ? emptyValue(kind) : structuredClone(presets[key]) }); resetAdd(); }}>Add field</Button><Button type="button" size="sm" variant="ghost" onClick={resetAdd}>Cancel</Button></div>
    </div> : <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>+ Add field</Button>}
  </fieldset>;
}
