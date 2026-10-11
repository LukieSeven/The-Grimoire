import { COMPONENT_KINDS, COMPONENT_BEHAVIORS, SITUATIONS } from "../../lib/ability-components";
import type { AbilityComponent, EffectTarget, ComponentEvolution } from "../../lib/ability-components";
import { EVOLUTION_THRESHOLDS_TABLE } from "../../lib/storage";
import { ConditionEditor } from "./condition-editor";
import { Button } from "../ui/button";

const field = "block w-full min-w-0 border border-border/50 bg-background p-2 text-sm mt-1";
interface Props { component: AbilityComponent; onChange: (component: AbilityComponent) => void }

export function ComponentFields({ component, onChange }: Props) {
  const modifiers = EVOLUTION_THRESHOLDS_TABLE.map(step => ({ ...step, id: step.rankLabel, name: "" }));
  const update = (patch: Partial<AbilityComponent>) => onChange({ ...component, ...patch });
  const evolutionChange = (id: string, patch: Partial<ComponentEvolution>) => update({ evolutions: component.evolutions?.map(entry => entry.id === id ? { ...entry, ...patch } : entry) });
  return <div className="space-y-4">
    <label className="block text-sm">Component name<input className={field} value={component.name} onChange={event => update({ name: event.target.value })}/></label>
    <fieldset className="space-y-2"><legend className="text-sm font-semibold">What it does · select any combination</legend><div className="flex flex-wrap gap-2">{COMPONENT_KINDS.map(kind => <button type="button" key={kind} aria-pressed={component.kinds.includes(kind)} className={`border px-3 py-2 text-sm capitalize ${component.kinds.includes(kind) ? "border-primary bg-primary/15 text-primary" : "border-border"}`} onClick={() => update({ kinds: component.kinds.includes(kind) ? component.kinds.filter(value => value !== kind) : [...component.kinds, kind] })}>{kind}</button>)}</div></fieldset>
    <fieldset className="space-y-2"><legend className="text-sm font-semibold">How it works · select any combination</legend><div className="flex flex-wrap gap-2">{COMPONENT_BEHAVIORS.map(behavior => <button type="button" key={behavior} aria-pressed={component.behaviors.includes(behavior)} className={`border px-3 py-2 text-sm capitalize ${component.behaviors.includes(behavior) ? "border-primary bg-primary/15 text-primary" : "border-border"}`} onClick={() => update({ behaviors: component.behaviors.includes(behavior) ? component.behaviors.filter(value => value !== behavior) : [...component.behaviors, behavior] })}>{behavior.replaceAll("-", " ")}</button>)}</div></fieldset>
    {component.kinds.includes("aura") && <div className="grid grid-cols-1 gap-3"><label className="text-sm">Aura radius (ft)<input type="number" min="0" step="any" className={field} value={component.radius ?? ""} onChange={event => update({ radiusUnit: "ft", radius: event.target.value === "" ? undefined : Number(event.target.value) })}/></label></div>}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm">Duration<input className={field} value={component.duration ?? ""} onChange={event => update({ duration: event.target.value })}/></label><label className="text-sm">Range / reach<input className={field} value={component.range ?? ""} onChange={event => update({ range: event.target.value })}/></label></div>
    <div className="border border-border/40 p-3 space-y-3">
      <label className="block text-sm">Roll formula<input className={field} value={component.rollFormula ?? ""} onChange={event => update({ rollFormula: event.target.value })}/></label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm">Cost / expenditure<input className={field} value={component.cost ?? ""} onChange={event => update({ cost: event.target.value })}/></label><label className="text-sm">Uses / recharge rules<input className={field} value={component.uses ?? ""} onChange={event => update({ uses: event.target.value })}/></label></div>
      <label className="block text-sm">Situation categories (comma separated)<input key={`${component.id}:${component.situations?.join(",")}`} className={field} defaultValue={component.situations?.join(", ") ?? ""} onBlur={event => update({ situations: event.target.value.split(",").map(value => value.trim()).filter(Boolean) })}/></label>
      <div className="flex flex-wrap gap-1">{SITUATIONS.map(value => <button type="button" key={value} className={`text-xs border p-1 ${component.situations?.includes(value) ? "border-primary text-primary" : "border-border text-muted-foreground"}`} onClick={() => update({ situations: component.situations?.includes(value) ? component.situations.filter(entry => entry !== value) : [...(component.situations ?? []), value] })}>{value}</button>)}</div>
    </div>
    <div className="border border-border/40 p-3"><ConditionEditor conditions={component.conditions ?? []} match={component.conditionMatch ?? "all"} mode={component.triggerMode ?? "manual"} onChange={(conditions, conditionMatch, triggerMode) => update({ conditions, conditionMatch, triggerMode })}/></div>
    <fieldset className="border border-border/40 p-3 space-y-3">
      <legend className="text-sm font-semibold text-primary">Effects</legend>
      <p className="text-xs text-muted-foreground">Add each benefit or penalty here. Effects share this component’s activation and aura range; each has its own targets and rules.</p>
      {(component.createdEffects ?? []).map(effect => {
        const change = (patch: Partial<typeof effect>) => update({ createdEffects: component.createdEffects!.map(entry => entry.id === effect.id ? { ...entry, ...patch } : entry) });
        return <div key={effect.id} className="border border-border/40 p-3 space-y-3">
          
          <label className="block text-sm">Effect name<input className={field} value={effect.name} onChange={event => change({ name: event.target.value })}/></label>
          <label className="block text-sm">How this effect is tracked<select className={field} value={effect.delivery ?? "applied"} onChange={event => change({ delivery: event.target.value as "ongoing" | "applied" })}><option value="ongoing">While this component is active</option><option value="applied">Created and applied separately to a target</option></select></label>
          {effect.delivery !== "ongoing" && <p className="text-xs text-muted-foreground">Apply this effect in Combat. It remains tracked independently after the source component ends.</p>}
          <label className="block text-sm">Effect-specific rules<textarea rows={3} className={field} value={effect.rules} onChange={event => change({ rules: event.target.value })}/></label>
          <fieldset><legend className="text-sm">Who can receive this effect</legend><div className="flex flex-wrap gap-3 mt-2">{(["self", "allies", "enemies", "custom"] as EffectTarget[]).map(target => <label key={target} className="flex gap-2 items-center text-sm capitalize"><input type="checkbox" checked={effect.targets.includes(target)} onChange={event => change({ targets: event.target.checked ? [...effect.targets, target] : effect.targets.filter(value => value !== target) })}/>{target}</label>)}</div></fieldset>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-sm">Duration<input className={field} value={effect.duration ?? ""} onChange={event => change({ duration: event.target.value })}/></label><label className="text-sm">Effect roll formula<input className={field} value={effect.rollFormula ?? ""} onChange={event => change({ rollFormula: event.target.value })}/></label></div>
          <div className="space-y-3"><ConditionEditor allowAutomatic={false} conditions={effect.conditions ?? []} match={effect.conditionMatch ?? "all"} mode={effect.triggerMode ?? "manual"} onChange={(conditions, conditionMatch, mode) => change({ conditions, conditionMatch, triggerMode: mode === "reference" ? "reference" : "manual" })}/></div>
          <Button type="button" size="sm" variant="ghost" onClick={() => update({ createdEffects: component.createdEffects?.filter(entry => entry.id !== effect.id) })}>Remove effect</Button>
        </div>;
      })}
      <Button type="button" size="sm" variant="outline" onClick={() => update({ createdEffects: [...(component.createdEffects ?? []), { id: crypto.randomUUID(), name: "", rules: "", targets: [], delivery: "ongoing" }] })}>Add effect</Button>
    </fieldset>
    <div className="border border-border/40 p-3 space-y-3">
      <label className="block text-sm">Shared rules<textarea rows={3} className={field} value={component.rules} onChange={event => update({ rules: event.target.value })}/></label>
      <fieldset><legend className="text-sm">Targets for these shared rules</legend><div className="flex flex-wrap gap-3">{(["self", "allies", "enemies", "custom"] as EffectTarget[]).map(target => <label key={target} className="text-sm capitalize flex items-center gap-2"><input type="checkbox" checked={component.targets.includes(target)} onChange={event => update({ targets: event.target.checked ? [...component.targets, target] : component.targets.filter(value => value !== target) })}/>{target}</label>)}</div></fieldset>
      <label className="block text-sm">Target-specific rules<textarea className={field} value={component.targetRules ?? ""} onChange={event => update({ targetRules: event.target.value })}/></label>
    </div>
    <div className="border border-border/40 p-3 space-y-3">
      <label className="block text-sm">Component becomes available<select className={field} value={component.unlockedByModifierId ?? ""} onChange={event => update({ unlockedByModifierId: event.target.value || undefined })}><option value="">Available with the base ability</option>{modifiers.map(modifier => <option key={modifier.id} value={modifier.id}>{modifier.rankLabel}</option>)}</select></label>
      {(component.evolutions ?? []).map(evolution => <div key={evolution.id} className="border border-border p-3 space-y-3">
        <label className="block text-sm">When this evolution unlocks<select className={field} value={evolution.modifierId} onChange={event => evolutionChange(evolution.id, { modifierId: event.target.value })}><option value="">Choose progression step</option>{modifiers.map(modifier => <option key={modifier.id} value={modifier.id}>{modifier.rankLabel}</option>)}</select></label>
        <label className="block text-sm">Updated rules<textarea className={field} value={evolution.rules ?? ""} onChange={event => evolutionChange(evolution.id, { rules: event.target.value || undefined })}/></label>
        {component.kinds.includes("aura") && <label className="block text-sm">Updated radius<input type="number" min="0" step="any" className={field} value={evolution.radius ?? ""} onChange={event => evolutionChange(evolution.id, { radius: event.target.value === "" ? undefined : Number(event.target.value) })}/></label>}
        <label className="block text-sm">Updated formula<input className={field} value={evolution.rollFormula ?? ""} onChange={event => evolutionChange(evolution.id, { rollFormula: event.target.value || undefined })}/></label>
        <label className="block text-sm">Updated duration<input className={field} value={evolution.duration ?? ""} onChange={event => evolutionChange(evolution.id, { duration: event.target.value || undefined })}/></label>
        <Button type="button" size="sm" variant="ghost" onClick={() => update({ evolutions: component.evolutions?.filter(entry => entry.id !== evolution.id) })}>Remove change</Button>
      </div>)}
      <Button type="button" size="sm" variant="outline" disabled={!modifiers.length} onClick={() => update({ evolutions: [...(component.evolutions ?? []), { id: crypto.randomUUID(), modifierId: "" }] })}>Add progression change</Button>
    </div>
  </div>;
}
