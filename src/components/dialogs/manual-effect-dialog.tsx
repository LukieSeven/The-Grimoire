import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { ConditionEditor } from "./condition-editor";
import type { ManualTrackedEffect } from "../../lib/ability-components";
import type { Ability } from "../../lib/storage";
import { toast } from "sonner";

interface Props { targetId: string; initial?: ManualTrackedEffect; abilities?: Ability[]; onSave: (effect: ManualTrackedEffect) => void; onClose: () => void }
const field = "block w-full border border-border/50 bg-background p-2 text-sm mt-1";
export function ManualEffectDialog({ targetId, initial, abilities = [], onSave, onClose }: Props) {
  const [draft, setDraft] = useState<ManualTrackedEffect>(() => initial ? structuredClone(initial) : { id: crypto.randomUUID(), targetId, name: "", rules: "", active: true });
  const [aura, setAura] = useState(initial?.radius !== undefined);
  const update = (patch: Partial<ManualTrackedEffect>) => setDraft(previous => ({ ...previous, ...patch }));
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="sm:max-w-xl max-h-[85dvh] overflow-y-auto">
    <DialogHeader><DialogTitle>{initial ? "Edit tracked effect" : "Track an effect"}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!draft.name.trim()) return; if (aura && (draft.radius === undefined || !Number.isFinite(draft.radius) || draft.radius < 0)) { toast.error("Enter the aura radius in feet."); return; } if (draft.conditions?.some(condition => condition.kind === "situation" ? !condition.label.trim() : !condition.resource || !condition.operator || (!["depleted", "full"].includes(condition.operator) && condition.threshold === undefined))) { toast.error("Complete each requirement."); return; } onSave({ ...draft, name: draft.name.trim(), radius: aura ? draft.radius : undefined, radiusUnit: aura ? "ft" : undefined }); onClose(); }}>
      <label className="block text-sm">Name<input required className={field} value={draft.name} onChange={event => update({ name: event.target.value })}/></label>
      <label className="block text-sm">Source ability (optional)<select className={field} value={draft.abilityId ?? ""} onChange={event => update({ abilityId: event.target.value === "" ? undefined : Number(event.target.value) })}><option value="">No linked ability</option>{abilities.map(ability => <option key={ability.id} value={ability.id}>{ability.name}</option>)}</select></label>
      {targetId === "self" && <>
      <label className="block text-sm">Effect / rules<textarea rows={3} className={field} value={draft.rules} onChange={event => update({ rules: event.target.value })}/></label>
      <div className="flex flex-wrap gap-4"><label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={draft.active} onChange={event => update({ active: event.target.checked })}/>Active</label>{targetId === "self" && <label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={aura} onChange={event => setAura(event.target.checked)}/>Aura</label>}</div>
      {aura && targetId === "self" && <div className="grid grid-cols-1 gap-3"><label className="text-sm">Aura radius (ft)<input type="number" min="0" step="any" className={field} value={draft.radius ?? ""} onChange={event => update({ radius: event.target.value === "" ? undefined : Number(event.target.value) })}/></label></div>}
      <label className="block text-sm">Duration<input className={field} value={draft.duration ?? ""} onChange={event => update({ duration: event.target.value })}/></label>
      <div className="space-y-3"><ConditionEditor conditions={draft.conditions ?? []} match={draft.conditionMatch ?? "all"} mode={draft.triggerMode ?? "manual"} onChange={(conditions, conditionMatch, triggerMode) => update({ conditions, conditionMatch, triggerMode })}/></div>
      <p className="text-xs text-muted-foreground">Manual tracking records rules and duration. It does not automatically change character stats or spend resources.</p>
      </>}
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Save effect</Button></div>
    </form>
  </DialogContent></Dialog>;
}
