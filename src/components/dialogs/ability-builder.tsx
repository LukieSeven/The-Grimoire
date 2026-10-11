import type { CustomChoiceCategory } from "../../lib/ability-input";
import { useEffect, useRef, useState } from "react";
import { useListSkills, useListEssences, useGetCharacter, useUpdateCharacter, useAddAbility, useUpdateAbility, useDeleteAbility } from "../../hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { AbilityInputFields } from "./ability-input-fields";
import { AbilityOptionsFields } from "./ability-options";
import { blankAbilityInput, duplicateInput, flattenInputs, inputFromAbility, mergeOptions, validateAbilityInput } from "../../lib/ability-input";
import type { AbilityInput } from "../../lib/ability-input";
import type { Ability, Familiar } from "../../lib/storage";
import { toast } from "sonner";
interface Props { characterId: number; abilities: Ability[]; open?: boolean; onOpenChange?: (open: boolean) => void; initialAbilityId?: number | null; external?: { initial: Ability | null; source: string; pending?: boolean; familiars?: Familiar[]; onSave: (ability: Omit<Ability, "id">) => void } }
export function AbilityBuilder({ characterId, abilities, open, onOpenChange, initialAbilityId, external }: Props) {
  const { data: skills = [] } = useListSkills(characterId);
  const skillNames = external?.familiars !== undefined ? [] : skills.map(skill => skill.name);
  const { data: essences = [] } = useListEssences(characterId);
  const { data: character } = useGetCharacter(characterId);
  const updateCharacter = useUpdateCharacter();
  const addAbility = useAddAbility(); const updateAbility = useUpdateAbility(); const deleteAbility = useDeleteAbility();
  const [internalOpen, setInternalOpen] = useState(false); const isOpen = open ?? internalOpen;
  const [editing, setEditing] = useState<Ability | null>(null);
  const [customCategory, setCustomCategory] = useState<CustomChoiceCategory | undefined>();
  const [view, setView] = useState<"list" | "ability" | "options">("list");
  const [draft, setDraft] = useState<AbilityInput>(blankAbilityInput);
  const [selected, setSelected] = useState<string>("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const openedId = useRef<number | null>(null);
  const externalOpened = useRef(false);
  const pending = !!external?.pending || updateCharacter.isPending || addAbility.isPending || updateAbility.isPending;
  const options = draft.options;
  const edit = (ability: Ability | null) => {
    const source = external?.source ?? (ability?.isInnatePassive ? "Innate" : essences.find(essence => essence.id === ability?.essenceId)?.name ?? "");
    const converted = ability ? inputFromAbility(ability, source) : blankAbilityInput();
    const next = external && ability && !ability.definition ? duplicateInput(converted) : converted;
    if (external && !ability) next.source = source;
    next.options = mergeOptions(character?.abilityOptions, ...abilities.map(ability => ability.definition?.options), next.options);
    setEditing(ability); setDraft(next); setSelected(next.id); setView("ability");
  };
  useEffect(() => {
    if (!isOpen) externalOpened.current = false;
    if (isOpen && external && !externalOpened.current) { externalOpened.current = true; edit(external.initial); return; }
    if (!isOpen) { openedId.current = null; return; }
    if (initialAbilityId != null && openedId.current !== initialAbilityId) {
      const ability = abilities.find(entry => entry.id === initialAbilityId);
      if (ability) { openedId.current = initialAbilityId; edit(ability); }
    }
  }, [isOpen, initialAbilityId, abilities]);
  const setOpen = (value: boolean) => { setInternalOpen(value); onOpenChange?.(value); };
  const changeNode = (updated: AbilityInput) => {
    const replace = (node: AbilityInput): AbilityInput => node.id === updated.id ? updated : { ...node, subAbilities: node.subAbilities.map(replace), summon: node.summon ? { ...node.summon, abilities: node.summon.abilities.map(replace) } : undefined };
    setDraft(previous => replace(previous));
  };
  const nodes = flattenInputs(draft);
  const summonedIds = new Set(nodes.flatMap(node => (node.summon?.abilities ?? []).flatMap(flattenInputs).map(ability => ability.id)));
  const current = nodes.find(node => node.id === selected) ?? draft;
  const save = () => {
    if (pending) return;
    const error = validateAbilityInput(draft); if (error) { toast.error(error); return; }
    const essenceId = essences.find(essence => essence.name === draft.source)?.id ?? null;
    if (!external && essenceId !== null && abilities.filter(ability => ability.essenceId === essenceId && ability.id !== editing?.id).length >= 5) { toast.error("This Essence already has five shaped abilities."); return; }
    const payload: Omit<Ability, "id"> = {
      ...(editing ?? { characterId, cost: 0, cooldown: 0, range: "", speed: "", rollFormula: "", linkedStats: [], assignedToQuickRolls: false }),
      characterId, name: draft.name.trim(), description: draft.description, essenceId, isInnatePassive: draft.source === "Innate",
      inputVersion: 3, definition: { ...draft, options },
      cost: draft.manaCost ?? 0, cooldown: (draft.cooldown ?? 0) * ({ Seconds: 1, Minutes: 60, Hours: 3600, Days: 86400 }[draft.cooldownUnit]),
      range: [draft.rangeType, draft.range].filter(Boolean).join(" · "), speed: draft.reaction ? "Reaction" : draft.timeCost === undefined ? "" : `${draft.timeCost} seconds`,
      // All new rolls live in target results; no duplicated universal roll or old Sub-Ability UI.
      rollFormula: editing?.rollFormula ?? "", linkedStats: draft.linkedStats, primaryStat: draft.linkedStats[0] ?? "",
    };
    if (external) {
      updateCharacter.mutate({ id: characterId, data: { abilityOptions: mergeOptions(character?.abilityOptions, options) } }, {
        onSuccess: () => external.onSave(payload), onError: error => toast.error(error.message),
      });
      return;
    }
    const callbacks = { onSuccess: () => { toast.success("Ability saved."); setView("list"); }, onError: (error: Error) => toast.error(error.message) };
    if (editing) updateAbility.mutate({ id: editing.id, data: payload }, callbacks); else addAbility.mutate(payload, callbacks);
  };
  const addSub = () => { const node = { ...blankAbilityInput(), source: current.source, options }; changeNode({ ...current, subAbilities: [...current.subAbilities, node] }); setSelected(node.id); };
  const remove = (id: string) => { const prune = (node: AbilityInput): AbilityInput => ({ ...node, subAbilities: node.subAbilities.filter(child => child.id !== id).map(prune), summon: node.summon ? { ...node.summon, abilities: node.summon.abilities.filter(child => child.id !== id).map(prune) } : undefined }); setDraft(previous => prune(previous)); setSelected(draft.id); };
  const duplicate = (id: string) => { const node = nodes.find(entry => entry.id === id); if (!node) return; const copy = duplicateInput(node); const parent = nodes.find(entry => entry.subAbilities.some(child => child.id === id)); const summoner = nodes.find(entry => entry.summon?.abilities.some(child => child.id === id)); if (parent) changeNode({ ...parent, subAbilities: [...parent.subAbilities, copy] }); else if (summoner?.summon) changeNode({ ...summoner, summon: { ...summoner.summon, abilities: [...summoner.summon.abilities, copy] } }); else setDraft(previous => ({ ...previous, subAbilities: [...previous.subAbilities, copy] })); setSelected(copy.id); };
  return <Dialog open={isOpen} onOpenChange={setOpen}>
    {!external && <DialogTrigger asChild><Button variant="outline" size="sm">Edit Abilities</Button></DialogTrigger>}
    <DialogContent className="ability-builder w-[96vw] sm:max-w-[70rem] max-h-[90dvh] overflow-hidden p-0 gap-0 bg-card border-border">
      <DialogHeader className="p-4 border-b border-border/40 text-left"><DialogTitle className="text-xl text-primary">{view === "list" ? "Abilities" : editing ? "Edit ability" : "Create ability"}</DialogTitle></DialogHeader>
      {view === "list" ? <div className="p-4 space-y-3 max-h-[72dvh] overflow-y-auto"><Button onClick={() => edit(null)}>Create ability</Button>
        {abilities.filter(ability => !ability.equipmentId && !ability.inventoryItemId).map(ability => <article key={ability.id} className="border border-border/40 p-3 flex justify-between flex-wrap gap-3"><h3>{ability.name}</h3><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(ability)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setDeleteId(deleteId === ability.id ? null : ability.id)}>Delete</Button>{deleteId === ability.id && <Button size="sm" variant="destructive" onClick={() => deleteAbility.mutate({ id: ability.id, charId: characterId }, { onSuccess: () => setDeleteId(null) })}>Confirm deletion</Button>}</div></article>)}
      </div> : <>
        <nav className="flex gap-2 p-3 border-b border-border/40" aria-label="Ability editor sections">{(["ability", "options"] as const).map(section => <Button key={section} variant={view === section ? "default" : "outline"} onClick={() => setView(section)}>{section === "ability" ? "Ability" : "Settings"}</Button>)}</nav>
        <div className="max-h-[62dvh] overflow-y-auto p-4">
          {view === "options" ? <div className="space-y-4"><AbilityOptionsFields skillNames={skillNames} key={customCategory ?? "settings"} initialCategory={customCategory} options={draft.options} onChange={options => setDraft(previous => ({ ...previous, options }))} onSave={abilityOptions => updateCharacter.mutate({ id: characterId, data: { abilityOptions } }, { onSuccess: () => toast.success("Settings saved."), onError: error => toast.error(error.message) })}/></div> :
          <div className="grid grid-cols-1 md:grid-cols-[13rem_minmax(0,1fr)] gap-4 items-start">
<aside className="space-y-2">{nodes.map((node, index) => <div key={node.id} className={`border p-2 space-y-2 ${current.id === node.id ? "border-primary bg-primary/5" : "border-border/40"}`}><button type="button" className="w-full text-left text-sm" onClick={() => setSelected(node.id)}>{node.name || (index ? "Unnamed Sub-Ability" : "Primary ability")}<span className="block text-xs text-muted-foreground">{summonedIds.has(node.id) ? "Summoned familiar ability" : index ? "Sub-Ability" : "Primary ability"}</span></button>{index > 0 && <div className="flex gap-3"><button type="button" className="text-xs" onClick={() => duplicate(node.id)}>Duplicate</button><button type="button" className="text-xs text-destructive" onClick={() => remove(node.id)}>Remove</button></div>}</div>)}<Button className="w-full h-auto min-h-8 whitespace-normal px-2 py-2 leading-snug" size="sm" variant="outline" onClick={addSub}>Add Sub-Ability/Additional Effect</Button></aside>
            <AbilityInputFields skillNames={skillNames} onCustom={category => { setCustomCategory(category); setView("options"); }} key={current.id} input={current} options={options} sources={external ? [external.source] : essences.map(essence => essence.name)} familiars={external?.familiars ?? character?.familiars ?? []} onChange={changeNode}/>
          </div>}
        </div>
        <footer className="border-t border-border/40 p-3 flex justify-between gap-2"><Button variant="ghost" disabled={pending} onClick={() => external ? onOpenChange?.(false) : setView("list")}>Cancel draft</Button><Button disabled={pending} onClick={save}>{pending ? "Saving…" : "Save ability"}</Button></footer>
      </>}
    </DialogContent>
  </Dialog>;
}
