import type { Ability } from "../lib/storage";
import type { EffectApplication } from "../lib/tracker-types";
import type { TriggerContext } from "../lib/ability-components";
import { resolveTrackerEffects, isEffectApplied } from "../lib/tracker";
import { Button } from "./ui/button";

interface Props {
  ability: Ability; rank: string; stats: Record<string, number>; vitals: TriggerContext;
  confirmations: Record<string, boolean>; applications: EffectApplication[];
  onApplicationsChange: (applications: EffectApplication[]) => void;
  onRoll: (formula: string, label: string) => void;
}
export function AbilityComponentList(props: Props) {
  return <div className="space-y-3">{resolveTrackerEffects([props.ability], props.rank, props.stats, props.vitals, props.confirmations).map(entry => {
    const active = isEffectApplied(entry, "self", props.applications);
    const recorded = props.applications.some(application => application.abilityId === props.ability.id && application.effectId === entry.effect.id && application.targetId === "self");
    const personal = entry.createdEffect ? entry.createdEffect.targets.includes("self") || !!entry.sharedActivation && !!entry.component?.kinds.includes("aura") : entry.component?.targets.includes("self") || entry.component?.kinds.includes("aura") || entry.component?.createdEffects?.some(effect => effect.delivery === "ongoing");
    return <article key={entry.effect.id} className="border border-border/40 p-3 space-y-2 text-sm">
      <div className="flex justify-between gap-2"><h5>{entry.effect.name}</h5><span className="text-xs text-primary">{active ? "Active" : entry.progression !== "unlocked" ? entry.progression : entry.applicability}</span></div>
      <p className="text-xs text-muted-foreground">{entry.createdEffect ? `${entry.sharedActivation ? "Part of" : "Created by"} ${entry.component?.name}` : `${entry.component?.kinds.join(" · ")} / ${entry.component?.behaviors.join(" · ")}`}</p>
      <p className="whitespace-pre-wrap">{entry.effect.description}</p>
      {entry.effect.tracking?.radius !== undefined && <p>Radius: {entry.effect.tracking.radius} {entry.effect.tracking.radiusUnit}</p>}
      {entry.effect.duration && <p>Duration: {entry.effect.duration}</p>}
      <div className="flex flex-wrap gap-2">
        {entry.effect.rollFormula && <Button size="sm" variant="outline" disabled={entry.progression !== "unlocked" || entry.applicability !== "available"} onClick={() => props.onRoll(entry.effect.rollFormula!, props.ability.name)}>Roll</Button>}
        {personal && !entry.sharedActivation && !entry.permanent && (entry.createdEffect ? entry.createdEffect.triggerMode : entry.component?.triggerMode) !== "reference" && <Button size="sm" variant="outline" disabled={!recorded && entry.applicability !== "available"} onClick={() => props.onApplicationsChange(recorded ? props.applications.filter(application => !(application.abilityId === props.ability.id && application.effectId === entry.effect.id && application.targetId === "self")) : [...props.applications, { id: crypto.randomUUID(), abilityId: props.ability.id, effectId: entry.effect.id, targetId: "self", startedAt: new Date().toISOString(), duration: entry.effect.duration }])}>{recorded ? "End effect" : "Activate Ability"}</Button>}
      </div>
      {entry.applicability === "requires judgment" && <p className="text-xs text-muted-foreground">Confirm situation requirements in the Trigger tracker.</p>}
      {!personal && <p className="text-xs text-muted-foreground">Track named effects on a target through Combat.</p>}
    </article>;
  })}</div>;
}
