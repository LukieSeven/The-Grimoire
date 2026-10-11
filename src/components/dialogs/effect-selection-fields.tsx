import { useState } from "react";
import { COMMON_EFFECTS } from "../../lib/ability-input";
import type { AbilityOptions, TargetResult } from "../../lib/ability-input";
import { attachedEffects, effectDetails, outcomeLabel, saveReference } from "../../lib/effect-details";
import { EffectChip } from "../effect-chip";
import { Button } from "../ui/button";
export function EffectSelectionFields({ result, options, onChange, onCustom }: { result: TargetResult; options: AbilityOptions; onChange: (patch: Partial<TargetResult>) => void; onCustom: () => void }) {
  const [always, setAlways] = useState(""); const [conditional, setConditional] = useState("");
  const [condition, setCondition] = useState<"success" | "failed-save">("failed-save");
  const effects = attachedEffects(result);
  const save = (next: NonNullable<TargetResult["effects"]>) => onChange({ effects: next, templateId: next.find(effect => effect.outcome === "always")?.templateId });
  const row = (label: string, value: string, setValue: (value: string) => void, outcome: "always" | "success" | "failed-save") => <div className="flex items-end gap-2">
    <label className="block text-xs w-1/2 min-w-0">{label}<select className="block w-full min-w-0 border border-border/50 bg-background px-2 h-8 mt-1" value={value} onChange={event => event.target.value === "__custom__" ? onCustom() : setValue(event.target.value)}><option value="">Choose effect</option>{COMMON_EFFECTS.map(name => <option key={name} value={`common:${name}`}>{name}</option>)}{options.effects.filter(effect => effect.name.trim()).map(effect => <option key={effect.id} value={effect.id}>{effect.name}</option>)}<option value="__custom__">Custom…</option></select></label>
    <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={!value || effects.some(effect => effect.templateId === value && effect.outcome === outcome)} onClick={() => { save([...effects, { templateId: value, outcome }]); setValue(""); }}>Add Effect</Button>
  </div>;
  return <div className="space-y-2">
    {row("Apply Effect", always, setAlways, "always")}
    {row("Apply Effect on Success", conditional, setConditional, condition)}
    <label className="block text-xs text-muted-foreground">Success condition<select className="ml-2 bg-background border border-border/40 px-1 py-0.5" value={condition} onChange={event => setCondition(event.target.value as typeof condition)}><option value="failed-save">Target fails its save</option><option value="success">Ability roll succeeds</option></select></label>
    <div className="grid grid-cols-2 gap-2"><label className="text-xs">Enemy Saving Throw<select className="block w-full min-w-0 h-8 mt-1 px-2 bg-background border border-border/50" value={result.enemySavingThrow ?? ""} onChange={event => onChange({ enemySavingThrow: event.target.value || undefined })}><option value="">None</option>{["Power", "Vitality", "Spirit", "Agility", "Endurance", "Precision", "Willpower", "Charisma"].map(stat => <option key={stat}>{stat}</option>)}</select></label><label className="text-xs">Save Formula<input className="block w-full min-w-0 h-8 mt-1 px-2 bg-background border border-border/50" value={result.saveFormula ?? ""} onChange={event => onChange({ saveFormula: event.target.value })}/></label></div>
    <div className="flex flex-wrap gap-1.5">{effects.map(effect => { const details = effectDetails(effect.templateId, options); return <EffectChip key={`${effect.templateId}:${effect.outcome}`} name={details.name + (effect.outcome === "always" ? "" : effect.outcome === "success" ? " · success" : " · failed save")} description={[outcomeLabel(effect.outcome), effect.outcome !== "always" ? saveReference(result) : "", details.description].filter(Boolean).join("\n")} onRemove={() => save(effects.filter(entry => entry !== effect))}/>; })}</div>
  </div>;
}
