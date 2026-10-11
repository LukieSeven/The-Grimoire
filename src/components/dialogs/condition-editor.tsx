import type { TriggerCondition } from "../../lib/ability-components";
import { TRIGGER_CHOICES } from "../../lib/ability-components";
import { Button } from "../ui/button";
interface Props {
  conditions: TriggerCondition[]; match: "all" | "any"; mode: "reference" | "manual" | "automatic";
  onCustom?: () => void;
  allowAutomatic?: boolean; ending?: boolean;
  presets?: { id: string; name: string; conditions: TriggerCondition[]; match: "all" | "any" }[];
  onChange: (conditions: TriggerCondition[], match: "all" | "any", mode: "reference" | "manual" | "automatic") => void;
}
const field = "block w-full min-w-0 border border-border/50 bg-background p-2 text-sm mt-1";
export function ConditionEditor({ conditions, match, mode, presets = [], onCustom, onChange }: Props) {
  const update = (id: string, patch: Partial<TriggerCondition>) => onChange(conditions.map(condition => condition.id === id ? { ...condition, ...patch } : condition), match, mode);
  const choose = (id: string | undefined, value: string) => {
    if (value === "Custom" && onCustom) { onCustom(); return; }
    const preset = presets.find(entry => `saved:${entry.id}` === value);
    const added: TriggerCondition[] = preset ? preset.conditions.length ? preset.conditions.map(condition => ({ ...condition, id: crypto.randomUUID() })) : [{ id: id ?? crypto.randomUUID(), kind: "situation", label: preset.name }] : value ? [{ id: id ?? crypto.randomUUID(), kind: value === "Resources" ? "resource" : "situation", label: value === "Custom" || value === "Resources" ? "" : value }] : [];
    const position = id ? conditions.findIndex(condition => condition.id === id) : conditions.length;
    const copy = [...conditions];
    copy.splice(position, id ? 1 : 0, ...added);
    onChange(copy, match, mode);
  };
  const select = (condition?: TriggerCondition) => {
    const saved = presets.find(preset => !preset.conditions.length && preset.name === condition?.label);
    const value = saved ? `saved:${saved.id}` : condition?.kind === "resource" ? "Resources" : condition ? TRIGGER_CHOICES.includes(condition.label) && !["Resources", "Custom"].includes(condition.label) ? condition.label : "Custom" : "";
    return <label className="block text-sm">What is the Trigger?<select className={field} value={value} onChange={event => choose(condition?.id, event.target.value)}><option value="">None</option>{TRIGGER_CHOICES.map(choice => <option key={choice}>{choice}</option>)}{presets.filter(preset => preset.name.trim()).map(preset => <option key={preset.id} value={`saved:${preset.id}`}>{preset.name}</option>)}</select></label>;
  };
  return <div className="space-y-3">
    {!conditions.length && select()}
    {conditions.map(condition => <div key={condition.id} className="space-y-3 border border-border/40 p-3">
      {select(condition)}
      {condition.kind === "situation" && !presets.some(preset => !preset.conditions.length && preset.name === condition.label) && (!TRIGGER_CHOICES.includes(condition.label) || condition.label === "Custom") && <label className="block text-sm">Custom trigger<textarea className={field} rows={2} value={condition.label} onChange={event => update(condition.id, { label: event.target.value })}/></label>}
      {condition.kind === "resource" && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-sm">Resource<select className={field} value={condition.resource ?? ""} onChange={event => update(condition.id, { resource: event.target.value as TriggerCondition["resource"] })}><option value="">Choose resource</option><option value="hp">Health</option><option value="mana">Mana</option><option value="dt">DT</option></select></label>
        <label className="text-sm">Comparison<select className={field} value={condition.operator ?? ""} onChange={event => update(condition.id, { operator: event.target.value as TriggerCondition["operator"] })}><option value="">Choose comparison</option><option value="below_percent">Below percentage</option><option value="above_percent">At or above percentage</option><option value="below_value">At or below value</option><option value="depleted">Depleted</option><option value="full">Full</option></select></label>
        {condition.operator && !["depleted", "full"].includes(condition.operator) && <label className="text-sm">{condition.operator.includes("percent") ? "Percentage" : "Value"}<input type="number" step="any" className={field} value={condition.threshold ?? ""} onChange={event => update(condition.id, { threshold: event.target.value === "" ? undefined : Number(event.target.value) })}/></label>}
      </div>}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange(conditions.filter(entry => entry.id !== condition.id), match, mode)}>Remove trigger</Button>
    </div>)}
    {!!conditions.length && <Button type="button" size="sm" variant="outline" onClick={() => onChange([...conditions, { id: crypto.randomUUID(), kind: "situation", label: "" }], match, mode)}>Add another trigger</Button>}
  </div>;
}
