import { EffectChip } from "./effect-chip";
import { effectDetails, outcomeLabel, saveReference } from "../lib/effect-details";
import { applyTrackedEffect } from "../lib/effect-stacking";
import { rangedAreaSummary } from "../lib/ability-input";
import { useState } from "react";
import type { Ability, Familiar } from "../lib/storage";
import type { EffectApplication } from "../lib/tracker-types";
import type { TriggerContext } from "../lib/ability-components";
import { resolveTrackerEffects, isEffectApplied } from "../lib/tracker";
import { Button } from "./ui/button";
interface Props {
  ability: Ability; rank: string; stats: Record<string, number>; vitals: TriggerContext;
  confirmations: Record<string, boolean>; applications: EffectApplication[];
  onApplicationsChange: (applications: EffectApplication[]) => void;
  onRoll: (formula: string, label: string, familiar?: Familiar) => void;
  onUse: (nodeId: string) => void;
  onUseResult: (resultId: string) => void;
  onPayMana?: (amount: number, label: string, familiar?: Familiar) => void;
  familiars?: Familiar[];
  movementSpeed?: number;
  timing?: Record<string, { elapsed?: string; spent?: string }>;
  onTimingChange?: (id: string, patch: { elapsed?: string; spent?: string }) => void;
}
export function AbilityResultList(props: Props) {
  const [elapsed, setElapsed] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(props.timing ?? {}).map(([id, value]) => [id, value.elapsed ?? ""])));
  const entries = resolveTrackerEffects([props.ability], props.rank, props.stats, props.vitals, props.confirmations, props.familiars);
  const nodes = entries.filter(entry => entry.input && !entry.result).map(entry => entry.input!);
  const record = (id: string) => props.applications.some(application => application.abilityId === props.ability.id && application.effectId === id && application.targetId === "self");
  const toggle = (id: string, duration?: string) => props.onApplicationsChange(record(id) ? props.applications.filter(application => !(application.abilityId === props.ability.id && application.effectId === id && application.targetId === "self")) : [...props.applications, { id: crypto.randomUUID(), abilityId: props.ability.id, effectId: id, targetId: "self", startedAt: new Date().toISOString(), duration }]);
  return <div className="space-y-4">{nodes.map(node => {
    const parent = entries.find(entry => entry.effect.id === node.id)!;
    const active = isEffectApplied(parent, "self", props.applications);
    const elapsedValue = Number(elapsed[node.id] || 0);
    return <section key={node.id} className="border border-border/40 p-3 space-y-3">
      {node.id !== props.ability.definition?.id && <div className="flex justify-between gap-2"><h5 className="text-primary">{node.name}</h5><span className="text-xs">{active ? "Active" : parent.progression !== "unlocked" ? parent.progression : parent.applicability}</span></div>}
      {parent.familiar && <p className="text-xs text-primary">Summoned familiar: {parent.familiar.name}</p>}
      {node.targets.includes("Summon") && node.summon && <p className="text-xs">Summons {node.summon.familiar.name} · {node.summon.abilities.length} imported abilities below</p>}
      {node.id !== props.ability.definition?.id && node.description && <p className="text-sm whitespace-pre-wrap">{node.description}</p>}
      {rangedAreaSummary(node) && <p className="text-xs">{rangedAreaSummary(node)}</p>}
      <p className="text-xs">{node.rangeType}{node.range ? ` · ${node.range}${["Aura", "Ranged"].includes(node.rangeType) ? " ft" : ""}` : ""} · {parent.effect.duration}</p>
      {parent.effect.description && <p className="text-sm whitespace-pre-wrap">{parent.effect.description}</p>}
      {!["Always On", "When Triggered"].includes(node.durationType) && (node.reaction || node.timeCost !== undefined) && <p className="text-xs">Time cost: {node.reaction ? "Reaction" : `${node.timeCost} seconds`}</p>}
      {!["Always On", "When Triggered"].includes(node.durationType) && !node.reaction && node.timeCost !== undefined && node.timeCost > 6 && <label className="block text-xs">Activation progress (seconds, manual)<input className="border border-border/40 bg-background p-1 ml-2 w-20" type="number" min="0" step="any" value={elapsed[node.id] ?? ""} onBlur={event => props.onTimingChange?.(node.id, { elapsed: event.target.value })} onChange={event => setElapsed(previous => ({ ...previous, [node.id]: event.target.value }))}/><span className="block mt-1">{elapsedValue} seconds completed · {Math.max(0, node.timeCost - elapsedValue)} seconds remaining</span></label>}
      {node.cooldown !== undefined && <p className="text-xs">Cooldown: {node.cooldown} {node.cooldownUnit.toLowerCase()} · starts {node.cooldownStarts === "activation" ? "on activation" : "when ability ends"}</p>}
      {(node.uses || node.recharge) && <p className="text-xs">{node.uses} {node.recharge}</p>}
      <div className="flex flex-wrap gap-2">
        {node.durationType !== "When Triggered" && node.id !== props.ability.definition?.id && !parent.permanent && node.trigger.mode !== "reference" && <Button size="sm" variant="outline" disabled={!record(node.id) && parent.applicability !== "available"} onClick={() => record(node.id) ? toggle(node.id, parent.effect.duration) : props.onUse(node.id)}>{record(node.id) ? "End Ability" : "Use Ability"}</Button>}
        {!["Always On", "When Triggered"].includes(node.durationType) && props.onPayMana && node.manaPerTurn !== undefined && <Button size="sm" variant="outline" onClick={() => props.onPayMana!(node.manaPerTurn!, `${node.name}: per turn`, parent.familiar)}>Pay {node.manaPerTurn} mana / turn</Button>}
      </div>
      {entries.filter(entry => entry.input?.id === node.id && entry.result).map(entry => entry.result?.attachedEffectOnly ? <EffectChip key={entry.effect.id} name={effectDetails(entry.result.templateId!, props.ability.definition!.options).name} description={outcomeLabel(entry.result.effectOutcome) + "\n" + (entry.result.effectOutcome && entry.result.effectOutcome !== "always" ? saveReference(entry.result) + "\n" : "") + effectDetails(entry.result.templateId!, props.ability.definition!.options).description}/> : <article key={entry.effect.id} className="border border-border/40 p-3 space-y-2">
        <div className="flex justify-between gap-2"><strong className="text-sm">{entry.targetLabels?.join(", ")}</strong><span className="text-xs">{isEffectApplied(entry, "self", props.applications) ? "Active" : entry.applicability}</span></div>
        {entry.result?.templateId && <EffectChip name={effectDetails(entry.result.templateId, props.ability.definition!.options).name} description={outcomeLabel(entry.result.effectOutcome) + "\n" + effectDetails(entry.result.templateId, props.ability.definition!.options).description}/>}
        {(entry.result?.templateId ? entry.result.rules : entry.effect.description)?.trim() && <p className="text-sm whitespace-pre-wrap">{entry.result?.templateId ? entry.result.rules : entry.effect.description}</p>}
        {entry.result?.durationType?.trim() && entry.effect.duration !== parent.effect.duration && <p className="text-xs">{entry.effect.duration}</p>}
        <div className="flex gap-2 flex-wrap">{entry.result?.target === "Self" && entry.result.stacking === "Stack" && <Button size="sm" variant="outline" disabled={!isEffectApplied(entry, "self", props.applications) || entry.result.maxStacks !== undefined && (props.applications.find(application => application.abilityId === entry.ability.id && application.effectId === entry.effect.id && application.targetId === "self")?.stacks ?? 1) >= entry.result.maxStacks} onClick={() => props.onApplicationsChange(applyTrackedEffect(props.applications, entry, "self"))}>Add stack ({props.applications.find(application => application.abilityId === entry.ability.id && application.effectId === entry.effect.id && application.targetId === "self")?.stacks ?? 1}{entry.result.maxStacks ? "/" + entry.result.maxStacks : ""})</Button>}{entry.effect.rollFormula && <Button size="sm" variant="outline" disabled={!isEffectApplied(entry, "self", props.applications) && entry.applicability !== "available"} onClick={() => props.onUseResult(entry.effect.id)}>Use & Roll</Button>}
        {node.durationType !== "When Triggered" && !entry.sharedActivation && entry.result?.target === "Self" && entry.result.trigger.mode !== "reference" && <Button size="sm" variant="outline" disabled={!record(entry.effect.id) && entry.applicability !== "available"} onClick={() => toggle(entry.effect.id, entry.effect.duration)}>{record(entry.effect.id) ? "End effect" : "Apply effect"}</Button>}</div>
        {entry.result?.target !== "Self" && entry.result?.templateId && <p className="text-xs text-muted-foreground">Apply to an individual target through Combat.</p>}
      </article>)}
      {parent.applicability === "requires judgment" && <p className="text-xs text-muted-foreground">Resource requirements are not currently met.</p>}
    </section>;
  })}</div>;
}
