import { AbilityInputFields } from "./ability-input-fields";
import { useRef, useState } from "react";
import type { AbilityInput, CustomChoiceCategory, AbilityOptions, EffectTemplate } from "../../lib/ability-input";
import { blankAbilityInput, validateAbilityInput, EFFECT_TYPES } from "../../lib/ability-input";
import { ConditionEditor } from "./condition-editor";
import { Button } from "../ui/button";
const field = "block w-full border border-border/50 bg-background p-2 text-sm mt-1";
const categories: [CustomChoiceCategory, string][] = [["durationTypes", "Duration type"], ["rangeTypes", "Range type"], ["targets", "Target"], ["rangedTargeting", "Ranged targeting"], ["areaShapes", "Area shape"], ["triggers", "Triggers"], ["effects", "Effects"], ["effectTypes", "Effect type"]];

export function AbilityOptionsFields({ options, onChange, initialCategory, skillNames, onSave }: { options: AbilityOptions; onChange: (options: AbilityOptions) => void; initialCategory?: CustomChoiceCategory; skillNames?: string[]; onSave?: (options: AbilityOptions) => void }) {
  const [category, setCategory] = useState<CustomChoiceCategory>(initialCategory ?? "durationTypes");
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [draft, setDraft] = useState<AbilityInput>(blankAbilityInput);
  const [kind, setKind] = useState<EffectTemplate["kind"]>("Buff");
  const [triggerDraft, setTriggerDraft] = useState<{ conditions: import("../../lib/ability-components").TriggerCondition[]; match: "all" | "any" }>();
  const [error, setError] = useState<string>();
  const drafts = useRef<Partial<Record<CustomChoiceCategory, { name: string; editingId?: string; draft: AbilityInput; kind: EffectTemplate["kind"]; triggerDraft?: typeof triggerDraft }>>>({});
  const reset = () => { delete drafts.current[category]; setName(""); setEditingId(undefined); setDraft(blankAbilityInput()); setKind("Buff"); setTriggerDraft(undefined); setError(undefined); };
  const chooseCategory = (nextCategory: CustomChoiceCategory) => {
    drafts.current[category] = { name, editingId, draft, kind, triggerDraft };
    const saved = drafts.current[nextCategory];
    setTriggerDraft(saved?.triggerDraft); setCategory(nextCategory); setName(saved?.name ?? ""); setEditingId(saved?.editingId); setDraft(saved?.draft ?? blankAbilityInput()); setKind(saved?.kind ?? "Buff"); setError(undefined);
  };
  const save = () => {
    let next = options;
    const commit = (value: AbilityOptions) => { next = value; onChange(value); };
    const label = name.trim();
    if (!label || label.toLowerCase() === "custom") return;
    if (category === "effects") {
      const validation = validateAbilityInput({ ...draft, name: label });
      if (validation) { setError(validation); return; }
      const old = options.effects.find(effect => effect.id === editingId);
      const effect: EffectTemplate = { ...old, id: editingId ?? crypto.randomUUID(), name: label, kind, rules: draft.description, definition: { ...draft, name: label } };
      commit({ ...options, effects: editingId ? options.effects.map(entry => entry.id === editingId ? effect : entry) : [...options.effects, effect] });
    } else if (category === "triggers") {
      const old = options.triggers.find(trigger => trigger.id === editingId);
      const trigger = { ...old, id: editingId ?? crypto.randomUUID(), name: label, conditions: triggerDraft?.conditions ?? old?.conditions ?? [], match: triggerDraft?.match ?? old?.match ?? "all" as const };
      commit({ ...options, triggers: editingId ? options.triggers.map(entry => entry.id === editingId ? trigger : entry) : [...options.triggers, trigger] });
    } else commit({ ...options, [category]: [...new Set([...(options[category] ?? []), label])] });
    onSave?.(next);
    reset();
  };
  const trigger = category === "triggers" ? options.triggers.find(entry => entry.id === editingId) : undefined;
  return <div className="space-y-4">
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm">Custom Choice Type<select className={field} value={category} onChange={event => chooseCategory(event.target.value as CustomChoiceCategory)}>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="text-sm">Choice name<input autoFocus={!!initialCategory} className={field} value={name} onChange={event => { setName(event.target.value); setDraft(previous => ({ ...previous, name: event.target.value })); }}/></label>
    </div>
    {category === "effects" && <div className="border border-border/40 p-3 space-y-4">
      <label className="text-sm">Effect type<select className={field} value={kind} onChange={event => event.target.value === "__custom__" ? chooseCategory("effectTypes") : setKind(event.target.value)}>{[...new Set([...EFFECT_TYPES, ...(options.effectTypes ?? []), kind])].map(value => <option key={value}>{value}</option>)}<option value="__custom__">Custom…</option></select></label>
      <AbilityInputFields skillNames={skillNames} hideName effectMode input={draft} options={{ ...options, effects: options.effects.filter(effect => effect.id !== editingId) }} sources={[]} familiars={[]} onChange={setDraft} onCustom={chooseCategory}/>
    </div>}
    {trigger && !!trigger.conditions.length && <ConditionEditor conditions={triggerDraft?.conditions ?? trigger.conditions} match={triggerDraft?.match ?? trigger.match} mode="manual" onChange={(conditions, match) => setTriggerDraft({ conditions, match })}/>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button size="sm" disabled={!name.trim() || name.trim().toLowerCase() === "custom"} onClick={save}>{category === "effects" ? "Save Effect" : "Save Choice"}</Button>{editingId && <Button size="sm" variant="outline" onClick={() => reset()}>Cancel edit</Button>}</div>
    <div className="flex flex-wrap gap-2">
      {category === "effects" ? options.effects.map(effect => <span key={effect.id} className="border border-border/40 p-2 text-xs"><button type="button" onClick={() => { setEditingId(effect.id); setName(effect.name); setKind(effect.kind); setDraft(effect.definition ? structuredClone(effect.definition) : { ...blankAbilityInput(), id: effect.id, name: effect.name, description: effect.rules }); }}>{effect.name || "Unnamed effect"}</button><button type="button" aria-label={"Remove " + effect.name} className="ml-2 text-destructive" onClick={() => { const next = { ...options, effects: options.effects.filter(entry => entry.id !== effect.id) }; onChange(next); onSave?.(next); if (editingId === effect.id) reset(); }}>×</button></span>)
        : category === "triggers" ? options.triggers.map(entry => <span key={entry.id} className="border border-border/40 p-2 text-xs"><button type="button" onClick={() => { setEditingId(entry.id); setName(entry.name); setTriggerDraft({ conditions: structuredClone(entry.conditions), match: entry.match }); }}>{entry.name || "Unnamed trigger"}</button><button type="button" aria-label={"Remove " + entry.name} className="ml-2 text-destructive" onClick={() => { onChange({ ...options, triggers: options.triggers.filter(trigger => trigger.id !== entry.id) }); if (editingId === entry.id) reset(); }}>×</button></span>)
        : (options[category] ?? []).map(value => <span key={value} className="border border-border/40 p-2 text-xs">{value}<button type="button" aria-label={"Remove " + value} className="ml-2 text-destructive" onClick={() => onChange({ ...options, [category]: options[category]?.filter(entry => entry !== value) })}>×</button></span>)}
    </div>
  </div>;
}
