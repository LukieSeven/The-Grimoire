import { useEffect, useRef, useState, type ComponentProps } from "react";
import { AbilityBuilder } from "./ability-builder";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { isAbilityEditorPreview } from "../ability-editor-prototype/preview-mode";
import { LocalAbilityDraft, previewAbilityDialogClass, previewAbilityHeaderClass, previewAbilityTitleClass } from "../ability-editor-prototype/preview-entry";

type Props = ComponentProps<typeof AbilityBuilder> & { characterName: string };

export function EditAbilitiesDialog({ characterName, ...props }: Props) {
  return isAbilityEditorPreview()
    ? <CharacterAbilityPreview characterName={characterName} {...props} />
    : <AbilityBuilder characterName={characterName} {...props} />;
}

function CharacterAbilityPreview({ characterName, characterId, abilities, open, onOpenChange, initialAbilityId }: Props) {
  const [localOpen, setLocalOpen] = useState(false);
  const [selected, setSelected] = useState<number | "new" | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnControl = useRef<HTMLButtonElement>(null);
  const lastSelection = useRef<typeof selected>(null);
  const restoreFocus = useRef(false);
  const ownAbilities = abilities.filter(ability => ability.equipmentId == null && ability.inventoryItemId == null);
  const selection = initialAbilityId ?? selected;
  const initial = ownAbilities.find(ability => ability.id === selection);
  const editing = selection === "new" || initial !== undefined;
  const changeOpen = (value: boolean) => {
    if (!value) setSelected(null);
    setLocalOpen(value);
    onOpenChange?.(value);
  };
  const openDraft = (id: number | "new") => { lastSelection.current = id; setSelected(id); };
  const closeDraft = () => {
    if (initialAbilityId != null) { changeOpen(false); return; }
    restoreFocus.current = true;
    setSelected(null);
  };
  useEffect(() => {
    if (!(open ?? localOpen)) return;
    if (editing) titleRef.current?.focus();
    else if (restoreFocus.current) { restoreFocus.current = false; returnControl.current?.focus(); }
  }, [open, localOpen, editing]);

  return <Dialog open={open ?? localOpen} onOpenChange={value => !value && editing ? closeDraft() : changeOpen(value)}>
    <DialogTrigger asChild><Button variant="outline" size="sm">Edit Abilities</Button></DialogTrigger>
    <DialogContent className={previewAbilityDialogClass}>
      <DialogHeader className={previewAbilityHeaderClass}>
        <DialogTitle ref={titleRef} tabIndex={-1} className={previewAbilityTitleClass}>{editing ? initial ? "Edit character ability" : "New character ability" : "Character abilities"}</DialogTitle>
        <DialogDescription>{characterName} · Local ability preview. Nothing is saved.</DialogDescription>
      </DialogHeader>
      {editing
        ? <LocalAbilityDraft key={`${characterId}:${selection}`} characterId={characterId} owner={{ kind: "character", name: characterName }} initial={initial ?? null} onClose={closeDraft} />
        : <div className="min-h-0 space-y-3 overflow-y-auto p-4" data-character-ability-preview-list>
          <Button ref={lastSelection.current === "new" ? returnControl : undefined} type="button" onClick={() => openDraft("new")}>Create ability</Button>
          {ownAbilities.map(ability => <article key={ability.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/40 p-3">
            <h3 className="min-w-0 break-words">{ability.name}</h3>
            <Button ref={lastSelection.current === ability.id ? returnControl : undefined} type="button" size="sm" variant="outline" aria-label={`Edit: ${ability.name}`} onClick={() => openDraft(ability.id)}>Edit</Button>
          </article>)}
        </div>}
    </DialogContent>
  </Dialog>;
}
