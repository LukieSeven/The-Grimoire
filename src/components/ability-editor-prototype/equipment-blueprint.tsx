import { useRef, useState } from "react";
import { Button } from "../ui/button";
import type { AbilityInput } from "../../lib/ability-input";
import { isRuleRecord, MechanicsFields, type RuleRecord, type RuleValue } from "./mechanics-fields";
import { LocalAbilityDraft } from "./preview-entry";
import { equipmentDraftFormat, equipmentDraftVersion, readCompleteEquipmentDraft } from "./equipment-draft-format";
import { SectionHelp } from "./section-help";

export interface EquipmentBlueprintProps {
  characterId: number;
  ownerName?: string;
  seed?: { name: string; description?: string; dtBonus?: number | string; damageFormula?: string };
  onClose: () => void;
}

interface FeatureDraft { key: string; reference: RuleRecord; definition?: AbilityInput }
interface GroupDraft { key: string; fields: RuleRecord; features: FeatureDraft[] }
interface BlueprintDraft { envelope?: RuleRecord; fields: RuleRecord; weapons: GroupDraft[]; paired: GroupDraft | null }
interface Selection { groupKey: string; featureKey: string; newFeature?: FeatureDraft }

const nameOf = (record: RuleRecord, fallback: string) => typeof record.name === "string" && record.name.trim() ? record.name : fallback;
const featureDraft = (reference: RuleRecord): FeatureDraft => ({ key: crypto.randomUUID(), reference });
const groupDraft = (fields: RuleRecord, features: FeatureDraft[] = []): GroupDraft => ({ key: crypto.randomUUID(), fields, features });
const setPresets: RuleRecord = { id: "", name: "", owner: "", type: "", quality: "", essences: [] };
const weaponPresets: RuleRecord = {
  id: "", name: "", hand: "", type: "", essence: "", quality: "", description: "",
  appearance: { base: "", details: "", edge: "", reinforcement: "", attachment: "", combat_effect: "" },
  stats: { damage: { formula: "", type: "" }, primary_stat: "", dt_bonus: null },
};
const pairedPresets: RuleRecord = { id: "", name: "", requirement: { both_weapons_equipped: null, weapons: [] } };
const newWeapon = (seed?: EquipmentBlueprintProps["seed"]) => groupDraft({
  id: crypto.randomUUID(), name: seed?.name ?? "", hand: "", type: "", essence: "", quality: "",
  ...(seed?.description !== undefined ? { description: seed.description } : {}),
  appearance: structuredClone(weaponPresets.appearance),
  stats: { damage: { formula: seed?.damageFormula ?? "", type: "" }, primary_stat: "", dt_bonus: seed?.dtBonus ?? null },
});
const newPaired = () => groupDraft(structuredClone(pairedPresets));

function records(value: RuleValue | undefined, label: string): RuleRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isRuleRecord)) throw new Error(`${label} must be a list of records.`);
  return value;
}

function fromBlueprint(input: unknown): BlueprintDraft {
  if (!isRuleRecord(input) || !isRuleRecord(input.equipment_set)) throw new Error("Expected an equipment_set record in the blueprint.");
  const { equipment_set, ...envelope } = input;
  const { weapons, paired_bonuses, ...fields } = equipment_set;
  const readGroup = (record: RuleRecord) => {
    const { abilities, ...metadata } = record;
    return groupDraft(metadata, records(abilities, "Abilities").map(featureDraft));
  };
  if (paired_bonuses !== undefined && !isRuleRecord(paired_bonuses)) throw new Error("Paired bonuses must be a record.");
  return { envelope, fields, weapons: records(weapons, "Weapons").map(readGroup), paired: paired_bonuses ? readGroup(paired_bonuses) : null };
}

function toReferenceBlueprint(draft: BlueprintDraft): RuleRecord {
  const writeGroup = (group: GroupDraft): RuleRecord => ({ ...group.fields, abilities: group.features.map(feature => feature.reference) });
  return { ...draft.envelope, equipment_set: { ...draft.fields, weapons: draft.weapons.map(writeGroup), ...(draft.paired ? { paired_bonuses: writeGroup(draft.paired) } : {}) } };
}

function fromEquipmentFile(input: unknown): BlueprintDraft {
  if (!isRuleRecord(input) || input.format !== equipmentDraftFormat) return fromBlueprint(input);
  const { reference, definitions } = readCompleteEquipmentDraft(input);
  const draft = fromBlueprint(reference);
  const attach = (group: GroupDraft, entries: (AbilityInput | null)[]): GroupDraft => {
    if (group.features.length !== entries.length) throw new Error("The ability entries do not match the equipment reference.");
    return { ...group, features: group.features.map((feature, index) => ({ ...feature, definition: entries[index] ?? undefined })) };
  };
  if (draft.weapons.length !== definitions.weapons.length || !!draft.paired !== !!definitions.paired) {
    throw new Error("The weapon and paired feature entries do not match the equipment reference.");
  }
  return { ...draft, weapons: draft.weapons.map((group, index) => attach(group, definitions.weapons[index])), paired: draft.paired && definitions.paired ? attach(draft.paired, definitions.paired) : null };
}

function toCompleteDraft(draft: BlueprintDraft) {
  const definitions = (group: GroupDraft) => group.features.map(feature => feature.definition ?? null);
  return {
    format: equipmentDraftFormat, version: equipmentDraftVersion, reference: toReferenceBlueprint(draft),
    definitions: { weapons: draft.weapons.map(definitions), paired: draft.paired ? definitions(draft.paired) : null },
  };
}

const field = "mt-1 block min-h-9 w-full min-w-0 rounded-md border border-border/50 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary";
const textSlot = (value: RuleValue | undefined) => value === undefined || typeof value === "string";
const without = (record: RuleRecord, keys: string[]) => Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
type EquipmentTextField = readonly [key: string, label: string];

const setFields = [["name", "Set name"], ["owner", "Wielder"], ["type", "Equipment type"], ["quality", "Quality"]] as const;
const weaponFields = [["name", "Weapon name"], ["hand", "Hand"], ["essence", "Essence"], ["type", "Weapon type"], ["quality", "Quality"]] as const;
const pairFields = [["name", "Paired feature group name"]] as const;

function EquipmentTextFields({ record, fields, onChange }: { record: RuleRecord; fields: readonly EquipmentTextField[]; onChange: (next: RuleRecord) => void }) {
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2">
    {fields.filter(([key]) => textSlot(record[key])).map(([key, label]) => <label key={key} className="block min-w-0 text-sm">{label}
      <input className={field} value={typeof record[key] === "string" ? record[key] : ""} onChange={event => onChange({ ...record, [key]: event.target.value })} />
    </label>)}
  </div>;
}

function EssenceList({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  return <label className="block min-w-0 text-sm">Essences <span className="text-xs text-muted-foreground">(one per line)</span>
    <textarea className={field} rows={2} value={value.join("\n")} onChange={event => onChange(event.target.value === "" ? [] : event.target.value.split("\n"))} />
  </label>;
}

function OtherDetails({ record, presets, covered, onChange }: { record: RuleRecord; presets: RuleRecord; covered: string[]; onChange: (value: RuleRecord) => void }) {
  const core = Object.fromEntries(Object.entries(record).filter(([key]) => covered.includes(key)));
  return <details className="rounded-md border border-border/40 bg-background/20">
    <summary className="cursor-pointer px-3 py-2 text-sm text-muted-foreground">Other details</summary>
    <div className="border-t border-border/30 p-3"><MechanicsFields label="Other equipment details" value={without(record, covered)} presets={without(presets, covered)} reservedKeys={covered} onChange={next => onChange({ ...core, ...next })} /></div>
  </details>;
}

function WeaponStrike({ stats, onChange }: { stats: RuleRecord; onChange: (stats: RuleRecord) => void }) {
  const damage = isRuleRecord(stats.damage) ? stats.damage : {};
  const damageKeys = ["formula", "type"].filter(key => textSlot(damage[key]));
  const dt = stats.dt_bonus;
  const canEditDt = dt === undefined || dt === null || typeof dt === "string" || typeof dt === "number";
  const covered = [
    ...(stats.damage === undefined || isRuleRecord(stats.damage) ? ["damage"] : []),
    ...(textSlot(stats.primary_stat) ? ["primary_stat"] : []), ...(canEditDt ? ["dt_bonus"] : []),
  ];
  const otherDamage = without(damage, damageKeys);
  return <section aria-label="Weapon strike and defense" className="space-y-3 rounded-md border border-border/40 p-3">
    <h5 className="font-serif text-sm font-semibold text-primary">Strike & defense<SectionHelp label="Strike & defense">Enter the weapon’s complete strike formula, damage type, and any DT bonus it grants. Use Weapon features for separate passives or abilities.</SectionHelp></h5>
    {covered.includes("damage") && <EquipmentTextFields record={damage} fields={[["formula", "Strike damage formula"], ["type", "Damage type"]]} onChange={next => onChange({ ...stats, damage: next })} />}
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {textSlot(stats.primary_stat) && <label className="text-sm">Strike attribute<input className={`${field} font-mono`} value={typeof stats.primary_stat === "string" ? stats.primary_stat : ""} onChange={event => onChange({ ...stats, primary_stat: event.target.value })} /></label>}
      {canEditDt && <label className="text-sm">DT bonus<input className={`${field} font-mono`} value={dt ?? ""} onChange={event => {
        const next = event.target.value;
        onChange({ ...stats, dt_bonus: typeof dt === "number" && next.trim() && Number.isFinite(Number(next)) ? Number(next) : next || null });
      }} /></label>}
    </div>
    {!!Object.keys(otherDamage).length && <OtherDetails record={damage} presets={{}} covered={damageKeys} onChange={next => onChange({ ...stats, damage: next })} />}
    {!!Object.keys(without(stats, covered)).length && <OtherDetails record={stats} presets={{}} covered={covered} onChange={onChange} />}
  </section>;
}

function PairRequirement({ requirement, weapons, onChange }: { requirement: RuleRecord; weapons: GroupDraft[]; onChange: (value: RuleRecord) => void }) {
  const both = requirement.both_weapons_equipped;
  const canEditBoth = both === undefined || both === null || typeof both === "boolean";
  const namedWeaponIds = Array.isArray(requirement.weapons) && requirement.weapons.every(value => typeof value === "string") ? requirement.weapons : undefined;
  const ids = namedWeaponIds ?? [];
  const canEditWeapons = requirement.weapons === undefined || namedWeaponIds !== undefined;
  const names = new Map(weapons.flatMap(group => typeof group.fields.id === "string" && group.fields.id.trim() ? [[group.fields.id, nameOf(group.fields, group.fields.id)] as const] : []));
  const covered = [...(canEditBoth ? ["both_weapons_equipped"] : []), ...(canEditWeapons ? ["weapons"] : [])];
  return <section aria-label="Equip requirements" className="space-y-3 rounded-md border border-border/40 p-3">
    <h5 className="font-serif text-sm font-semibold text-primary">Equip requirements<SectionHelp label="Equip requirements">Specify which weapons must be equipped to use the paired features. This records the rule in the draft and does not change what is equipped.</SectionHelp></h5>
    {canEditBoth && <label className="block text-sm">Require both weapons equipped<select className={field} value={both == null ? "" : both ? "yes" : "no"} onChange={event => onChange({ ...requirement, both_weapons_equipped: event.target.value === "" ? null : event.target.value === "yes" })}><option value="">Not specified</option><option value="yes">Yes</option><option value="no">No</option></select></label>}
    {canEditWeapons && <div className="space-y-2">
      <p className="text-sm">Required weapons</p>
      {ids.map((id, index) => <div key={`${id}:${index}`} className="flex items-center justify-between gap-2 text-sm"><span className="break-words">{names.get(id) ?? id}</span><Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onChange({ ...requirement, weapons: ids.filter((_, position) => position !== index) })}>Remove</Button></div>)}
      {!![...names].some(([id]) => !ids.includes(id)) && <select aria-label="Add required weapon" className={field} value="" onChange={event => { if (event.target.value) onChange({ ...requirement, weapons: [...ids, event.target.value] }); }}><option value="">Add required weapon…</option>{[...names].filter(([id]) => !ids.includes(id)).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select>}
      {!ids.length && !names.size && <p className="text-xs text-muted-foreground">Add a weapon piece first. An older piece with no reference ID can be linked after adding an ID in Other details.</p>}
    </div>}
    {!!Object.keys(without(requirement, covered)).length && <OtherDetails record={requirement} presets={{}} covered={covered} onChange={onChange} />}
  </section>;
}

export default function EquipmentBlueprint({ characterId, ownerName, seed, onClose }: EquipmentBlueprintProps) {
  const [draft, setDraft] = useState<BlueprintDraft>(() => ({
    fields: { id: "", name: seed?.name ?? "", owner: ownerName ?? "", type: "", quality: "", essences: [] },
    weapons: seed ? [newWeapon(seed)] : [], paired: null,
  }));
  const [selected, setSelected] = useState<Selection | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean }>();
  const [edited, setEdited] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const update = (edit: (previous: BlueprintDraft) => BlueprintDraft) => { setDraft(edit); setEdited(true); };
  const updateGroup = (key: string, edit: (group: GroupDraft) => GroupDraft) => update(previous => ({
    ...previous,
    weapons: previous.weapons.map(group => group.key === key ? edit(group) : group),
    paired: previous.paired && previous.paired.key === key ? edit(previous.paired) : previous.paired,
  }));
  const replaceDraft = (next: BlueprintDraft) => {
    setDraft(next);
    setSelected(null);
    setOpenGroup(null);
    setEdited(false);
  };
  const loadExample = async () => {
    if (edited && !window.confirm("Replace this preview draft with the Emberclasp example?")) return;
    setLoading(true);
    setNotice(undefined);
    try {
      const response = await fetch("/tmp/emberclasp.blueprint.json", { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("json")) throw new Error("Emberclasp example not found. Check that the local blueprint file is available.");
      replaceDraft(fromBlueprint(await response.json()));
      setNotice({ text: "Emberclasp loaded as a preview. No equipment or character data was changed.", error: false });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Could not load the Emberclasp example.", error: true });
    } finally {
      setLoading(false);
    }
  };
  const openFile = async (file: File) => {
    if (edited && !window.confirm("Replace this equipment preview with the selected file?")) return;
    setLoading(true);
    setNotice(undefined);
    try {
      replaceDraft(fromEquipmentFile(JSON.parse(await file.text())));
      setNotice({ text: "Opened in the equipment preview. Saved gear is unchanged.", error: false });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Could not open this equipment file.", error: true });
    } finally {
      setLoading(false);
    }
  };
  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(toReferenceBlueprint(draft), null, 2));
      setNotice({ text: "Reference copied. To keep the shared ability edits too, export the complete draft.", error: false });
    } catch {
      setNotice({ text: "Clipboard access is unavailable in this browser.", error: true });
    }
  };
  const exportDraft = () => {
    try {
      const complete = toCompleteDraft(draft);
      const url = URL.createObjectURL(new Blob([JSON.stringify(complete, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      const basename = nameOf(draft.fields, "equipment").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "equipment";
      link.href = url;
      link.download = `${basename}.equipment-draft.json`;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setNotice({ text: "Complete draft exported with shared ability edits. Use Open equipment file to reopen it.", error: false });
    } catch {
      setNotice({ text: "Could not export the equipment draft.", error: true });
    }
  };
  const select = (groupKey: string, featureKey: string) => { setOpenGroup(groupKey); setSelected({ groupKey, featureKey }); };
  const addFeature = (group: GroupDraft) => {
    const next = featureDraft({ id: "", name: "", description: "", category: "" });
    setOpenGroup(group.key);
    setSelected({ groupKey: group.key, featureKey: next.key, newFeature: next });
  };

  const activeGroup = selected && [...draft.weapons, ...(draft.paired ? [draft.paired] : [])].find(group => group.key === selected.groupKey);
  const activeFeature = activeGroup && (selected?.newFeature ?? activeGroup.features.find(feature => feature.key === selected?.featureKey));
  if (activeGroup && activeFeature) return <LocalAbilityDraft
    key={activeFeature.key}
    characterId={characterId}
    owner={{ kind: "item", equipment: true, name: nameOf(activeGroup.fields, activeGroup === draft.paired ? "Paired equipment" : "Weapon piece"), wielderName: typeof draft.fields.owner === "string" && draft.fields.owner.trim() ? draft.fields.owner : ownerName }}
    initial={null}
    reference={activeFeature.reference}
    initialDefinition={activeFeature.definition}
    onKeep={(reference, definition) => {
      const kept = { ...activeFeature, reference, definition };
      updateGroup(activeGroup.key, group => ({ ...group, features: selected?.newFeature ? [...group.features, kept] : group.features.map(feature => feature.key === kept.key ? kept : feature) }));
      setSelected(null);
    }}
    onClose={() => setSelected(null)}
  />;

  const renderGroup = (group: GroupDraft, kind: "weapon" | "paired", index?: number) => {
    const name = nameOf(group.fields, kind === "paired" ? "Paired bonuses" : `Weapon piece ${(index ?? 0) + 1}`);
    const fields = kind === "paired" ? pairFields : weaponFields;
    const covered: string[] = fields.flatMap(([key]) => textSlot(group.fields[key]) ? [key] : []);
    const updateFields = (fields: RuleRecord) => updateGroup(group.key, previous => ({ ...previous, fields }));
    const rawStats = group.fields.stats;
    const rawRequirement = group.fields.requirement;
    const strike = kind === "weapon" && (rawStats === undefined || isRuleRecord(rawStats));
    const requirement = kind === "paired" && (rawRequirement === undefined || isRuleRecord(rawRequirement));
    if (strike) covered.push("stats");
    if (requirement) covered.push("requirement");
    return <details key={group.key} open={openGroup === group.key || undefined} className="min-w-0 rounded-md border border-border/50 bg-card" data-blueprint-group={kind}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-primary"><span className="break-words">{name}</span><span className="ml-2 text-xs font-normal text-muted-foreground">{group.features.length} features</span></summary>
      <div className="min-w-0 space-y-4 border-t border-border/30 p-4">
        <EquipmentTextFields record={group.fields} fields={fields} onChange={updateFields} />
        {strike && <WeaponStrike stats={isRuleRecord(rawStats) ? rawStats : {}} onChange={stats => updateFields({ ...group.fields, stats })} />}
        {requirement && <PairRequirement requirement={isRuleRecord(rawRequirement) ? rawRequirement : {}} weapons={draft.weapons} onChange={requirement => updateFields({ ...group.fields, requirement })} />}
        <div className="space-y-2 border-t border-border/30 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{kind === "paired" ? "Paired features" : "Weapon features"}<SectionHelp label={kind === "paired" ? "Paired features" : "Weapon features"}>Draft each passive, reaction, or action in the standard ability form. Features kept here belong to the equipment draft, not the character sheet.</SectionHelp></h4><Button type="button" variant="outline" size="sm" onClick={() => addFeature(group)}>Add feature</Button></div>
          {!group.features.length && <p className="text-xs text-muted-foreground">Add a property, passive, or usable ability for this owner.</p>}
          {group.features.map(feature => <div key={feature.key} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 p-2">
            <div className="min-w-0"><p className="break-words text-sm">{nameOf(feature.reference, "Unnamed feature")}</p>{typeof feature.reference.category === "string" && feature.reference.category && <p className="break-words text-xs text-muted-foreground">{feature.reference.category}</p>}</div>
            <div className="flex flex-wrap gap-1">
              <Button type="button" variant="outline" size="sm" aria-label={`Edit ${nameOf(feature.reference, "unnamed feature")}`} onClick={() => select(group.key, feature.key)}>Edit feature</Button>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" aria-label={`Remove ${nameOf(feature.reference, "unnamed feature")}`} onClick={() => { if (window.confirm("Remove this feature from the preview draft?")) updateGroup(group.key, previous => ({ ...previous, features: previous.features.filter(entry => entry.key !== feature.key) })); }}>Remove</Button>
            </div>
          </div>)}
        </div>
        <OtherDetails record={group.fields} presets={kind === "paired" ? pairedPresets : weaponPresets} covered={covered} onChange={updateFields} />
        <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => {
          if (window.confirm(`Remove ${name} and its features from the preview draft?`)) update(previous => kind === "paired" ? { ...previous, paired: null } : { ...previous, weapons: previous.weapons.filter(entry => entry.key !== group.key) });
        }}>{kind === "paired" ? "Remove paired bonuses" : "Remove weapon piece"}</Button>
      </div>
    </details>;
  };

  const setEssences = Array.isArray(draft.fields.essences) && draft.fields.essences.every(value => typeof value === "string" && !value.includes("\n")) ? draft.fields.essences as string[] : undefined;
  const canEditSetEssences = draft.fields.essences === undefined || setEssences !== undefined;
  const coveredSetFields: string[] = setFields.flatMap(([key]) => textSlot(draft.fields[key]) ? [key] : []);
  if (canEditSetEssences) coveredSetFields.push("essences");

  return <div className="flex min-h-0 flex-col" data-equipment-blueprint-preview>
    <div className="min-h-0 space-y-4 overflow-y-auto px-3 py-4 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Set each weapon’s strike, then add its passives and abilities. Use paired bonuses for features that require the set.</p><div className="flex flex-wrap gap-2">
        <input ref={fileInput} hidden type="file" accept=".json,application/json" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void openFile(file); }} />
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => fileInput.current?.click()}>Open equipment file</Button>
        {import.meta.env.DEV && <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void loadExample()}>Load Emberclasp example</Button>}
      </div></div>
      {loading && <p role="status" className="text-xs text-muted-foreground">Opening equipment preview…</p>}
      {notice && <p role={notice.error ? "alert" : "status"} className={`text-xs ${notice.error ? "text-destructive" : "text-muted-foreground"}`}>{notice.text}</p>}
      <fieldset disabled={loading} className="min-w-0 space-y-4">
        <section aria-label="Equipment set" className="min-w-0 space-y-3 rounded-md border border-border/50 bg-card p-4">
          <h3 className="font-serif text-base text-primary">Equipment set</h3>
          <EquipmentTextFields record={draft.fields} fields={setFields} onChange={fields => update(previous => ({ ...previous, fields }))} />
          {canEditSetEssences && <EssenceList value={setEssences ?? []} onChange={essences => update(previous => ({ ...previous, fields: { ...previous.fields, essences } }))} />}
          <OtherDetails record={draft.fields} presets={setPresets} covered={coveredSetFields} onChange={fields => update(previous => ({ ...previous, fields }))} />
        </section>
        <section aria-label="Weapon pieces" className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-serif text-base text-primary">Weapon pieces · {draft.weapons.length}</h3><Button type="button" variant="outline" size="sm" onClick={() => { const group = newWeapon(); update(previous => ({ ...previous, weapons: [...previous.weapons, group] })); setOpenGroup(group.key); }}>Add weapon piece</Button></div>{draft.weapons.map((group, index) => renderGroup(group, "weapon", index))}</section>
        <section aria-label="Paired bonuses" className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-serif text-base text-primary">Paired bonuses</h3>{!draft.paired && <Button type="button" variant="outline" size="sm" onClick={() => { const paired = newPaired(); update(previous => ({ ...previous, paired })); setOpenGroup(paired.key); }}>Add paired bonuses</Button>}</div>{draft.paired && renderGroup(draft.paired, "paired")}</section>
      </fieldset>
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-card p-3 sm:px-4"><p className="text-xs text-muted-foreground">Preview only · saved gear is unchanged</p><div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1"><Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void copyReference()}>Copy reference only</Button><SectionHelp label="Copy reference only">Copies the equipment and feature reference JSON. It leaves out shared ability settings such as costs, targets, and formulas.</SectionHelp></div>
      <Button type="button" size="sm" disabled={loading} onClick={exportDraft}>Export complete draft</Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close equipment preview</Button>
    </div></footer>
  </div>;
}
