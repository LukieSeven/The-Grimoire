import { useListSkills } from "../hooks/useStorage";
import { EffectChip } from "./effect-chip";
import { effectDetails, outcomeLabel, saveReference } from "../lib/effect-details";
import { applyTrackedEffect, expireEffectApplications } from "../lib/effect-stacking";
import { useEffect, useRef, useState } from "react";
import { AbilityOptionsFields } from "./dialogs/ability-options";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { COMMON_EFFECTS, mergeOptions } from "../lib/ability-input";
import type { AbilityOptions } from "../lib/ability-input";
import { applyPresetEffect, presetEffect } from "../lib/preset-effect";
import { Button, buttonVariants } from "./ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "./ui/alert-dialog";
import { ManualEffectDialog } from "./dialogs/manual-effect-dialog";
import { RecentCombatantsRow } from "./recent-combatants-row";
import { resolveTrackerEffects, isEffectApplied, isAbilityTriggerActive } from "../lib/tracker";
import type { ResolvedEffect } from "../lib/tracker";
import { groupAbilityTriggers, manualTriggerCategories } from "../lib/trigger-groups";
import { resolveFamiliarTrackerEffects } from "../lib/familiar-values";
import { combatEffectName } from "../lib/combat-effect-tags";
import { evaluateRequirements, conditionText, TRIGGER_CHOICES } from "../lib/ability-components";
import type { ManualTrackedEffect, TriggerCondition, TriggerContext } from "../lib/ability-components";
import { calculateAbilityEvolutions } from "../lib/storage";
import type { Ability, Character, Familiar } from "../lib/storage";
import type { EffectApplication } from "../lib/tracker-types";

interface Combatant { id: string; name: string; initiative: number; statuses: string[] }
interface Props {
  onOptionsChange: (options: AbilityOptions, onSaved: () => void) => void;
  optionsPending?: boolean;
  character: Character; abilities: Ability[]; stats: Record<string, number>; vitals: TriggerContext;
  combatants: Combatant[]; turn: number;
  onCombatantsChange: (combatants: Combatant[]) => void;
  onTurnChange: (turn: number) => void;
  onApplicationsChange: (applications: EffectApplication[]) => void;
  onManualEffectsChange: (effects: ManualTrackedEffect[]) => void;
  onConfirmationsChange: (confirmations: Record<string, boolean>) => void;
  onInspect: (abilityId: number, familiarId?: string | number) => void;
  onRestoreEffects: (snapshot: { applications: EffectApplication[]; manual: ManualTrackedEffect[]; familiars: Familiar[] }) => void;
  onLifetimeEvent: (event: "turn" | "combat", combatant?: Combatant) => void;
  onRoll: (formula: string, label: string, familiar?: Familiar) => void;
  combatantSources: string[];
  recentCombatants: Omit<Combatant, "id">[];
  onRememberCombatant: (combatant: Omit<Combatant, "id">) => void;
}
const field = "block w-full min-w-0 bg-background border border-border/50 px-2 py-1.5 text-xs mt-1";
const ringKey = (radius: number, unit?: string) => `${radius}|${unit?.trim().toLowerCase() ?? ""}`;

export function TrackerPanel(props: Props) {
  const { data: skills = [] } = useListSkills(props.character.id);
  const [effectSettings, setEffectSettings] = useState<AbilityOptions | null>(null);
  const effectOptions = mergeOptions(props.character.abilityOptions, ...props.abilities.map(ability => ability.definition?.options), ...(props.character.familiars ?? []).flatMap(familiar => familiar.abilities.map(ability => ability.definition?.options)));
  const openEffectSettings = () => setEffectSettings(effectOptions);
  const [tab, setTab] = useState<"combat" | "passive" | "triggers">("combat");
  const [radius, setRadius] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [initiative, setInitiative] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [situation, setSituation] = useState("");
  const [manualDraft, setManualDraft] = useState<{ targetId: string; initial?: ManualTrackedEffect } | null>(null);
  const [applySelections, setApplySelections] = useState<Record<string, string>>({});
  const applications = props.character.effectApplications ?? [];
  const manual = props.character.manualTrackedEffects ?? [];
  const [undoHistory, setUndoHistory] = useState<{ characterId: number; combatants: Combatant[]; turn: number; applications: EffectApplication[]; manual: ManualTrackedEffect[]; familiars: Familiar[] }[]>([]);
  const rememberCombatChange = () => {
    const snapshot = structuredClone({ characterId: props.character.id, combatants: props.combatants, turn: props.turn,
      applications, manual, familiars: props.character.familiars ?? [] });
    setUndoHistory(previous => [...previous.filter(item => item.characterId === props.character.id), snapshot].slice(-50));
  };
  const editCheckpoint = useRef<string | null>(null);
  const rememberEdit = (key: string) => { if (editCheckpoint.current !== key) { rememberCombatChange(); editCheckpoint.current = key; } };
  const undoCombatChange = () => {
    const snapshot = undoHistory.at(-1);
    if (!snapshot || snapshot.characterId !== props.character.id) return;
    props.onCombatantsChange(snapshot.combatants);
    props.onTurnChange(snapshot.turn);
    props.onRestoreEffects(snapshot);
    setUndoHistory(previous => previous.slice(0, -1));
    setApplySelections({});
  };
  const confirmations = props.character.triggerConfirmations ?? {};
  const effects = [...resolveTrackerEffects(props.abilities, props.character.rank, props.stats, props.vitals, confirmations, props.character.familiars), ...(props.character.familiars ?? []).flatMap(resolveFamiliarTrackerEffects)];
  const effectKey = (entry: ResolvedEffect) => `${entry.ownerFamiliar?.id ?? "character"}:${entry.ability.id}:${entry.effect.id}`;
  const activeSelfEffects = effects.filter(entry => !entry.familiar && !entry.ownerFamiliar && isEffectApplied(entry, "self", applications));
  const selfEffects = activeSelfEffects.filter(entry => !(entry.input && !entry.result));
  const manualActive = (effect: ManualTrackedEffect) => {
    const state = evaluateRequirements(effect.conditions, effect.conditionMatch, props.vitals, confirmations);
    return state === "met" && (effect.active || (effect.triggerMode === "automatic" && !!effect.conditions?.length));
  };
  const selfManual: ManualTrackedEffect[] = [];
  const rings = [...new Set([
    ...activeSelfEffects.filter(entry => entry.effect.tracking?.radius !== undefined).map(entry => ringKey(entry.effect.tracking!.radius!, entry.effect.tracking?.radiusUnit)),
    ...selfManual.filter(effect => effect.radius !== undefined).map(effect => ringKey(effect.radius!, effect.radiusUnit)),
  ])].sort((left, right) => Number(left.split("|")[0]) - Number(right.split("|")[0]));
  const selectedRadius = radius && rings.includes(radius) ? radius : null;
  const triggerGroups = groupAbilityTriggers(effects, props.abilities);
  const selectedTrigger = triggerGroups.some(group => group.name === situation) ? situation : "";
  const visibleTriggerGroups = triggerGroups.filter(group => !selectedTrigger || group.name === selectedTrigger);

  const record = (entry: ResolvedEffect, targetId: string) => {
    if (targetId !== "self") rememberCombatChange();
    const duplicates = manual.filter(effect => effect.targetId === targetId && entry.result?.templateId && effect.templateId === entry.result.templateId);
    if (duplicates.length) props.onManualEffectsChange(manual.filter(effect => !duplicates.includes(effect)));
    props.onApplicationsChange(applyTrackedEffect(applications, entry, targetId));
  };
  const requirements = (conditions: TriggerCondition[] = [], grouped = false) => <div className="space-y-2">{conditions.map(condition => <div key={condition.id} className="text-xs border-t border-border/30 pt-2"><p>{conditionText(condition)}</p>{condition.kind === "situation" && (!grouped || !TRIGGER_CHOICES.includes(condition.label)) && <div className="flex gap-2 mt-1">{([true, false, undefined] as const).map((value, index) => <button type="button" key={index} aria-pressed={confirmations[condition.id] === value} className={`border px-2 py-1 ${confirmations[condition.id] === value ? "border-primary text-primary" : "border-border"}`} onClick={() => { const next = { ...confirmations }; if (value === undefined) delete next[condition.id]; else next[condition.id] = value; props.onConfirmationsChange(next); }}>{value === true ? "Met" : value === false ? "Not met" : "Undecided"}</button>)}</div>}</div>)}</div>;
  const canApply = (entry: ResolvedEffect, targetId: string) => {
    if (targetId !== "self" && !combatEffectName(entry)) return false;
    if (entry.progression !== "unlocked" || entry.applicability !== "available") return false;
    if ((entry.createdEffect ? entry.createdEffect.triggerMode ?? "manual" : entry.component?.triggerMode) === "reference") return false;
    if (entry.input) {
      if ((entry.result?.trigger.mode ?? entry.input.trigger.mode) === "reference") return false;
      if (!entry.result) return targetId === "self";
      if (!entry.sharedActivation) return targetId === "self" ? entry.result.target === "Self" : entry.result.target !== "Self";
    }
    if (entry.sharedActivation) {
      if (targetId === "self") return false;
      const parent = effects.find(effect => effect.ownerFamiliar?.id === entry.ownerFamiliar?.id && effect.ability.id === entry.ability.id && effect.effect.id === entry.sharedActivation!.effectId);
      if (!parent || !isEffectApplied(parent, "self", applications)) return false;
      if (entry.result) return entry.result.target !== "Self";
    }
    const targets = entry.createdEffect?.targets ?? entry.component?.targets ?? entry.effect.tracking?.targets;
    return !targets?.length || (targetId === "self" ? targets.includes("self") || !!entry.component?.kinds.includes("aura") || !!entry.component?.createdEffects?.some(effect => effect.delivery === "ongoing") : targets.includes("enemies") || targets.includes("allies") || targets.includes("custom"));
  };
  const renderEffect = (entry: ResolvedEffect, targetId: string, controls = true) => {
    const active = isEffectApplied(entry, targetId, applications);
    const recorded = applications.some(application => application.familiarId === entry.ownerFamiliar?.id && application.abilityId === entry.ability.id && application.effectId === entry.effect.id && application.targetId === targetId);
    const automatic = entry.permanent && targetId === "self";
    return <article key={effectKey(entry)} className="border border-border/40 p-3 space-y-2 text-sm">
      <div className="flex justify-between gap-2"><button type="button" className="font-semibold text-primary hover:underline text-left" onClick={() => props.onInspect(entry.ability.id, entry.ownerFamiliar?.id)}>{entry.effect.name}</button><span className="text-xs text-primary">{active ? "Active" : entry.progression !== "unlocked" ? entry.progression : entry.applicability}</span></div>
      {entry.ownerFamiliar && <p className="text-xs text-primary">Familiar: {entry.ownerFamiliar.name}</p>}
      {entry.familiar && <p className="text-xs text-primary">Summoned familiar: {entry.familiar.name}</p>}
      {!!entry.targetLabels?.length && <p className="text-xs">Targets: {entry.targetLabels.join(", ")}</p>}
      {entry.createdEffect && <p className="text-xs text-muted-foreground">{entry.sharedActivation ? "Part of" : "Created by"} {entry.component?.name}</p>}
      {!entry.targetLabels?.length && !!entry.effect.tracking?.targets?.length && <p className="text-xs">Targets: {entry.effect.tracking.targets.join(", ")}</p>}
      {entry.result?.effectOutcome && entry.result.effectOutcome !== "always" && saveReference(entry.result) && <p className="text-xs whitespace-pre-wrap">{saveReference(entry.result)}</p>}
      {entry.effect.description && <p className="whitespace-pre-wrap">{entry.effect.description}</p>}
      {!entry.createdEffect && entry.component?.targetRules && <p className="whitespace-pre-wrap">{entry.component.targetRules}</p>}
      {entry.component?.cost && <p className="text-xs">Cost: {entry.component.cost}</p>}
      {entry.component?.uses && <p className="text-xs">Uses: {entry.component.uses}</p>}
      {controls && entry.effect.rollFormula && <div className="flex flex-wrap items-center gap-2"><code className="text-xs">{entry.effect.rollFormula}</code><Button size="sm" variant="outline" disabled={entry.progression !== "unlocked" || (!active && entry.applicability !== "available")} onClick={() => props.onRoll(entry.effect.rollFormula!, entry.input?.name ?? entry.ability.name, entry.familiar)}>Roll</Button></div>}
      {entry.input && !entry.result && <div className="text-xs space-y-1">
        {entry.input.manaCost !== undefined && <p>Activation: {entry.input.manaCost} mana</p>}
        {entry.input.manaPerTurn !== undefined && <p>Per turn: {entry.input.manaPerTurn} mana</p>}
        {(entry.input.reaction || entry.input.timeCost !== undefined) && <p>Time cost: {entry.input.reaction ? "Reaction" : `${entry.input.timeCost} seconds`}</p>}
        {entry.input.cooldown !== undefined && <p>Cooldown: {entry.input.cooldown} {entry.input.cooldownUnit.toLowerCase()} · starts {entry.input.cooldownStarts === "activation" ? "on activation" : "on ending"}</p>}
      </div>}
      {controls && entry.input && <>{!!entry.input.trigger.conditions.length && <><p className="text-xs text-primary">When triggered</p>{requirements(entry.input.trigger.conditions, true)}</>}
        {!!entry.input.ending.conditions.length && <><p className="text-xs text-primary">Ends when</p>{requirements(entry.input.ending.conditions, true)}</>}
        {entry.result && <>{requirements(entry.result.trigger.conditions, true)}{!!entry.result.ending.conditions.length && <><p className="text-xs text-primary">Effect ends when</p>{requirements(entry.result.ending.conditions, true)}</>}</>}
      </>}
      {controls && requirements(entry.component?.conditions, true)}
      {controls && entry.createdEffect && requirements(entry.createdEffect.conditions, true)}
      {controls && entry.input?.durationType !== "When Triggered" && !automatic && !(entry.sharedActivation && targetId === "self") && <Button type="button" size="sm" disabled={!recorded && !canApply(entry, targetId)} onClick={() => record(entry, targetId)}>{recorded ? "End effect" : "Apply effect"}</Button>}
      {automatic && <p className="text-xs text-muted-foreground">{entry.input?.durationType === "Always On" || entry.component?.behaviors.includes("always-on") ? "Always on" : "Automatic condition"}</p>}
    </article>;
  };
  const renderManual = (effect: ManualTrackedEffect, controls = false) => <article key={effect.id} className="border border-border/40 p-3 space-y-2 text-sm">
    <div className="flex justify-between gap-2"><strong>{effect.name}</strong><span className="text-xs text-primary">{manualActive(effect) ? "Active" : "Inactive"}</span></div><p className="text-xs text-muted-foreground">Manual effect</p><p className="whitespace-pre-wrap">{effect.rules}</p>
    {effect.radius !== undefined && <p className="text-xs">Radius: {effect.radius} {effect.radiusUnit}</p>}{effect.duration && <p className="text-xs">Duration: {effect.duration}</p>}
    {controls && requirements(effect.conditions)}
    <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setManualDraft({ targetId: effect.targetId, initial: effect })}>Edit</Button><Button size="sm" variant="outline" disabled={!manualActive(effect) && evaluateRequirements(effect.conditions, effect.conditionMatch, props.vitals, confirmations) !== "met"} onClick={() => props.onManualEffectsChange(manual.map(entry => entry.id === effect.id ? { ...entry, active: !manualActive(entry), triggerMode: manualActive(entry) && entry.triggerMode === "automatic" ? "manual" : entry.triggerMode } : entry))}>{manualActive(effect) ? "End" : "Activate"}</Button></div>
  </article>;
  const updateCombatants = (combatants: Combatant[], remember = true) => {
    if (remember) rememberCombatChange();
    const activeId = props.combatants[props.turn]?.id;
    const sorted = [...combatants].sort((left, right) => right.initiative - left.initiative);
    props.onCombatantsChange(sorted);
    props.onTurnChange(Math.max(0, sorted.findIndex(combatant => combatant.id === activeId)));
  };
  useEffect(() => {
    if (props.combatants.some((combatant, index) => index > 0 && props.combatants[index - 1].initiative < combatant.initiative)) {
      updateCombatants(props.combatants, false);
    }
  }, [props.combatants, props.turn]);

  return <section aria-label="Character trackers" className="border border-border bg-card p-3 flex flex-col gap-3 min-w-0 min-h-0 h-[var(--workspace-panel-height)] max-h-[var(--workspace-panel-height)] overflow-hidden">
    <div role="tablist" aria-label="Tracker views" className="workspace-tabs flex gap-1 bg-background/50 rounded-none p-1 border border-border/30">{(["combat", "passive", "triggers"] as const).map((view, index, views) => <button type="button" key={view} role="tab" tabIndex={tab === view ? 0 : -1} id={`tracker-${view}`} aria-selected={tab === view} aria-controls={`tracker-panel-${view}`} className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider ${tab === view ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setTab(view)} onKeyDown={event => { const next = event.key === "ArrowRight" ? views[(index + 1) % views.length] : event.key === "ArrowLeft" ? views[(index + views.length - 1) % views.length] : event.key === "Home" ? views[0] : event.key === "End" ? views[views.length - 1] : null; if (next) { event.preventDefault(); setTab(next); document.getElementById(`tracker-${next}`)?.focus(); } }}>{view === "triggers" ? "Triggers" : view === "passive" ? "Passive" : "Combat"}</button>)}</div>
    <div role="tabpanel" id={`tracker-panel-${tab}`} aria-labelledby={`tracker-${tab}`} className={`min-h-0 flex-1 ${tab === "combat" ? "workspace-scroll overflow-y-auto space-y-3" : "flex flex-col gap-3 overflow-hidden"}`}>
      {tab === "combat" && <>
        <form className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] gap-2 items-end" onSubmit={event => { event.preventDefault(); if (!name.trim() || !initiative.trim() || !Number.isFinite(Number(initiative))) return; const combatant = { name: name.trim(), initiative: Number(initiative), statuses: [] }; updateCombatants([...props.combatants, { id: crypto.randomUUID(), ...combatant }]); props.onRememberCombatant(combatant); setName(""); setInitiative(""); }}>
          <label className="min-w-0"><span className="sr-only">Combatant</span><input aria-label="Combatant" placeholder="Combatant" className={`${field} !mt-0 h-8 normal-case text-foreground`} value={name} onChange={event => setName(event.target.value)} required/></label><label className="min-w-0"><span className="sr-only">Initiative</span><input aria-label="Initiative" placeholder="Initiative" type="number" className={`${field} !mt-0 h-8 text-center text-foreground`} value={initiative} onChange={event => setInitiative(event.target.value)} required/></label><Button size="sm" type="submit" className="h-8 px-2">Add</Button>
        </form>
        <details className="text-xs space-y-2"><summary className="cursor-pointer text-primary">Quick Add</summary><label className="block">Use a recorded name<select className={field} value="" onChange={event => setName(event.target.value)}><option value="">Choose source</option>{[...new Set(props.combatantSources)].map(source => <option key={source}>{source}</option>)}</select></label><RecentCombatantsRow entries={props.recentCombatants} onSelect={combatant => { setName(combatant.name); setInitiative(String(combatant.initiative)); }}/></details>
        {!props.combatants.length && <p className="text-xs text-muted-foreground">No combatants in this encounter.</p>}
        {props.combatants.map((combatant, index) => <details key={combatant.id} aria-current={index === props.turn ? "step" : undefined} className={`border ${index === props.turn ? "border-primary bg-primary/5" : "border-border/40"}`}>
          <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer flex items-center gap-2 min-h-9 px-2 py-1.5 focus-visible:outline focus-visible:outline-primary" aria-label={`${combatant.name}, initiative ${combatant.initiative}${index === props.turn ? ", current turn" : ""}`}>
            {index === props.turn && <span className="w-1.5 h-1.5 bg-primary rounded-full shrink-0" aria-hidden="true"/>}<span className="flex-1 min-w-0 truncate text-xs font-semibold">{combatant.name}</span><span className="text-xs font-mono text-center border-l border-border/50 pl-2 min-w-10">{combatant.initiative}</span>
          </summary>
          <div className="border-t border-border/40 p-2 space-y-2">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-2"><label className="text-xs">Name<input className={field} value={combatant.name} onBlur={() => { editCheckpoint.current = null; }} onChange={event => { rememberEdit(`${combatant.id}:name`); updateCombatants(props.combatants.map(entry => entry.id === combatant.id ? { ...entry, name: event.target.value } : entry), false); }}/></label><label className="text-xs">Initiative<input type="number" className={field} value={combatant.initiative} onBlur={() => { editCheckpoint.current = null; }} onChange={event => { if (event.target.value && Number.isFinite(Number(event.target.value))) { rememberEdit(`${combatant.id}:initiative`); updateCombatants(props.combatants.map(entry => entry.id === combatant.id ? { ...entry, initiative: Number(event.target.value) } : entry), false); } }}/></label></div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 empty:hidden">{applications.filter(application => application.targetId === combatant.id).map(application => { const entry = effects.find(effect => effect.ownerFamiliar?.id === application.familiarId && effect.ability.id === application.abilityId && (effect.effect.id === application.effectId || effect.result?.attachedEffectOnly && application.effectId === effect.effect.id.split(":effect:")[0] && application.templateId === effect.result.templateId)); const label = entry ? combatEffectName(entry) ?? entry.effect.name : "Unlinked effect"; const details = entry?.result?.templateId ? effectDetails(entry.result.templateId, entry.ability.definition?.options ?? effectOptions).description : entry?.effect.description ?? "The source is no longer available."; return <span key={application.id} className="inline-flex items-center gap-1"><EffectChip name={label + ((application.stacks ?? 1) > 1 ? ` ×${application.stacks}` : "")} description={[outcomeLabel(entry?.result?.effectOutcome), entry?.result?.effectOutcome && entry.result.effectOutcome !== "always" ? saveReference(entry.result) : "", details, entry?.effect.duration].filter(Boolean).join("\n")} onRemove={() => { rememberCombatChange(); props.onApplicationsChange(applications.filter(item => item.id !== application.id)); }}/>{entry?.result?.stacking === "Stack" && <button type="button" className="text-xs text-cyan-400" aria-label={`Add stack of ${label}`} disabled={entry.result.maxStacks !== undefined && (application.stacks ?? 1) >= entry.result.maxStacks} onClick={() => record(entry, combatant.id)}>+</button>}</span>; })}</div>
            <div className="flex flex-wrap gap-1.5 empty:hidden">{manual.filter(effect => effect.targetId === combatant.id && manualActive(effect)).map(effect => <EffectChip key={effect.id} name={effect.name + ((effect.stacks ?? 1) > 1 ? ` ×${effect.stacks}` : "")} description={[effect.definition && effect.templateId ? effectDetails(effect.templateId, { ...effectOptions, effects: [{ id: effect.templateId, name: effect.name, kind: "Buff", rules: effect.rules, definition: effect.definition }] }).description : effect.templateId ? effectDetails(effect.templateId, effectOptions).description : effect.rules, effect.duration].filter(Boolean).join("\n")} onRemove={() => { rememberCombatChange(); props.onManualEffectsChange(manual.filter(item => item.id !== effect.id)); }}/>)}</div>
            <label className="block text-xs">Apply Effect<select className={field} value={applySelections[combatant.id] ?? ""} onChange={event => event.target.value === "__custom__" ? openEffectSettings() : setApplySelections(previous => ({ ...previous, [combatant.id]: event.target.value }))}><option value="">Choose effect</option><optgroup label="Effects">{COMMON_EFFECTS.map(name => <option key={name} value={`preset:common:${name}`}>{name}</option>)}{effectOptions.effects.filter(effect => effect.name.trim()).map(effect => <option key={effect.id} value={`preset:${effect.id}`}>{effect.name}</option>)}</optgroup><option value="__custom__">Custom…</option>{effects.filter(entry => canApply(entry, combatant.id) && (!isEffectApplied(entry, combatant.id, applications) || entry.result?.stacking !== undefined)).map(entry => <option key={effectKey(entry)} value={effectKey(entry)}>{combatEffectName(entry)}{entry.result?.effectOutcome === "success" ? " · on success" : entry.result?.effectOutcome === "failed-save" ? " · failed save" : ""} · {entry.ability.name}</option>)}</select></label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Button size="sm" className="min-w-0 h-auto min-h-8 px-2 py-1 text-[10px] whitespace-normal" disabled={!applySelections[combatant.id]?.startsWith("preset:") && !effects.some(entry => effectKey(entry) === applySelections[combatant.id] && canApply(entry, combatant.id))} onClick={() => { const selection = applySelections[combatant.id] ?? ""; if (selection.startsWith("preset:")) { const preset = presetEffect(selection.slice(7), combatant.id, effectOptions); if (preset) { const linked = effects.find(entry => entry.result?.templateId === preset.templateId && isEffectApplied(entry, combatant.id, applications)); if (linked) record(linked, combatant.id); else { rememberCombatChange(); props.onManualEffectsChange(applyPresetEffect(manual, preset)); } } setApplySelections(previous => ({ ...previous, [combatant.id]: "" })); return; } const entry = effects.find(effect => effectKey(effect) === applySelections[combatant.id]); if (entry && canApply(entry, combatant.id)) record(entry, combatant.id); setApplySelections(previous => ({ ...previous, [combatant.id]: "" })); }}>Apply to combatant</Button><Button size="sm" variant="destructive" className="min-w-0 h-auto min-h-8 px-2 py-1 text-[10px] whitespace-normal" aria-label={`Delete ${combatant.name}`} title="Delete combatant" onClick={() => { rememberCombatChange(); const activeId = props.combatants[props.turn]?.id; const next = props.combatants.filter(entry => entry.id !== combatant.id); props.onCombatantsChange(next); props.onTurnChange(Math.max(0, next.findIndex(entry => entry.id === activeId))); }}>Delete</Button></div>
          </div>
          </div>
        </details>)}
      </>}
      {tab === "passive" && <>
        <div aria-label="Character and active auras" className="shrink-0 border border-border/40 bg-background/30 p-2">
          <div className="relative h-[10.5rem] grid place-items-center">
            <svg viewBox="0 0 260 260" className="absolute h-full aspect-square max-w-full" aria-label="Active aura ranges">{rings.map((ring, index) => {
              const bandWidth = 70 / rings.length;
              const label = [...new Set(selfEffects.filter(entry => entry.effect.tracking?.radius !== undefined && ringKey(entry.effect.tracking.radius, entry.effect.tracking.radiusUnit) === ring).map(entry => entry.effect.name).concat(selfManual.filter(effect => effect.radius !== undefined && ringKey(effect.radius, effect.radiusUnit) === ring).map(effect => effect.name)))].join(", ");
              return <g key={ring} role="button" tabIndex={0} aria-label={`Aura ${ring.replace("|", " ")}: ${label}`} aria-pressed={selectedRadius === ring} className="text-primary cursor-pointer group focus:outline-none" onClick={() => setRadius(ring)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setRadius(ring); } }}>
                <title>{label}</title>
                <circle cx="130" cy="130" r={48 + (index + .5) * bandWidth} fill="none" stroke="currentColor" strokeWidth={bandWidth} pointerEvents="stroke" className={`transition-opacity group-hover:opacity-25 group-focus-visible:opacity-30 ${selectedRadius === ring ? "opacity-20" : "opacity-[0.04]"}`}/>
                <circle cx="130" cy="130" r={48 + (index + 1) * bandWidth} fill="none" stroke="currentColor" strokeWidth={selectedRadius === ring ? 3 : 1.5} opacity={selectedRadius === ring ? 1 : .5} pointerEvents="none"/>
              </g>;
            })}</svg>
            <button type="button" aria-label={`Personal active effects: ${props.character.name}`} aria-pressed={selectedRadius === null} onClick={() => setRadius(null)} className={`relative flex flex-col items-center justify-center gap-1 p-1 w-14 h-16 rounded-full bg-background border transition-colors hover:border-primary focus-visible:outline focus-visible:outline-primary ${selectedRadius === null ? "border-primary text-primary" : "border-border"}`}><svg viewBox="0 0 60 80" width="24" height="32" aria-hidden="true" className="text-primary"><circle cx="30" cy="12" r="9" fill="currentColor"/><path d="M30 24V50M10 40L30 28L50 40M30 50L15 73M30 50L45 73" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/></svg><span className="text-[10px] max-w-full truncate px-1" title={props.character.name}>{props.character.name}</span></button>
          </div>
          <div className="flex flex-wrap justify-center gap-1">{rings.map(ring => <button type="button" key={ring} aria-pressed={selectedRadius === ring} className={`border px-2 py-1 text-xs ${selectedRadius === ring ? "border-primary text-primary" : "border-border"}`} onClick={() => setRadius(ring)}>{ring.replace("|", " ")}</button>)}</div>
        </div>
        <div tabIndex={0} role="region" aria-label="Active effect details" className="workspace-scroll space-y-3 flex-1 min-h-0 overflow-y-auto border border-border/50 bg-background/30 p-3">
          {selfEffects.filter(entry => selectedRadius ? entry.effect.tracking?.radius !== undefined && ringKey(entry.effect.tracking.radius, entry.effect.tracking.radiusUnit) === selectedRadius : entry.effect.tracking?.radius === undefined).map(entry => renderEffect(entry, "self", false))}
          {!selectedRadius && props.abilities.filter(ability => !ability.definition && !ability.components && ability.active).map(ability => <article key={ability.id} className="border border-border/40 p-3 text-sm space-y-2"><button type="button" className="text-primary underline" onClick={() => props.onInspect(ability.id)}>{ability.name}</button>{calculateAbilityEvolutions(ability, props.character.rank, props.stats).activeModifiers.filter(modifier => modifier.assignedToMechanicsTracker).map(modifier => <p key={modifier.id}>{modifier.name}: {modifier.effect}</p>)}</article>)}
          {!selfEffects.some(entry => selectedRadius ? entry.effect.tracking?.radius !== undefined && ringKey(entry.effect.tracking.radius, entry.effect.tracking.radiusUnit) === selectedRadius : entry.effect.tracking?.radius === undefined) && !selfManual.some(effect => selectedRadius ? effect.radius !== undefined && ringKey(effect.radius, effect.radiusUnit) === selectedRadius : effect.radius === undefined) && !(!selectedRadius && props.abilities.some(ability => !ability.definition && !ability.components && ability.active)) && <p className="text-xs text-muted-foreground">No active effects in this view.</p>}
        </div>
      </>}
      {tab === "triggers" && <>
        <label className="text-xs">Trigger<select className={field} value={selectedTrigger} onChange={event => setSituation(event.target.value)}><option value="">{triggerGroups.length ? "All tagged triggers" : "No tagged triggers"}</option>{triggerGroups.map(group => <option key={group.name}>{group.name}</option>)}</select></label>
        <div role="region" aria-label="Trigger references" tabIndex={0} className="workspace-scroll flex-1 min-h-0 overflow-y-auto border border-border/40 p-3 space-y-3">
          {visibleTriggerGroups.map(group => <section key={group.name} aria-label={group.name} className="space-y-3">
            {!selectedTrigger && <div className="border-b border-primary/40 pb-2">
              <h4 className="text-sm text-primary font-semibold">{group.name}</h4>

            </div>}
            {group.entries.filter(entry => !(entry.input && !entry.result)).map(entry => renderEffect(entry, "self", false))}
            {group.legacy.map(({ ability, trigger }) => <article key={`${ability.id}:${trigger.id}`} className="border border-border/40 p-3 space-y-2 text-sm"><strong>{trigger.name}</strong><p className="text-xs">{trigger.resource.toUpperCase()} · {trigger.operator.replaceAll("_", " ")} · {trigger.threshold}</p><p className="text-xs text-primary">{isAbilityTriggerActive(trigger, props.vitals) ? "Trigger met" : "Trigger unmet"}</p><p className="whitespace-pre-wrap">{trigger.description}</p><button type="button" className="text-xs text-primary underline" onClick={() => props.onInspect(ability.id)}>{ability.name}</button></article>)}
          </section>)}
          {!triggerGroups.length && <p className="text-xs text-muted-foreground">No abilities have tagged triggers.</p>}
        </div>
      </>}
    </div>
    {tab === "combat" && <footer className="shrink-0 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
      <div className="flex gap-2"><Button size="sm" disabled={!props.combatants.length} onClick={() => { rememberCombatChange(); const next = (props.turn + 1) % props.combatants.length; props.onLifetimeEvent("turn", props.combatants[next]); props.onTurnChange(next); }}>Next Turn</Button><Button size="sm" variant="outline" disabled={undoHistory.at(-1)?.characterId !== props.character.id} onClick={undoCombatChange}>Undo</Button></div>
      <Button size="sm" variant="destructive" disabled={!props.combatants.length} onClick={() => setConfirmClear(true)}>Clear Encounter</Button>
    </footer>}
    <Dialog open={effectSettings !== null} onOpenChange={open => { if (!open) setEffectSettings(null); }}><DialogContent className="sm:max-w-[70rem] max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Settings · Custom Effects</DialogTitle></DialogHeader>{effectSettings && <AbilityOptionsFields skillNames={skills.map(skill => skill.name)} initialCategory="effects" options={effectSettings} onChange={setEffectSettings} onSave={options => props.onOptionsChange(options, () => setEffectSettings(null))}/>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEffectSettings(null)}>Cancel</Button></div></DialogContent></Dialog>
    <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Clear this encounter?</AlertDialogTitle><AlertDialogDescription>This removes all combatants from the initiative tracker and resets the current turn. Use Undo in the Combat tracker to restore it during this session. Your character and abilities will not be deleted.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => { rememberCombatChange(); props.onLifetimeEvent("combat"); props.onCombatantsChange([]); props.onTurnChange(0); setConfirmClear(false); }}>Clear Encounter</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {manualDraft && <ManualEffectDialog key={manualDraft.initial?.id ?? manualDraft.targetId} targetId={manualDraft.targetId} abilities={props.abilities} initial={manualDraft.initial} onClose={() => setManualDraft(null)} onSave={effect => { if (effect.targetId !== "self") rememberCombatChange(); props.onManualEffectsChange(manual.some(entry => entry.id === effect.id) ? manual.map(entry => entry.id === effect.id ? effect : entry) : [...manual, effect]); }}/>}
  </section>;
}
