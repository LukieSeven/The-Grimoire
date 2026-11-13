import { useState } from "react";
import { Button } from "../ui/button";
import { blankAbilityInput, duplicateInput, inputFromAbility, mergeOptions, validateAbilityInput, validateAbilityRolls, type AbilityInput } from "../../lib/ability-input";
import type { Ability, Familiar } from "../../lib/storage";
import { PrototypeAbilityFields } from "./prototype-fields";
import { PrototypePreviewCard } from "./preview-card";
import { previewNodes, removePreviewNode, replacePreviewNode } from "./preview-model";
import { readPreviewSnapshot, type PreviewSnapshot } from "./preview-snapshot";
import { abilityMechanicsPresets, MechanicsFields, type RuleRecord } from "./mechanics-fields";
import { SectionHelp } from "./section-help";

export type AbilityEditorOwner =
  | { kind: "character"; name: string }
  | { kind: "item"; name: string; wielderName?: string; equipment?: boolean }
  | { kind: "familiar"; name: string; familiarId?: Familiar["id"] };

export interface PrototypeDraftProps {
  characterId: number;
  owner: AbilityEditorOwner;
  initial: Ability | null;
  reference?: RuleRecord;
  initialDefinition?: AbilityInput;
  onKeep?: (reference: RuleRecord, definition: AbilityInput) => void;
  live?: { save: (definition: AbilityInput) => void; pending?: boolean; snapshot: PreviewSnapshot; source?: string; allowSummon?: boolean };
  onClose: () => void;
}

/** Each area mounts an independent editor. Only a live owner supplies a persistence callback. */
export default function PrototypeAbilityDraft({ characterId, owner, initial, reference, initialDefinition, onKeep, live, onClose }: PrototypeDraftProps) {
  const [previewSnapshot] = useState(() => live ? undefined : readPreviewSnapshot(characterId));
  const snapshot = live?.snapshot ?? previewSnapshot!;
  const [originalReferenceRules] = useState<RuleRecord>(() => Object.fromEntries(Object.entries(structuredClone(reference ?? {})).filter(([key]) => key !== "name" && key !== "description")));
  const [referenceRules, setReferenceRules] = useState(originalReferenceRules);
  const [original] = useState(() => {
    const source = live?.source ?? (owner.kind === "character"
      ? initial?.isInnatePassive ? "Innate" : snapshot.essences.find(essence => essence.id === initial?.essenceId)?.name ?? ""
      : owner.kind === "item" ? (owner.equipment ? "Equipment" : "Item") : owner.name);
    const input = initialDefinition ? structuredClone(initialDefinition) : initial ? inputFromAbility(structuredClone(initial), source) : blankAbilityInput();
    if (typeof reference?.name === "string") input.name = reference.name;
    if (typeof reference?.description === "string") input.description = reference.description;
    if (owner.kind !== "character") input.source = source;
    const inherited = onKeep ? [] : [snapshot.character?.abilityOptions, ...snapshot.abilities.map(ability => ability.definition?.options), ...(snapshot.character?.familiars ?? []).flatMap(familiar => familiar.abilities.map(ability => ability.definition?.options))];
    input.options = mergeOptions(...previewNodes(input).map(entry => entry.input.options), ...inherited);
    return input;
  });
  const [draft, setDraft] = useState(original);
  const [selected, setSelected] = useState(original.id);
  const [resetCount, setResetCount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string }>();
  const nodes = previewNodes(draft);
  const active = nodes.find(entry => entry.input.id === selected) ?? nodes[0];
  const summoned = active.familiar && (snapshot.character?.familiars?.find(familiar => familiar.id === active.familiar!.id) ?? active.familiar);
  const creatureOwned = owner.kind === "familiar" || !!summoned;
  const actor = summoned?.name ?? (owner.kind === "item" ? owner.wielderName ?? snapshot.character?.name ?? "the character using the item" : owner.name);
  const ownerType = owner.kind === "item" && owner.equipment ? "equipment" : owner.kind;
  const ownerLabel = summoned ? `Summoned familiar · ${summoned.name}` : `${{ character: "Character", item: "Item", equipment: "Equipment", familiar: "Familiar" }[ownerType]} · ${owner.name}`;
  const current = { ...active.input, source: summoned?.name ?? active.input.source, options: draft.options };
  const usesReferenceRules = !!reference && current.id === draft.id;
  const mechanics = usesReferenceRules ? referenceRules : current.advancedRules ?? {};
  const initialRules = usesReferenceRules ? originalReferenceRules : previewNodes(original).find(entry => entry.input.id === current.id)?.input.advancedRules ?? {};
  const pending = !!live?.pending;

  const changeNode = (next: AbilityInput) => {
    setDraft(previous => ({ ...replacePreviewNode(previous, next), options: next.options }));
    setMessage(undefined);
  };
  const addAction = () => {
    const action = { ...blankAbilityInput(), source: current.source };
    changeNode({ ...current, subAbilities: [...current.subAbilities, action] });
    setSelected(action.id);
  };
  const duplicate = () => {
    const copy = duplicateInput(current);
    const parent = nodes.find(entry => entry.input.subAbilities.some(child => child.id === current.id))?.input;
    const summoner = nodes.find(entry => entry.input.summon?.abilities.some(child => child.id === current.id))?.input;
    if (parent) changeNode({ ...parent, subAbilities: [...parent.subAbilities, copy], options: draft.options });
    else if (summoner?.summon) changeNode({ ...summoner, summon: { ...summoner.summon, abilities: [...summoner.summon.abilities, copy] }, options: draft.options });
    else if (!live) { setDraft(copy); setMessage(undefined); }
    else return; // A saved root keeps the ID used by favorites and active applications.
    setSelected(copy.id);
  };
  const reset = () => {
    setDraft(original);
    setReferenceRules(originalReferenceRules);
    setSelected(original.id);
    setResetCount(count => count + 1);
    setMessage(undefined);
  };
  const checkDraft = (keep: boolean) => {
    const error = validateAbilityInput(draft) ?? validateAbilityRolls(draft, live ? original : undefined);
    if (error) { setMessage({ error: true, text: error }); return; }
    if (keep && live) { live.save(structuredClone(draft)); return; }
    if (keep && onKeep) {
      const record = { ...referenceRules, name: draft.name, ...(draft.description || reference?.description !== undefined ? { description: draft.description } : {}) };
      onKeep(structuredClone(record), structuredClone(draft));
      return;
    }
    setMessage({ error: false, text: Object.keys(mechanics).length ? "Standard fields checked. Advanced rules are reference data. Nothing was saved." : "Draft checked. Nothing was saved." });
  };
  const extraSettings = <>
    <div className="relative">
      <details className="rounded-md border border-border/30 bg-background/20">
        <summary className="cursor-pointer px-3 py-2 pr-10 text-sm font-medium text-primary">Separate actions</summary>
        <div className="flex flex-wrap gap-2 border-t border-border/30 p-3">
          <Button type="button" variant="outline" size="sm" onClick={addAction}>Add separate action</Button>
          {(!live || current.id !== draft.id) && <Button type="button" variant="ghost" size="sm" onClick={duplicate}>{current.id === draft.id ? "Duplicate draft" : "Duplicate action"}</Button>}
          {current.id !== draft.id && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => { setDraft(previous => removePreviewNode(previous, current.id)); setSelected(draft.id); setMessage(undefined); }}>Remove action</Button>}
        </div>
      </details>
      <div className="absolute right-2 top-1.5">
        <SectionHelp label="Separate actions">Add a linked action with its own cost, targets, and effects. Use the Action menu to switch between actions.</SectionHelp>
      </div>
    </div>
    <div id="ability-advanced-rules" className="relative scroll-mt-4">
      <details open={Object.keys(initialRules).length > 0 || undefined} className="rounded-md border border-border/30 bg-background/20">
        <summary className="cursor-pointer px-3 py-2 pr-10 text-sm font-medium text-primary">Advanced rules {Object.keys(mechanics).length > 0 && <span className="text-xs font-normal text-muted-foreground">· {Object.keys(mechanics).length} fields or rule groups</span>}</summary>
        <div className="border-t border-border/30 p-3">
          <MechanicsFields key={`${current.id}:${resetCount}`} label="Feature rules" value={mechanics} onChange={next => {
            if (usesReferenceRules) { setReferenceRules(next); setMessage(undefined); }
            else changeNode({ ...current, advancedRules: Object.keys(next).length ? next : undefined });
          }} presets={abilityMechanicsPresets} />
        </div>
      </details>
      <div className="absolute right-2 top-1.5">
        <SectionHelp label="Advanced rules">Record marks, activation choices, resistance margins, or follow-up triggers. These are reference rules, not automatic combat effects.</SectionHelp>
      </div>
    </div>
  </>;

  return <div className="flex min-h-0 flex-col" data-ability-editor={live ? owner.kind : undefined} data-ability-editor-preview={live ? undefined : owner.kind} data-ability-preview-owner={ownerType}>
    <div className="min-h-0 overflow-y-auto px-3 py-4 sm:px-4">
      <div className={showPreview ? "grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]" : "mx-auto min-w-0 max-w-3xl"}>
        <div className="min-w-0 space-y-3">
          {nodes.length > 1 && <label className="flex min-w-0 items-center gap-2 text-sm">Action<select className="w-full min-w-0 rounded-md border border-border/50 bg-background px-2 py-1.5 text-sm" value={current.id} onChange={event => setSelected(event.target.value)}>{nodes.map(node => <option key={node.input.id} value={node.input.id}>{"↳ ".repeat(node.depth)}{node.input.name || "Unnamed action"}{node.kind === "summon" ? ` · ${node.familiarName}` : ""}</option>)}</select></label>}
          {snapshot.error && <p className="text-xs text-muted-foreground">Saved choices could not be read. This draft remains local to the preview.</p>}
          {reference && current.id === draft.id && <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => {
            const rules = document.getElementById("ability-advanced-rules");
            const settings = rules?.closest("details");
            if (settings) settings.open = true;
            const advanced = rules?.querySelector("details");
            if (advanced) advanced.open = true;
            rules?.scrollIntoView({ block: "start" });
          }}>Go to imported weapon feature rules</button>}
          <PrototypeAbilityFields key={`${current.id}:${resetCount}`} input={current} options={draft.options} sources={snapshot.essences.map(essence => essence.name)} familiars={creatureOwned || live?.allowSummon === false ? [] : snapshot.character?.familiars ?? []} allowSummon={!creatureOwned && live?.allowSummon !== false} skillNames={creatureOwned ? [] : snapshot.skills.map(skill => skill.name)} ownerLabel={actor} fixedSource={owner.kind !== "character" || !!summoned} onChange={changeNode} extraSettings={extraSettings} openExtraSettings={Object.keys(initialRules).length > 0} />
        </div>
        {showPreview && <PrototypePreviewCard input={current} ownerLabel={ownerLabel} reference={usesReferenceRules ? referenceRules : undefined} />}
      </div>
    </div>
    <footer className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-card p-3 sm:px-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="ghost" aria-expanded={showPreview} onClick={() => setShowPreview(value => !value)}>{showPreview ? "Hide preview" : "Show preview"}</Button>
        {message ? <p role={message.error ? "alert" : "status"} className={`min-w-0 text-xs ${message.error ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</p> : <p className="text-xs text-muted-foreground">{live ? "Changes apply when you save." : "Preview only · nothing is saved"}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={pending}>{live ? "Cancel draft" : "Close preview"}</Button>
        <Button type="button" size="sm" variant="outline" onClick={reset} disabled={pending}>Reset draft</Button>
        {!live && <div className="inline-flex items-center gap-1">
          <Button type="button" size="sm" onClick={() => checkDraft(false)}>Check draft</Button>
          <SectionHelp label="Check draft">Validates the standard fields only. It does not save the draft, roll dice, or check advanced reference rules.</SectionHelp>
        </div>}
        {live && <Button type="button" size="sm" onClick={() => checkDraft(true)} disabled={pending}>{pending ? "Saving…" : "Save ability"}</Button>}
        {onKeep && <Button type="button" size="sm" onClick={() => checkDraft(true)}>Keep in equipment draft</Button>}
      </div>
    </footer>
  </div>;
}
