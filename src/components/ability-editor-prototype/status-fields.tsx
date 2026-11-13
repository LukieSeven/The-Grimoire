import { useId, useState } from "react";
import { COMMON_EFFECTS, type AbilityOptions, type EffectTemplate, type TargetResult } from "../../lib/ability-input";
import { attachedEffects, effectDetails } from "../../lib/effect-details";
import { Button } from "../ui/button";
import { SectionHelp } from "./section-help";

type StatusEffects = NonNullable<TargetResult["effects"]>;
type StatusTiming = StatusEffects[number]["outcome"];

interface Props {
  result: TargetResult;
  options: AbilityOptions;
  newEffect?: boolean;
  onChange: (patch: Partial<TargetResult>, options?: AbilityOptions) => void;
}

const control = "mt-1 block min-h-8 w-full min-w-0 rounded-md border border-border/50 bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary";
const resistanceStats = ["Power", "Vitality", "Spirit", "Agility", "Endurance", "Precision", "Willpower", "Charisma"];
const timingLabels: Record<StatusTiming, string> = {
  always: "Always",
  success: "On a successful roll",
  "failed-save": "On failed resistance",
};

/** Preview-only input. Store the same effect and save fields as the original editor. */
export function PrototypeStatusFields({ result, options, newEffect = false, onChange }: Props) {
  const id = useId();
  const [when, setWhen] = useState<StatusTiming>("always");
  const [custom, setCustom] = useState<{ row: number; name: string; rules: string; templateId?: string }>();
  const legacy = result.effects == null && !!result.templateId;
  const effects = legacy && result.effectOutcome
    ? [{ templateId: result.templateId!, outcome: result.effectOutcome }]
    : attachedEffects(result);
  const statusOptions = new Map(COMMON_EFFECTS.map(name => [`common:${name}`, name]));
  for (const effect of options.effects) if (effect.name.trim() && !statusOptions.has(effect.id)) statusOptions.set(effect.id, effect.name);
  for (const effect of effects) if (!statusOptions.has(effect.templateId)) statusOptions.set(effect.templateId, effectDetails(effect.templateId, options).name);
  const stats = [...new Set([...resistanceStats, ...(result.enemySavingThrow ? [result.enemySavingThrow] : [])])];
  const saveEffects = (next: StatusEffects, nextOptions?: AbilityOptions) => {
    if (legacy) {
      // Keep single-template records on their existing result ID.
      const effect = next[0];
      onChange({ templateId: effect?.templateId, effectOutcome: effect?.outcome === "always" && !result.effectOutcome ? undefined : effect?.outcome }, nextOptions);
    } else {
      onChange({ effects: next, templateId: next.find(effect => effect.outcome === "always")?.templateId }, nextOptions);
    }
  };
  const showResistance = (effects.length ? effects.some(effect => effect.outcome === "failed-save") : when === "failed-save") || !!result.enemySavingThrow || !!result.saveFormula?.trim();
  const resistance = <div className="grid gap-2 sm:grid-cols-2">
    <div className="min-w-0 text-xs">
      <div className="flex items-center gap-1"><label htmlFor={`${id}-resistance`}>Resistance stat</label><SectionHelp label="Resistance stat">The target rolls this attribute to resist the status. Resolve the roll at the table.</SectionHelp></div>
      <select id={`${id}-resistance`} className={control} value={result.enemySavingThrow ?? ""} onChange={event => onChange({ enemySavingThrow: event.target.value || undefined })}>
        <option value="">None</option>
        {stats.map(stat => <option key={stat} value={stat}>{stat}</option>)}
      </select>
    </div>
    <div className="min-w-0 text-xs">
      <div className="flex items-center gap-1"><label htmlFor={`${id}-opposed`}>Resistance difficulty</label><SectionHelp label="Resistance difficulty">Record the number, formula, or rule to compare against the target’s resistance roll. Resolve it at the table; use Advanced rules for a full opposed check with multiple outcomes.</SectionHelp></div>
      <input id={`${id}-opposed`} className={`${control} font-mono`} value={result.saveFormula ?? ""} onChange={event => onChange({ saveFormula: event.target.value })} />
    </div>
  </div>;

  const statusRow = (effect: StatusEffects[number] | undefined, index: number) => {
    const timing = effect?.outcome ?? when;
    const canRemove = !!effect && (!newEffect || effects.length > 1);
    const customStatus = options.effects.find(option => option.id === effect?.templateId && !option.id.startsWith("common:"));
    const labelSuffix = effects.length > 1 ? ` ${index + 1}` : "";
    const duplicate = (templateId: string, outcome: StatusTiming) => effects.some((entry, position) => position !== index && entry.templateId === templateId && entry.outcome === outcome);
    const edit = (next: StatusEffects[number]) => saveEffects(effect ? effects.map((entry, position) => position === index ? next : entry) : [next]);
    const remove = () => {
      setWhen(timing);
      saveEffects(effects.filter((_, position) => position !== index));
    };
    return <div key={index} className={`grid items-end gap-2 ${canRemove || customStatus ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" : "sm:grid-cols-2"}`}>
      <div className="min-w-0 text-xs">
        <div className="flex items-center gap-1"><label htmlFor={`${id}-status-${index}`}>Apply status{labelSuffix}</label><SectionHelp label={`Apply status${labelSuffix}`}>Choose a condition the target gains, such as Stunned or Burning. Use When to decide whether a roll is needed.</SectionHelp></div>
        <select id={`${id}-status-${index}`} className={control} value={effect?.templateId ?? ""} onChange={event => {
          const templateId = event.target.value;
          if (templateId === "__custom__") { setCustom({ row: index, name: "", rules: "" }); return; }
          if (!templateId) { if (effect) remove(); return; }
          edit({ templateId, outcome: timing });
        }}>
          <option value="" disabled={canRemove}>Choose status</option>
          {[...statusOptions].map(([id, name]) => <option key={id} value={id} disabled={id !== effect?.templateId && duplicate(id, timing)}>{name}</option>)}
          <option value="__custom__">Create status…</option>
        </select>
      </div>
      <div className="min-w-0 text-xs">
        <div className="flex items-center gap-1"><label htmlFor={`${id}-when-${index}`}>When{labelSuffix}</label><SectionHelp label={`When a status applies${labelSuffix}`}>Always applies without checking a roll. Otherwise, the status applies only if the ability roll succeeds or the target fails its resistance roll, depending on your choice.</SectionHelp></div>
        <select id={`${id}-when-${index}`} className={control} value={timing} onChange={event => {
          const outcome = event.target.value as StatusTiming;
          if (effect) edit({ ...effect, outcome });
          else setWhen(outcome);
        }}>
          {Object.entries(timingLabels).map(([value, label]) => <option key={value} value={value} disabled={!!effect && value !== timing && duplicate(effect.templateId, value as StatusTiming)}>{label}</option>)}
        </select>
      </div>
      {(canRemove || customStatus) && <div className="flex flex-wrap items-center gap-1">
        {customStatus && <Button type="button" size="sm" variant="ghost" aria-label={`Edit custom status${labelSuffix}`} onClick={() => setCustom({ row: index, name: customStatus.name, rules: customStatus.rules, templateId: customStatus.id })}>Edit status</Button>}
        {canRemove && <Button type="button" size="sm" variant="ghost" className="text-destructive" aria-label={`Remove status${labelSuffix}`} onClick={remove}>Remove status</Button>}
      </div>}
    </div>;
  };

  const normalizedName = custom?.name.trim().toLowerCase();
  const currentName = custom?.templateId ? statusOptions.get(custom.templateId)?.trim().toLowerCase() : undefined;
  const canSaveCustom = !!normalizedName && (normalizedName === currentName || ![...statusOptions.values()].some(name => name.trim().toLowerCase() === normalizedName));
  const saveCustomStatus = () => {
    if (!custom || !canSaveCustom) return;
    if (custom.templateId) {
      const firstMatch = options.effects.findIndex(effect => effect.id === custom.templateId);
      onChange({}, { ...options, effects: options.effects.map((effect, index) => index === firstMatch ? { ...effect, name: custom.name.trim(), rules: custom.rules.trim() } : effect) });
      setCustom(undefined);
      return;
    }
    const status: EffectTemplate = { id: crypto.randomUUID(), name: custom.name.trim(), rules: custom.rules.trim(), kind: "Status" };
    // One update keeps both the new template and the entry that uses it in the same draft.
    const current = effects[custom.row];
    saveEffects(current ? effects.map((entry, index) => index === custom.row ? { ...entry, templateId: status.id } : entry) : [...effects, { templateId: status.id, outcome: when }], { ...options, effects: [...options.effects, status] });
    setCustom(undefined);
  };

  return <div className="min-w-0 space-y-3">
    {effects.length ? effects.map(statusRow) : newEffect && statusRow(undefined, 0)}
    {custom && <section aria-label={custom.templateId ? "Edit status" : "Create status"} className="min-w-0 space-y-2 rounded-md border border-primary/50 p-3">
      <h4 className="text-sm font-semibold text-primary">{custom.templateId ? "Edit status" : "Create status"}<SectionHelp label={custom.templateId ? "Edit status" : "Create status"}>Name the condition and record what it does. Duration and when it applies stay with the effect that uses it. Changes apply only to this draft.</SectionHelp></h4>
      <label className="block text-xs">Status name<input autoFocus className={control} value={custom.name} onChange={event => setCustom({ ...custom, name: event.target.value })} /></label>
      <label className="block text-xs">Status rules<textarea className={control} rows={3} value={custom.rules} onChange={event => setCustom({ ...custom, rules: event.target.value })} /></label>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setCustom(undefined)}>Cancel</Button>
        <Button type="button" size="sm" disabled={!canSaveCustom} onClick={saveCustomStatus}>{custom.templateId ? "Update status" : "Use this status"}</Button>
      </div>
    </section>}
    {showResistance && resistance}
  </div>;
}
