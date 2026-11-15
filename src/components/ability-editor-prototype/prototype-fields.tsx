import { useState, type ReactNode } from "react";
import {
  AREA_SHAPES, CHECK_ROLL_PURPOSES, DURATION_TYPES, EFFECT_ACTIONS, RANGE_TYPES, RANGED_TARGETING, ROLL_PURPOSES, STACKING_RULES, TARGET_TYPES,
  blankResult, editableTiming, isMovementEffect, rangedAreaSummary, rangedDimensionKeys, resultRollBonusKind, rollBonusKind, selectSummon, timingForEditor,
  type AbilityInput, type AbilityOptions, type RequirementGroup, type TargetResult,
} from "../../lib/ability-input";
import type { Familiar } from "../../lib/storage";
import { hasModifierValue } from "../../lib/ability-bonuses";
import type { TrackedAbilityUsage } from "../../lib/ability-usage";
import { attachedEffects } from "../../lib/effect-details";
import { Button } from "../ui/button";
import { ConditionEditor } from "../dialogs/condition-editor";
import { FormulaField } from "./formula-field";
import { ModifierFields } from "./modifier-fields";
import { PrototypeStatusFields } from "./status-fields";
import { SectionHelp } from "./section-help";

const field = "mt-1 block min-h-9 w-full min-w-0 rounded-md border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary";
const sectionFrame = "rounded-md border border-primary/75 bg-card";
const attributes = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];
const effectKinds = EFFECT_ACTIONS;
type EffectKind = typeof effectKinds[number];
type PreviewEntryKind = EffectKind | "Roll";
const effectActions: Record<EffectKind, string> = {
  Damage: "Deal damage", Healing: "Heal", "Temporary resource": "Grant a temporary resource bonus",
  Shielding: "Grant shielding", Modifier: "Modify a stat or roll", Immunity: "Grant immunity", Status: "Apply status",
  Movement: "Movement", Teleport: "Teleport",
};
const basicTargets = new Set(["Self", "Ally", "Enemy"]);
const makeRollHelp = "Record what to roll without adding damage, healing, or a status. For a contest with success and failure outcomes, use Opposed check in Advanced rules.";

function Section({ id, title, summary, help, highlighted = false, children }: { id: string; title: string; summary: string; help: string; highlighted?: boolean; children: ReactNode }) {
  return <details id={id} className={`group scroll-mt-4 ${highlighted ? sectionFrame : "rounded-md border border-border/50 bg-card"}`}>
    <summary className="cursor-pointer px-4 py-3 marker:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary">
      <span className="ml-1 font-serif text-base font-semibold text-primary">{title}</span>
      <SectionHelp label={title}>{help}</SectionHelp>
      <span className="mt-1 block pl-4 text-xs leading-relaxed text-muted-foreground">{summary}</span>
    </summary>
    <div className="space-y-4 border-t border-border/30 p-4">{children}</div>
  </details>;
}

function Choice({ label, value, choices, onChange, onAdd, blank }: { label: string; value: string; choices: readonly string[]; onChange: (value: string) => void; onAdd?: (value: string) => void; blank?: string }) {
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  return <div className="min-w-0">
    <label className="block text-sm">{label}<select className={field} value={value} onChange={event => event.target.value === "__new__" ? setAdding(true) : onChange(event.target.value)}>
      {blank !== undefined && <option value="">{blank}</option>}
      {[...new Set([...choices, ...(value ? [value] : [])])].map(choice => <option key={choice} value={choice}>{choice}</option>)}
      {onAdd && <option value="__new__">Add custom…</option>}
    </select></label>
    {adding && <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-primary/30 p-2">
      <label className="min-w-0 flex-1 text-xs">Custom {label.toLowerCase()}<input autoFocus className={field} value={custom} onChange={event => setCustom(event.target.value)} /></label>
      <Button type="button" size="sm" disabled={!custom.trim()} onClick={() => { const next = custom.trim(); if (!next) return; if (onAdd) onAdd(next); else onChange(next); setAdding(false); setCustom(""); }}>Use choice</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
    </div>}
  </div>;
}

function Requirements({ label, group, options, onChange, hideLegend, confirmEvents = false }: { label: string; group: RequirementGroup; options: AbilityOptions; onChange: (value: RequirementGroup) => void; hideLegend?: boolean; confirmEvents?: boolean }) {
  return <fieldset className="min-w-0 space-y-3 rounded-md border border-border/40 p-3">
    <legend className={hideLegend ? "sr-only" : "px-1 text-sm font-semibold"}>{label}</legend>
    <ConditionEditor wording="condition" presets={options.triggers} conditions={group.conditions} match={group.match} mode={group.mode} onChange={(conditions, match, mode) => onChange({ conditions, match, mode })} />
    {!!group.conditions.length && <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs">Match<select className={field} value={group.match} onChange={event => onChange({ ...group, match: event.target.value as RequirementGroup["match"] })}><option value="all">All conditions</option><option value="any">Any condition</option></select></label>
      <label className="text-xs">How this is checked<select className={field} value={group.mode} onChange={event => onChange({ ...group, mode: event.target.value as RequirementGroup["mode"] })}><option value="manual">Confirm manually</option><option value="reference">Reference only</option><option value="automatic">Evaluate supported resource conditions</option></select></label>
    </div>}
    {group.conditions.some(condition => condition.kind === "situation") && <p className="text-xs text-muted-foreground">{confirmEvents && group.mode === "manual" ? "Resolve the event at the table, then mark it Met or Not met in the Triggers tracker. Tracked resource conditions are still checked by the Grimoire." : "Combat events are listed as reminders. The Grimoire does not detect them automatically."}</p>}
  </fieldset>;
}

type EditableTiming = Parameters<typeof timingForEditor>[0];
function TimingConditions({ value, duration, options, onChange }: { value: EditableTiming; duration?: string; options: AbilityOptions; onChange: (patch: ReturnType<typeof editableTiming>) => void }) {
  const { activation, ending, retained } = timingForEditor(value, duration);
  const imported = (["activation", "ending", "unassigned"] as const).flatMap(side => retained[side]?.conditions.length ? [{ side, group: retained[side]! }] : []);
  return <div className="space-y-3">
    {(["activation", "ending"] as const).map(side => {
      const group = side === "activation" ? activation : ending;
      const title = side === "activation" ? "Starts when" : "Ends when";
      const confirmEvents = (duration ?? value.durationType) === (side === "activation" ? "When Triggered" : "Until Triggered");
      return <details key={side} open={group.conditions.length > 0 || undefined}>
        <summary className="cursor-pointer text-sm">{title}{group.conditions.length ? ` · ${group.conditions.length}` : ""}<SectionHelp label={title}>{side === "activation" ? "Set what starts this ability or effect. For When Triggered duration, mark manual combat events in the Triggers tracker after resolving them at the table." : "Set what ends this ability or effect. For Until Triggered duration, mark manual combat events in the Triggers tracker after resolving them at the table."}</SectionHelp></summary>
        <div className="mt-2"><Requirements hideLegend label={title} group={group} options={options} confirmEvents={confirmEvents} onChange={next => onChange(editableTiming(side === "activation" ? next : activation, side === "ending" ? next : ending, retained))} /></div>
      </details>;
    })}
    {!!imported.length && <details className="rounded-md border border-border/40 p-3">
      <summary className="cursor-pointer text-sm">Retained legacy conditions</summary>
      <p className="my-2 text-xs text-muted-foreground">These older conditions weren’t active. They stay in the draft until you choose where to use them. Using one replaces the selected condition group.</p>
      {imported.map(({ side, group }) => <div key={side} className="space-y-2">
        <Requirements label={side === "activation" ? "Previous start conditions" : side === "ending" ? "Previous end conditions" : "Previous duration trigger"} group={group} options={options} onChange={next => onChange(editableTiming(activation, ending, { ...retained, [side]: next }))} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(editableTiming(group, ending, { ...retained, [side]: activation.conditions.length ? activation : undefined }))}>Use to start</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange(editableTiming(activation, group, { ...retained, [side]: ending.conditions.length ? ending : undefined }))}>Use to end</Button>
        </div>
      </div>)}
    </details>}
  </div>;
}

function ResultFields({ result, input, options, ownerLabel, skillNames, kind, onChange, onRemove }: {
  result: TargetResult; input: AbilityInput; options: AbilityOptions; ownerLabel: string; skillNames: string[];
  kind?: PreviewEntryKind;
  onChange: (patch: Partial<TargetResult>, options?: AbilityOptions) => void; onRemove: () => void;
}) {
  const bonusCount = Object.values(result.bonuses ?? {}).filter(value => !Array.isArray(value) && hasModifierValue(value)).length;
  const statusCount = attachedEffects(result).length;
  const modifierKind = kind === "Modifier" || kind === "Immunity" || kind === "Temporary resource" ? kind : undefined;
  const hasBonuses = bonusCount > 0 || !!result.bonuses?.checkSkills?.length || !!result.bonuses?.resistanceAttributes?.length;
  const hasStatus = statusCount > 0 || !!(result.enemySavingThrow || result.saveFormula);
  const isRoll = kind === "Roll" || result.rollOnly;
  const [showFormula, setShowFormula] = useState(() => !!result.formula || !!result.purpose || isRoll);
  const [hadBonuses] = useState(hasBonuses);
  const [hasRulesText] = useState(() => !!result.rules);
  const sharedTiming = bonusCount + statusCount + Number(showFormula) > 1;
  const durationType = result.durationType || input.durationType;
  const outcome = rollBonusKind(result.purpose) ? "" : result.purpose;
  if (kind !== "Roll" && isMovementEffect(kind)) return <article className="min-w-0 space-y-3 rounded-md border border-border/40 bg-background/30 p-3">
    <h4 className="font-serif text-sm font-semibold text-primary">{kind}<SectionHelp label={kind}>{kind === "Movement" ? "Record the move, including distance, direction, or restrictions. Use a Movement (ft) modifier for a change to the target’s speed." : "Record the teleport’s distance, allowed destination, and restrictions. These rules are for reference at the table."}</SectionHelp></h4>
    <label className="block text-sm">{kind} rules<textarea className={field} rows={3} value={result.rules} onChange={event => onChange({ rules: event.target.value })} placeholder={kind === "Movement" ? "e.g. Move up to your speed without provoking reactions." : "e.g. Teleport up to 30 ft to a space you can see."} /></label>
    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>Remove effect</Button>
  </article>;
  return <article className="min-w-0 space-y-3 rounded-md border border-border/40 bg-background/30 p-3">
    {result.name && <h4 className="break-words font-serif text-sm text-primary">{result.name}<SectionHelp label={result.name}>This is the label for the effect or roll below. It can contain several changes if they were saved together.</SectionHelp></h4>}
    {showFormula && <div className="space-y-2">
      <FormulaField label={outcome ? `${outcome} formula` : "Roll formula"} value={result.formula} onChange={formula => onChange({ formula })} ownerLabel={ownerLabel} linkedStats={input.linkedStats} required={isRoll} />
      <details open={resultRollBonusKind(result) ? true : undefined}>
        <summary className="cursor-pointer text-xs text-muted-foreground">Roll bonuses<SectionHelp label="Roll bonuses">Choose which existing roll bonuses apply. Damage, healing, or shielding describes the result, not whether the roll is an attack, check, or resistance roll.</SectionHelp></summary>
        <div className="mt-2"><Choice label="Apply roll bonuses for" value={CHECK_ROLL_PURPOSES.find(value => rollBonusKind(value) === resultRollBonusKind(result)) ?? ""} blank="None" choices={CHECK_ROLL_PURPOSES} onChange={value => onChange({ rollBonusKind: rollBonusKind(value) ?? "none" })} /></div>
      </details>
    </div>}
    {(hasBonuses || hadBonuses || modifierKind) && <ModifierFields bonuses={result.bonuses ?? {}} newEffect={modifierKind} skillNames={skillNames} onChange={bonuses => onChange({ bonuses })} />}
    {(hasStatus || kind === "Status") && <PrototypeStatusFields result={result} options={options} newEffect={kind === "Status"} onChange={onChange} />}
    {hasRulesText && <details><summary className="cursor-pointer text-xs text-muted-foreground">Rules text<SectionHelp label="Effect rules text">Notes and exceptions for just this effect. Use the ability's main Rules text section for instructions that apply to the whole ability.</SectionHelp></summary><label className="mt-2 block text-xs">Effect rules<textarea className={field} rows={3} value={result.rules} onChange={event => onChange({ rules: event.target.value })} /></label></details>}
    <details>
      <summary className="cursor-pointer text-xs text-muted-foreground">{sharedTiming ? "Shared timing & settings" : "Timing & settings"}{result.durationType ? ` · ${result.durationType}` : ""}<SectionHelp label={sharedTiming ? "Shared timing & settings" : "Timing & settings"}>{sharedTiming ? "These imported effects use the same duration and stacking rules. Changing this section changes those settings for all of them." : "Set when this entry starts or ends, how long it lasts, and whether repeated applications stack. Leave duration blank to use the ability's duration."}</SectionHelp></summary>
      <div className="mt-3 space-y-3">
        {sharedTiming && <p className="text-xs text-muted-foreground">These imported effects share the timing and stacking settings below.</p>}
        <label className="block text-xs">{isRoll ? "Roll name (optional)" : "Effect label (optional)"}<input className={field} value={result.name} onChange={event => onChange({ name: event.target.value })} /></label>
        {!showFormula && !kind && <Button type="button" size="sm" variant="outline" onClick={() => setShowFormula(true)}>Edit roll formula</Button>}
        <div className="grid gap-3 sm:grid-cols-2"><Choice label="Stacking rule" blank="Source-specific default" value={result.stacking ?? ""} choices={STACKING_RULES} onChange={stacking => onChange({ stacking: stacking as TargetResult["stacking"] || undefined })} />{result.stacking === "Stack" && <label className="text-sm">Maximum stacks<input className={field} type="number" min="1" step="1" value={result.maxStacks ?? ""} onChange={event => onChange({ maxStacks: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>}</div>
        <div className="grid gap-3 sm:grid-cols-2"><Choice label="Duration" blank="Use ability duration" value={result.durationType} choices={[...DURATION_TYPES, ...options.durationTypes]} onChange={nextDuration => {
          const timing = timingForEditor(result, durationType);
          onChange({ ...editableTiming(timing.activation, timing.ending, timing.retained), durationType: nextDuration });
        }} /><label className="text-sm">Duration details<input className={field} value={result.duration} onChange={event => onChange({ duration: event.target.value })} /></label></div>
        <label className="block text-sm">Lifetime<select className={field} value={result.lifetime} onChange={event => onChange({ lifetime: event.target.value as TargetResult["lifetime"] })}><option value="source">Shares the source activation</option><option value="independent">Tracked independently</option></select></label>
        <TimingConditions value={result} duration={durationType} options={options} onChange={onChange} />
        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>{sharedTiming ? "Remove these effects" : isRoll ? "Remove roll" : "Remove effect"}</Button>
      </div>
    </details>
  </article>;
}

interface Props {
  input: AbilityInput;
  options: AbilityOptions;
  sources: string[];
  familiars: Familiar[];
  skillNames?: string[];
  ownerLabel: string;
  nameLabel?: string;
  fixedSource?: boolean;
  allowSummon?: boolean;
  extraSettings?: ReactNode;
  openExtraSettings?: boolean;
  trackedUsage?: TrackedAbilityUsage & { canConsumeItem: boolean; onChange: (value: TrackedAbilityUsage) => void };
  onChange: (input: AbilityInput) => void;
}

/** Shared fields; the owning editor validates and saves the draft. */
export function PrototypeAbilityFields({ input, options, sources, familiars, skillNames = [], ownerLabel, nameLabel = "Ability name", fixedSource, allowSummon = true, extraSettings, openExtraSettings, trackedUsage, onChange }: Props) {
  const [customTarget, setCustomTarget] = useState("");
  const [addingTarget, setAddingTarget] = useState(false);
  const [adding, setAdding] = useState<"effect" | "roll" | null>(null);
  const [effectTarget, setEffectTarget] = useState("");
  const targetChoices = [...new Set([...TARGET_TYPES, ...options.targets, ...input.targets])].filter(target => target !== "Summon" || allowSummon || input.targets.includes(target));
  const targets = [...new Set(input.targets)];
  const otherTargets = targetChoices.filter(target => !basicTargets.has(target));
  const update = (patch: Partial<AbilityInput>) => onChange({ ...input, ...patch });
  const customChoice = (key: "rangeTypes" | "rangedTargeting" | "areaShapes", value: string) => {
    const inputKey = { rangeTypes: "rangeType", rangedTargeting: "rangedTargeting", areaShapes: "areaShape" }[key];
    update({ [inputKey]: value, options: { ...options, [key]: [...new Set([...(options[key] ?? []), value])] } });
  };
  const chooseTarget = (target: string, selected: boolean) => update({
    targets: selected ? [...new Set([...input.targets, target])] : input.targets.filter(value => value !== target),
  });
  const addEntry = (target: string, kind: PreviewEntryKind) => {
    const result = blankResult(target);
    if (ROLL_PURPOSES.includes(kind)) result.purpose = kind;
    if (kind === "Roll") result.rollOnly = true;
    else result.effectAction = kind;
    update({ results: [...input.results, result] });
  };
  const appliesTo = targets.includes(effectTarget) ? effectTarget : targets[0];
  const activeEntries = input.results.filter(result => targets.includes(result.target));
  const isStandaloneRoll = (result: TargetResult) => result.rollOnly || (!result.effectAction && !!rollBonusKind(result.purpose) && !result.rules && !attachedEffects(result).length && !Object.values(result.bonuses ?? {}).some(value => Array.isArray(value) ? value.length : hasModifierValue(value)));
  const effects = activeEntries.filter(result => !isStandaloneRoll(result));
  const rolls = activeEntries.filter(isStandaloneRoll);
  const renderEntry = (result: TargetResult) => <ResultFields key={result.id} input={input} result={result} kind={isStandaloneRoll(result) ? "Roll" : result.effectAction} options={options} ownerLabel={ownerLabel} skillNames={skillNames} onChange={(patch, nextOptions) => update({ results: input.results.map(value => value.id === result.id ? { ...value, ...patch } : value), ...(nextOptions ? { options: nextOptions } : {}) })} onRemove={() => update({ results: input.results.filter(value => value.id !== result.id) })} />;
  const inactiveResultCount = input.results.filter(result => !targets.includes(result.target)).length;
  const showRange = targets.some(target => target !== "Self") || input.rangeType !== "Self" || !!input.range;
  const needsDistance = ["Aura", "Ranged"].includes(input.rangeType);
  const customRange = !RANGE_TYPES.includes(input.rangeType);
  const retainedRangeNote = needsDistance && input.range.trim() && !Number.isFinite(Number(input.range)) ? input.range : "";
  const rangeControls = <div className="grid gap-3 sm:grid-cols-2">
    <Choice label="Range" value={input.rangeType} choices={[...RANGE_TYPES, ...options.rangeTypes]} onChange={rangeType => update({ rangeType })} onAdd={value => customChoice("rangeTypes", value)} />
    {(needsDistance || customRange) && <label className="text-sm">{needsDistance ? "Range (ft)" : "Range details"}<input className={field} value={input.range} type={needsDistance ? "number" : "text"} min="0" step="any" onChange={event => update({ range: event.target.value })} /></label>}
    {retainedRangeNote && <p className="break-words text-xs text-muted-foreground sm:col-span-2">Saved range: {retainedRangeNote}. Enter a distance above only if changing it.</p>}
  </div>;
  const targetChip = (target: string) => <label key={target} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs ${targets.includes(target) ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40"}`}><input type="checkbox" checked={targets.includes(target)} onChange={event => chooseTarget(target, event.target.checked)} />{target}</label>;
  const activationType = input.durationType === "Always On" ? "Passive" : input.reaction ? "Reaction" : "Action";
  const timing = timingForEditor(input);
  const durationChoices = [...DURATION_TYPES, ...options.durationTypes].filter(value => value !== "Always On");
  const changeDuration = (durationType: string, patch?: Partial<AbilityInput>) => {
    if (durationType === input.durationType) { if (patch) update(patch); return; }
    // An inherited duration must not move an older effect's start trigger to its end (or vice versa).
    const results = input.results.map(result => {
      if (result.durationType || !result.durationTrigger) return result;
      const saved = timingForEditor(result, input.durationType);
      return { ...result, ...editableTiming(saved.activation, saved.ending, saved.retained) };
    });
    update({ ...editableTiming(timing.activation, timing.ending, timing.retained), durationType, results, ...patch });
  };
  const activationSummary = [input.durationType, input.duration, activationType === "Action" && input.timeCost !== undefined ? `${input.timeCost} s` : "", input.manaPerTurn !== undefined ? `${input.manaPerTurn} MP / turn` : ""].filter(Boolean).join(" · ");
  const limitsSummary = [input.cooldown !== undefined ? `${input.cooldown} ${input.cooldownUnit.toLowerCase()} cooldown` : "", input.uses, input.recharge].filter(Boolean).join(" · ");
  return <div className="min-w-0 space-y-4" data-prototype-ability-fields>
    <section aria-label="Ability" className={`${sectionFrame} space-y-3 p-4`}>
      <h2 className="font-serif text-base font-semibold text-primary">Ability<SectionHelp label="Ability">Identifies the ability: its name, Essence or source, and linked attributes. Recorded rank requirements and upgrades appear here when present.</SectionHelp></h2>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="block text-sm">{nameLabel}<input className={field} value={input.name} onChange={event => update({ name: event.target.value })} /></label>
        {fixedSource ? <p className="self-end text-sm">Source: {input.source || ownerLabel}</p> : <Choice label="Source" blank="Unassigned" value={input.source} choices={["Innate", ...sources]} onChange={source => update({ source })} />}
      </div>
      {input.unlockRank && <p className="text-xs text-muted-foreground">Unlock rank: {input.unlockRank}</p>}
      {!!input.upgrades.length && <p className="text-xs text-muted-foreground">{input.upgrades.length} existing rank upgrade(s) retained.</p>}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">Linked attributes{input.linkedStats.length > 0 && ` · ${input.linkedStats.map(stat => stat.slice(0, 3).toUpperCase()).join(", ")}`}<SectionHelp label="Linked attributes">Records the attributes this ability uses, such as POW or WIL. A formula still needs to name the attribute it rolls or adds.</SectionHelp></summary>
        <fieldset className="mt-2"><legend className="sr-only">Linked attributes</legend><div className="flex flex-wrap gap-2">{attributes.map(stat => <label key={stat} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs capitalize ${input.linkedStats.includes(stat) ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40"}`}><input type="checkbox" checked={input.linkedStats.includes(stat)} onChange={event => update({ linkedStats: event.target.checked ? [...input.linkedStats, stat] : input.linkedStats.filter(value => value !== stat) })} />{stat}</label>)}</div></fieldset>
      </details>
    </section>
    <section aria-label="Activation" className={`${sectionFrame} space-y-3 p-4`}>
      <h2 className="font-serif text-base font-semibold text-primary">Activation<SectionHelp label="Activation">Set how you use the ability: action, reaction, or passive. This is also where you set MP cost, time cost, upkeep, cooldown, and the default duration.</SectionHelp></h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice label="Activation type" value={activationType} choices={["Action", "Reaction", "Passive"]} onChange={type => changeDuration(type === "Passive" ? "Always On" : input.durationType === "Always On" ? "Instant" : input.durationType, { reaction: type === "Reaction" })} />
        {(activationType !== "Passive" || !!input.manaCost) && <label className="block text-sm">{activationType === "Passive" ? "MP cost when used" : "MP cost"}<input className={field} type="number" min="0" step="any" value={input.manaCost ?? ""} onChange={event => update({ manaCost: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>}
      </div>
      {trackedUsage && <div className="space-y-2 rounded-md border border-border/40 p-3">
        <h3 className="text-sm font-medium">Tracked use<SectionHelp label="Tracked use">Choose whether activation spends a charge or consumes one item. Rechargeable abilities refill on a long rest. Cooldown and recharge notes below are tabletop reference.</SectionHelp></h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Use type<select className={field} value={trackedUsage.mode} onChange={event => trackedUsage.onChange({ mode: event.target.value as TrackedAbilityUsage["mode"], maximum: trackedUsage.maximum })}>
            <option value="standard">No item or charge cost</option>
            {(trackedUsage.canConsumeItem || trackedUsage.mode === "one-time") && <option value="one-time">Consume one item</option>}
            <option value="rechargeable">Spend one charge</option>
          </select></label>
          {trackedUsage.mode === "rechargeable" && <label className="text-sm">Maximum charges<input className={field} type="number" min="1" step="1" value={trackedUsage.maximum} onChange={event => trackedUsage.onChange({ mode: trackedUsage.mode, maximum: event.target.value })} /></label>}
        </div>
      </div>}
      <Section id="prototype-activation" title={activationType === "Passive" ? "Passive conditions" : "Duration & conditions"} summary={activationType === "Passive" ? "Always on unless a condition limits it" : activationSummary || "Time cost, duration, and upkeep"} help="Set when this ability starts or ends. Actions and reactions can also have a duration and upkeep. Individual effects may use their own timing.">
        {activationType !== "Passive" && <>
          <div className="grid gap-3 sm:grid-cols-2"><Choice label="Ability duration" value={input.durationType} choices={durationChoices} onChange={value => changeDuration(value)} onAdd={value => {
            if (value.toLowerCase() === "always on") return;
            changeDuration(value, { options: { ...options, durationTypes: [...new Set([...options.durationTypes, value])] } });
          }} /><label className="text-sm">Duration details<input className={field} value={input.duration} onChange={event => update({ duration: event.target.value })} /></label></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {activationType === "Action" && <label className="text-sm">Time cost (seconds)<input className={field} type="number" min="0" step="any" value={input.timeCost ?? ""} onChange={event => update({ timeCost: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>}
            <label className="block text-sm">Upkeep (MP per turn)<input className={field} type="number" min="0" step="any" value={input.manaPerTurn ?? ""} onChange={event => update({ manaPerTurn: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>
          </div>
        </>}
        {activationType === "Passive" && (input.duration || !!input.manaPerTurn || !!input.timeCost) && <details className="rounded-md border border-border/40 p-3">
          <summary className="cursor-pointer text-sm">Existing activation details</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {input.duration && <label className="text-sm">Duration details<input className={field} value={input.duration} onChange={event => update({ duration: event.target.value })} /></label>}
            {!!input.timeCost && <label className="text-sm">Time cost (seconds)<input className={field} type="number" min="0" step="any" value={input.timeCost} onChange={event => update({ timeCost: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>}
            {!!input.manaPerTurn && <label className="text-sm">Upkeep (MP per turn)<input className={field} type="number" min="0" step="any" value={input.manaPerTurn} onChange={event => update({ manaPerTurn: event.target.value === "" ? undefined : Number(event.target.value) })} /></label>}
          </div>
        </details>}
        <TimingConditions value={input} options={options} onChange={update} />
      </Section>
      <Section id="prototype-limits" title="Use limits · reference" summary={limitsSummary || "Optional · not enforced"} help="Record cooldown, use limits, and recharge for the table. These fields don’t enforce cooldowns or update tracked equipment charges.">
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Cooldown<input className={field} type="number" min="0" step="any" value={input.cooldown ?? ""} onChange={event => update({ cooldown: event.target.value === "" ? undefined : Number(event.target.value) })} /></label><Choice label="Cooldown unit" value={input.cooldownUnit} choices={["Seconds", "Minutes", "Hours", "Days"]} onChange={value => update({ cooldownUnit: value as AbilityInput["cooldownUnit"] })} /><label className="text-sm">Cooldown starts<select className={field} value={input.cooldownStarts} onChange={event => update({ cooldownStarts: event.target.value as AbilityInput["cooldownStarts"] })}><option value="activation">On activation</option><option value="end">When ability ends</option></select></label></div>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Use limit notes<input className={field} value={input.uses} onChange={event => update({ uses: event.target.value })} /></label><label className="text-sm">Recharge notes<input className={field} value={input.recharge} onChange={event => update({ recharge: event.target.value })} /></label></div>
      </Section>
    </section>
    <section aria-label="Targeting" className={`${sectionFrame} space-y-3 p-4`}>
      <h2 className="font-serif text-base font-semibold text-primary">Targeting<SectionHelp label="Targeting">Sets who or what the ability can reach, how far it reaches, and whether it covers an area or hits multiple targets.</SectionHelp></h2>
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-sm">Targets<SectionHelp label="Targets">Choose the kinds of targets the ability can affect. If you pick more than one, Add effect lets you pick which one receives each effect.</SectionHelp></legend>
        <div className="flex flex-wrap gap-2">{targetChoices.filter(target => basicTargets.has(target)).map(targetChip)}</div>
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">Other targets{targets.some(target => !basicTargets.has(target)) ? ` · ${targets.filter(target => !basicTargets.has(target)).join(", ")}` : ""}<SectionHelp label="Other targets">Find targets beyond Self, Ally, and Enemy, such as objects, locations, or a summon. You can also name a custom target.</SectionHelp></summary>
          <div className="mt-2 flex flex-wrap gap-2">{otherTargets.map(targetChip)}<Button type="button" size="sm" variant="outline" onClick={() => setAddingTarget(true)}>+ Custom target</Button></div>
          {addingTarget && <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-primary/30 p-3">
            <label className="min-w-0 flex-1 text-xs">Custom target<input autoFocus className={field} value={customTarget} onChange={event => setCustomTarget(event.target.value)} /></label>
            <Button type="button" size="sm" disabled={!customTarget.trim() || (!allowSummon && customTarget.trim() === "Summon")} onClick={() => { const target = customTarget.trim(); update({ options: { ...options, targets: [...new Set([...options.targets, target])] }, targets: [...new Set([...input.targets, target])] }); setCustomTarget(""); setAddingTarget(false); }}>Use target</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAddingTarget(false)}>Cancel</Button>
          </div>}
        </details>
      </fieldset>
      {showRange && rangeControls}
      {input.targets.includes("Summon") && <div className="space-y-3 rounded-md border border-primary/30 p-3"><label className="block text-sm">Summoned familiar<select className={field} value={input.summon ? String(input.summon.familiar.id) : ""} onChange={event => onChange(selectSummon(input, familiars.find(familiar => String(familiar.id) === event.target.value)))}><option value="">Choose familiar</option>{familiars.map(familiar => <option key={familiar.id} value={String(familiar.id)}>{familiar.name}</option>)}{input.summon && !familiars.some(familiar => familiar.id === input.summon!.familiar.id) && <option value={String(input.summon.familiar.id)}>{input.summon.familiar.name} · Saved snapshot</option>}</select></label>{input.summon && <><p className="text-xs text-muted-foreground">{input.summon.abilities.length} copied abilities. The original familiar is unchanged.</p>{familiars.some(familiar => familiar.id === input.summon!.familiar.id) && <Button type="button" size="sm" variant="outline" onClick={() => onChange(selectSummon(input, familiars.find(familiar => familiar.id === input.summon!.familiar.id)))}>Re-import familiar abilities</Button>}</>}</div>}
      {!showRange && <Section id="prototype-range" title="Set range" summary={input.rangeType} help="Choose the ability's reach, such as Self, Touch, Ranged, or Aura. Ranged and Aura also ask for a distance in feet.">{rangeControls}</Section>}
      {!needsDistance && !customRange && <Section id="prototype-range-notes" title="Add range notes" summary={input.range || "Optional"} help="Record a reach rule that isn't captured by the range type, such as needing line of sight. These are notes, not a distance check."><label className="block text-sm">Range details<input className={field} value={input.range} onChange={event => update({ range: event.target.value })} /></label></Section>}
      {input.rangeType === "Ranged" && <Section id="prototype-area" title="Set area & target count" summary={rangedAreaSummary(input) || "Optional targeting pattern and shape"} help="Choose how a ranged ability reaches its targets: a single target, several targets, a chain, or an area such as a cone. The chosen pattern determines which dimensions or counts you can enter.">
        <div className="grid gap-3 sm:grid-cols-2"><Choice label="Targeting pattern" blank="Choose pattern" value={input.rangedTargeting ?? ""} choices={[...RANGED_TARGETING, ...(options.rangedTargeting ?? [])]} onChange={rangedTargeting => update({ rangedTargeting })} onAdd={value => customChoice("rangedTargeting", value)} />{["Target-Centered AoE", "Point-Placed AoE"].includes(input.rangedTargeting ?? "") && <Choice label="Area shape" blank="Choose shape" value={input.areaShape ?? ""} choices={[...AREA_SHAPES, ...(options.areaShapes ?? [])]} onChange={areaShape => update({ areaShape })} onAdd={value => customChoice("areaShapes", value)} />}</div>
        <div className="grid gap-3 sm:grid-cols-2">{rangedDimensionKeys(input).map(key => <label key={key} className="text-sm capitalize">{key === "targetCount" ? "Target count" : key === "innerRadius" ? "Inner radius (ft)" : key === "jumpRange" ? "Jump range (ft)" : key === "radius" && input.areaShape === "Ring / Hollow Area" ? "Outer radius (ft)" : `${key} (ft)`}<input className={field} type="number" min={key === "targetCount" ? 1 : 0} step={key === "targetCount" ? 1 : "any"} value={input.areaDimensions?.[key] ?? ""} onChange={event => update({ areaDimensions: { ...input.areaDimensions, [key]: event.target.value } })} /></label>)}</div>
        {!!input.rangedTargeting && !["Single Target", "Multiple Targets", "Chain / Bounce"].includes(input.rangedTargeting) && <div className="flex flex-wrap gap-3">{(["persistent", "movable", "followsTarget"] as const).map(key => <label key={key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={input.areaBehavior?.[key] ?? false} onChange={event => update({ areaBehavior: { ...input.areaBehavior, [key]: event.target.checked } })} />{key === "followsTarget" ? "Follows target" : key === "movable" ? "Movable" : "Persistent"}</label>)}</div>}
      </Section>}
    </section>

    <section aria-label="Effects" id="prototype-results" className={`${sectionFrame} min-w-0 space-y-3 p-4`}>
      <h2 className="font-serif text-base font-semibold text-primary">Effects<SectionHelp label="Effects">Record what the ability does, such as damage, healing, modifiers, statuses, movement, or teleportation.</SectionHelp></h2>
      {!targets.length && <p className="text-sm text-muted-foreground">Select a target to add an effect or roll.</p>}
      {targets.filter(target => effects.some(result => result.target === target)).map(target => <section key={target} aria-label={`${target} effects`} className="min-w-0 space-y-2">
        <h3 className="break-words text-sm font-semibold text-foreground">{target}<SectionHelp label={`${target} effects`}>The effects listed here apply to this target. Add effect lets you add another change to this target or to a different selected target.</SectionHelp></h3>
        {effects.filter(result => result.target === target).map(renderEntry)}
      </section>)}
      {adding === "effect" && appliesTo ? <div className="flex flex-wrap items-end gap-2 rounded-md border border-primary/30 p-3">
        {targets.length > 1 && <label className="min-w-0 flex-1 basis-28 text-sm">Apply to<select className={field} value={appliesTo} onChange={event => setEffectTarget(event.target.value)}>{targets.map(target => <option key={target}>{target}</option>)}</select></label>}
        <label className="min-w-0 flex-1 basis-48 text-sm">Effect type<select autoFocus className={field} value="" onChange={event => {
          const kind = event.target.value as EffectKind;
          if (effectKinds.includes(kind)) { addEntry(appliesTo, kind); setAdding(null); }
        }}>
          <option value="">Choose effect…</option>{effectKinds.map(kind => <option key={kind} value={kind}>{effectActions[kind]}</option>)}
        </select></label>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
      </div> : adding === "roll" && appliesTo ? <div className="flex flex-wrap items-end gap-2 rounded-md border border-primary/30 p-3">
        <div className="min-w-0 flex-1"><Choice label="Roll for" blank="Choose target" value="" choices={targets} onChange={target => { if (target) { addEntry(target, "Roll"); setAdding(null); } }} /></div>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
      </div> : <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1"><Button type="button" size="sm" variant="outline" disabled={!appliesTo} onClick={() => setAdding("effect")}>+ Add effect</Button><SectionHelp label="Add effect">Choose what to add, such as damage, a modifier, immunity, or a status. If there are several targets, choose which receives it.</SectionHelp></div>
        <div className="flex items-center gap-1"><Button type="button" size="sm" variant="outline" disabled={!appliesTo} onClick={() => { if (targets.length === 1) addEntry(targets[0], "Roll"); else setAdding("roll"); }}>Make a roll</Button><SectionHelp label="Make a roll">{makeRollHelp}</SectionHelp></div>
      </div>}
      {!!rolls.length && <section aria-label="Standalone rolls" className="min-w-0 space-y-2 border-t border-border/30 pt-3">
        <h3 className="text-sm font-semibold text-foreground">Standalone rolls<SectionHelp label="Standalone rolls">{makeRollHelp}</SectionHelp></h3>
        {rolls.map(result => <div key={result.id} className="space-y-1">{targets.length > 1 && <p className="text-xs text-muted-foreground">For {result.target}</p>}{renderEntry(result)}</div>)}
      </section>}
      {!!inactiveResultCount && <p className="text-xs text-muted-foreground">{inactiveResultCount} effect(s) or roll(s) retained for deselected targets.</p>}
    </section>

    <Section id="prototype-rules" title="Rules text" highlighted summary={input.description ? "Recorded" : "Optional"} help="Write rules players or the GM need at the table, including special cases the tool doesn't enforce. For example, say whether a stronger bonus replaces a smaller one or adds to it.">
      <label className="block text-sm">Ability rules<textarea rows={5} className={field} value={input.description} onChange={event => update({ description: event.target.value })} /></label>
    </Section>

    <details open={openExtraSettings || undefined} className={sectionFrame}>
      <summary className="cursor-pointer px-4 py-3 font-serif font-semibold text-primary">More settings<SectionHelp label="More settings">Optional mechanics such as separate actions, choose-one modes, opposed checks with outcomes, marks, or follow-up triggers.</SectionHelp></summary>
      <div className="min-w-0 space-y-3 border-t border-border/30 p-3">
        {extraSettings}
      </div>
    </details>
  </div>;
}
