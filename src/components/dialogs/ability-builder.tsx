import { useEffect, useRef, useState } from "react";
import { useListAbilities, useListSkills, useListEssences, useGetCharacter, useAddAbility, useUpdateAbility, useDeleteAbility } from "../../hooks/useStorage";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { inputFromAbility, type AbilityInput } from "../../lib/ability-input";
import type { Ability } from "../../lib/storage";
import { toast } from "sonner";
import { LocalAbilityDraft, previewAbilityDialogClass, previewAbilityHeaderClass, previewAbilityTitleClass, type AbilityEditorOwner } from "../ability-editor-prototype/preview-entry";

interface LiveEditorProps {
  characterId: number;
  initial: Ability | null;
  owner: AbilityEditorOwner;
  source?: string;
  pending?: boolean;
  onSave: (ability: Omit<Ability, "id">) => void;
  onClose: () => void;
}

/** Shared live editor; the caller owns the specific character, gear, or familiar write. */
export function LiveAbilityEditor({ characterId, initial, owner, source, pending, onSave, onClose }: LiveEditorProps) {
  const { data: character, isPending: characterPending, isError: characterError } = useGetCharacter(characterId);
  const { data: abilities = [], isPending: abilitiesPending, isError: abilitiesError } = useListAbilities(characterId);
  const { data: essences = [], isPending: essencesPending, isError: essencesError } = useListEssences(characterId);
  const { data: skills = [], isPending: skillsPending, isError: skillsError } = useListSkills(characterId);
  if (characterPending || abilitiesPending || essencesPending || skillsPending) return <p role="status" className="p-4 text-sm text-muted-foreground">Loading ability choices…</p>;
  if (characterError || !character) return <p role="alert" className="p-4 text-sm text-destructive">Could not load the character who owns this ability.</p>;
  const essenceFor = (definition: AbilityInput) => owner.kind === "character" ? essences.find(essence => essence.name === definition.source)?.id ?? null : null;
  const validate = (definition: AbilityInput) => {
    if (owner.kind !== "character" || !definition.source || definition.source === "Innate") return;
    const essenceId = essenceFor(definition);
    // An unrelated edit must never strip an existing Essence link if its choices failed to load.
    if (essencesError || abilitiesError) return "Could not verify this ability’s Essence. Reopen the editor and try again.";
    if (essenceId === null) return "Choose an available Essence or clear the source before saving.";
    if (initial?.essenceId !== essenceId && abilities.filter(ability => ability.essenceId === essenceId && ability.id !== initial?.id).length >= 5) return "This Essence already has five shaped abilities.";
  };
  const save = (definition: AbilityInput, usage?: Pick<Ability, "usageType" | "maxCharges" | "currentCharges">) => {
    if (pending) return;
    const essenceId = essenceFor(definition) ?? (owner.kind === "character" && !definition.source && essencesError ? initial?.essenceId ?? null : null);
    const retained = initial ? Object.fromEntries(Object.entries(initial).filter(([key]) => key !== "id")) : {
      cost: 0, cooldown: 0, range: "", speed: "", rollFormula: "", linkedStats: [], assignedToQuickRolls: false,
    };
    const originalRange = initial && (initial.definition ?? inputFromAbility(initial, definition.source));
    const range = initial && originalRange && originalRange.rangeType === definition.rangeType && originalRange.range === definition.range
      ? initial.range : [definition.rangeType, definition.range].filter(Boolean).join(" · ");
    onSave({
      ...retained, ...usage,
      characterId, name: definition.name.trim(), description: definition.description, essenceId,
      isInnatePassive: owner.kind === "character" && definition.source === "Innate",
      inputVersion: 3, definition,
      cost: definition.manaCost ?? 0,
      cooldown: (definition.cooldown ?? 0) * ({ Seconds: 1, Minutes: 60, Hours: 3600, Days: 86400 }[definition.cooldownUnit]),
      range,
      speed: definition.durationType === "Always On" ? "Passive" : definition.reaction ? "Reaction" : definition.timeCost === undefined ? "" : `${definition.timeCost} seconds`,
      rollFormula: initial?.rollFormula ?? "", linkedStats: definition.linkedStats, primaryStat: definition.linkedStats[0] ?? "",
      assignedToQuickRolls: initial?.assignedToQuickRolls ?? false,
    });
  };
  return <LocalAbilityDraft initial={initial} owner={owner} live={{ save, validate, pending, source, snapshot: { character, abilities, essences, skills, error: abilitiesError || essencesError || skillsError ? "Some saved choices are unavailable." : undefined } }} onClose={onClose} />;
}

interface Props { characterId: number; characterName?: string; abilities: Ability[]; open?: boolean; onOpenChange?: (open: boolean) => void; initialAbilityId?: number | null }
export function AbilityBuilder({ characterId, characterName, abilities, open, onOpenChange, initialAbilityId }: Props) {
  const addAbility = useAddAbility(); const updateAbility = useUpdateAbility(); const deleteAbility = useDeleteAbility();
  const [internalOpen, setInternalOpen] = useState(false); const isOpen = open ?? internalOpen;
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnControl = useRef<HTMLButtonElement>(null);
  const lastSelection = useRef<typeof selected>(null);
  const restoreFocus = useRef(false);
  const ownAbilities = abilities.filter(ability => ability.equipmentId == null && ability.inventoryItemId == null);
  const selection = initialAbilityId ?? selected;
  const editing = ownAbilities.find(ability => ability.id === selection) ?? null;
  const isEditing = selection === "new" || editing !== null;
  const pending = addAbility.isPending || updateAbility.isPending;
  const owner: AbilityEditorOwner = { kind: "character", name: characterName ?? "Character" };
  const setOpen = (value: boolean) => {
    if (pending) return;
    if (!value) { setSelected(null); setDeleteId(null); restoreFocus.current = false; }
    setInternalOpen(value); onOpenChange?.(value);
  };
  const openDraft = (id: number | "new") => { lastSelection.current = id; setSelected(id); setDeleteId(null); };
  const closeDraft = () => {
    if (initialAbilityId != null) { setOpen(false); return; }
    restoreFocus.current = true;
    setSelected(null);
  };
  useEffect(() => {
    if (!isOpen) return;
    if (isEditing) titleRef.current?.focus();
    else if (restoreFocus.current) { restoreFocus.current = false; returnControl.current?.focus(); }
  }, [isOpen, isEditing]);
  const save = (payload: Omit<Ability, "id">) => {
    if (pending) return;
    const callbacks = { onSuccess: () => { toast.success("Ability saved."); closeDraft(); }, onError: (error: Error) => toast.error(error.message) };
    if (editing) updateAbility.mutate({ id: editing.id, data: payload }, callbacks); else addAbility.mutate(payload, callbacks);
  };
  return <Dialog open={isOpen} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm">Edit Abilities</Button></DialogTrigger>
    <DialogContent className={previewAbilityDialogClass}>
      <DialogHeader className={previewAbilityHeaderClass}>
        <DialogTitle ref={titleRef} tabIndex={-1} className={previewAbilityTitleClass}>{isEditing ? editing ? "Edit ability" : "New ability" : "Character abilities"}</DialogTitle>
        <DialogDescription>{owner.name}</DialogDescription>
      </DialogHeader>
      {isOpen && (isEditing
        ? <LiveAbilityEditor key={`${characterId}:${editing?.id ?? "new"}`} characterId={characterId} owner={owner} initial={editing} onClose={closeDraft} onSave={save} pending={pending} />
        : <div className="min-h-0 space-y-3 overflow-y-auto p-4">
          <Button ref={lastSelection.current === "new" ? returnControl : undefined} type="button" onClick={() => openDraft("new")}>Create ability</Button>
          {ownAbilities.map(ability => <article key={ability.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/40 p-3">
            <h3 className="min-w-0 break-words">{ability.name}</h3>
            <div className="flex flex-wrap gap-2">
              <Button ref={lastSelection.current === ability.id ? returnControl : undefined} type="button" size="sm" variant="outline" aria-label={`Edit: ${ability.name}`} onClick={() => openDraft(ability.id)}>Edit</Button>
              <Button type="button" size="sm" variant="ghost" aria-label={`Delete: ${ability.name}`} onClick={() => setDeleteId(deleteId === ability.id ? null : ability.id)}>Delete</Button>
              {deleteId === ability.id && <Button type="button" size="sm" variant="destructive" disabled={deleteAbility.isPending} onClick={() => deleteAbility.mutate({ id: ability.id, charId: characterId }, { onSuccess: () => setDeleteId(null), onError: error => toast.error(error.message) })}>Confirm deletion</Button>}
            </div>
          </article>)}
        </div>)}
    </DialogContent>
  </Dialog>;
}
