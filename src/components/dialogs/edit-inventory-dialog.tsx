import React, { useState, useEffect, useId, useRef } from "react";
import {
  useAddEquipment, useUpdateEquipment,
  useAddCurrency, useUpdateCurrency,
  useAddInventoryItem, useUpdateInventoryItem,
  useListNotes, useCreateNote,
  useListAbilities, useDeleteAbility
} from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, BookText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Ability } from "@/lib/storage";
import { readGearNote } from "@/lib/gear-note";
import { needsSelectedStat, validateRollFormulaSyntax, weaponRollFormula } from "@/lib/roll-rules";
import { isAbilityEditorPreview } from "../ability-editor-prototype/preview-mode";
import { LocalAbilityDraft, LocalEquipmentBlueprint, previewAbilityDialogClass, previewAbilityHeaderClass, previewAbilityTitleClass } from "../ability-editor-prototype/preview-entry";
import { SectionHelp } from "../ability-editor-prototype/section-help";
import { OwnedItemAbilityEditor } from "./edit-item-ability-dialog";

interface Props {
  characterId: number;
  characterName?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  type: "currency" | "equipment" | "item";
  initialData?: any;
  initialAbilityPreview?: { ability: Ability | null; requestId: number } | null;
  returnFocus?: () => void;
}

const STATS_LIST = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];
const gearDialogClass = "flex w-[96vw] max-h-[90dvh] flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-[42rem]";
const inputClass = "min-w-0 bg-background";
const formulaClass = `${inputClass} font-mono`;

function displayWeaponRoll(diceType?: string, modifier?: string | number): string {
  if (!diceType?.trim()) return "";
  // A complete expression saved by this form should reopen exactly as entered.
  return modifier === 0 || modifier === "0" ? diceType : weaponRollFormula(diceType, modifier);
}

function GearSection({ title, help, actions, children }: { title: string; help: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  const titleId = useId();
  return <section aria-labelledby={titleId} className="min-w-0 space-y-3 rounded-md border border-primary/75 bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-center">
        <h2 id={titleId} className="font-serif text-base font-semibold text-primary">{title}</h2>
        <SectionHelp label={title}>{help}</SectionHelp>
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>}
    </div>
    {children}
  </section>;
}

function GearField({ id, label, help, children }: { id: string; label: string; help?: string; children: React.ReactNode }) {
  return <div className="min-w-0 space-y-1">
    <div className="flex min-h-6 items-center">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {help && <SectionHelp label={label}>{help}</SectionHelp>}
    </div>
    {children}
  </div>;
}

export function EditInventoryDialog({
  characterId,
  characterName,
  isOpen,
  onOpenChange,
  mode,
  type,
  initialData,
  initialAbilityPreview,
  returnFocus,
}: Props) {
  // Mutations
  const addEquipment = useAddEquipment();
  const updateEquipment = useUpdateEquipment();
  const addCurrency = useAddCurrency();
  const updateCurrency = useUpdateCurrency();
  const addInventoryItem = useAddInventoryItem();
  const updateInventoryItem = useUpdateInventoryItem();
  
  const createNote = useCreateNote();
  const { data: notes } = useListNotes(characterId);
  const { data: abilities = [] } = useListAbilities(characterId);
  const deleteAbility = useDeleteAbility();

  const previewEnabled = isAbilityEditorPreview();
  const abilityButtonId = useId();
  const fieldId = useId();
  const previewOwnerKey = isOpen && type !== "currency" && (initialData?.id != null || (mode === "add" && previewEnabled))
    ? `${characterId}:${type}:${mode === "add" ? "new" : initialData.id}`
    : null;
  const abilityOwnerType = type === "equipment" ? "equipment" : "item";
  const isAttachedAbility = (ability: Ability) => mode === "edit" && initialData?.id != null && (
    type === "equipment" ? ability.equipmentId === initialData.id : type === "item" && ability.inventoryItemId === initialData.id
  );
  const itemAbilities = abilities.filter(isAttachedAbility);
  const [abilityPreview, setAbilityPreview] = useState<{ ownerKey: string; initial: Ability | null; returnButtonId: string } | null>(null);
  const activePreview = abilityPreview?.ownerKey === previewOwnerKey ? abilityPreview : null;
  const [savingAbility, setSavingAbility] = useState(false);
  const blueprintOwnerKey = isOpen && type === "equipment" ? `${characterId}:${mode}:${initialData?.id ?? "new"}` : null;
  const [blueprintKey, setBlueprintKey] = useState<string | null>(null);
  const activeBlueprint = blueprintOwnerKey !== null && blueprintKey === blueprintOwnerKey;
  const previewBody = !!activePreview || activeBlueprint;
  const previewTitleRef = useRef<HTMLHeadingElement>(null);

  const requestedAbility = initialAbilityPreview?.ability;
  const requestedAbilityId = initialAbilityPreview?.requestId;
  useEffect(() => {
    const attached = requestedAbility === null || (requestedAbility && mode === "edit" && initialData?.id != null && (
      type === "equipment" ? requestedAbility.equipmentId === initialData.id : type === "item" && requestedAbility.inventoryItemId === initialData.id
    ));
    setAbilityPreview(previewOwnerKey && requestedAbilityId !== undefined && attached
      ? { ownerKey: previewOwnerKey, initial: requestedAbility ?? null, returnButtonId: `${abilityButtonId}-add` }
      : null);
  }, [previewOwnerKey, requestedAbilityId, requestedAbility, abilityButtonId, mode, type, initialData?.id]);
  useEffect(() => setBlueprintKey(null), [blueprintOwnerKey]);
  useEffect(() => { if (previewBody) previewTitleRef.current?.focus(); }, [previewBody]);

  const openAbilityPreview = (initial: Ability | null, returnButtonId: string) => {
    if (previewOwnerKey === null) return;
    setAbilityPreview({ ownerKey: previewOwnerKey, initial, returnButtonId });
  };

  const closeAbilityPreview = () => {
    setAbilityPreview(null);
    if (activePreview) requestAnimationFrame(() => document.getElementById(activePreview.returnButtonId)?.focus());
  };
  const closeBlueprint = () => {
    setBlueprintKey(null);
    requestAnimationFrame(() => document.getElementById(`${abilityButtonId}-blueprint`)?.focus());
  };

  // Searchable Notes Picker states
  const [isNotesPickerOpen, setIsNotesPickerOpen] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const noteQuery = pickerSearchQuery.trim().toLowerCase();
  const matchingNotes = notes?.filter(note => note.category === "item" && (!noteQuery || note.title.toLowerCase().includes(noteQuery) || note.content.toLowerCase().includes(noteQuery))) ?? [];

  const handlePrepopulateFromNote = (note: { title: string; content: string }) => {
    setName(note.title);
    const fields = readGearNote(note.content || "", type === "equipment");
    setDescription(fields.description);
    if (type === "equipment") {
      if (fields.diceType !== undefined) setWeaponRoll(displayWeaponRoll(fields.diceType, fields.modifier));
      if (fields.dtBonus !== undefined) setDtBonus(fields.dtBonus);
      if (fields.statModifiers) setStatModifiers(fields.statModifiers);
    }
    setIsNotesPickerOpen(false);
    toast.success(`Filled details from "${note.title}".`);
  };

  // General Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const abilityOwnerName = mode === "edit" ? initialData?.name ?? "" : name.trim();
  const abilityPreviewOwner = abilityOwnerName || (type === "equipment" ? "New equipment" : "New item");

  // Currency State
  const [amount, setAmount] = useState(0);

  // Item State
  const [quantity, setQuantity] = useState(1);

  // Equipment State
  const [dtBonus, setDtBonus] = useState<string | number>("");
  const [weaponRoll, setWeaponRoll] = useState("");
  const [equipped, setEquipped] = useState(false);
  const [assignedToQuickRolls, setAssignedToQuickRolls] = useState(false);
  
  // Stat Modifiers for equipment: key-value map
  const [statModifiers, setStatModifiers] = useState<Record<string, number | string>>({});

  // Sync state when dialog opens or edits
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        setName(initialData.name || "");
        setDescription(initialData.description || "");
        setAmount(initialData.amount || 0);
        setQuantity(initialData.quantity || 1);
        setDtBonus(initialData.dtBonus ?? "");
        setWeaponRoll(type === "equipment" ? displayWeaponRoll(initialData.diceType, initialData.modifier) : "");
        setEquipped(!!initialData.equipped);
        setAssignedToQuickRolls(!!initialData.assignedToQuickRolls);
        setStatModifiers(initialData.statModifiers || {});
      } else {
        // Reset to defaults for add mode
        setName("");
        setDescription("");
        setAmount(0);
        setQuantity(1);
        setDtBonus("");
        setWeaponRoll("");
        setEquipped(false);
        setAssignedToQuickRolls(false);
        setStatModifiers({});
      }
    }
  }, [isOpen, mode, type, initialData]);

  const handleStatModifierChange = (stat: string, val: string) => {
    setStatModifiers(prev => {
      const next = { ...prev };
      if (!val || val === "0") {
        delete next[stat];
      } else {
        next[stat] = val;
      }
      return next;
    });
  };

  const createAutoItemNote = (itemName: string, itemDesc: string, itemType: string, extraFields?: any) => {
    let noteContent = `Description: ${itemDesc || "None"}`;
    if (itemType === "equipment" && extraFields) {
      noteContent += `\nDice: ${extraFields.diceType || "None"}`;
      noteContent += `\nModifier: ${extraFields.modifier === "" ? "None" : extraFields.modifier ?? "None"}`;
      noteContent += `\nDT Bonus: ${extraFields.dtBonus || 0}`;
      noteContent += `\nStat Modifiers: ${JSON.stringify(extraFields.statModifiers || {})}`;
    }
    createNote.mutate({
      characterId,
      title: itemName,
      category: "item",
      content: noteContent,
      tags: ["auto-imported"],
      images: []
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (type === "currency") {
      if (mode === "add") {
        addCurrency.mutate({ characterId, name, amount }, { 
          onSuccess: () => {
            createAutoItemNote(name, `Currency amount: ${amount}`, "currency");
            onOpenChange(false);
          }
        });
      } else if (mode === "edit" && initialData) {
        updateCurrency.mutate({ id: initialData.id, amount }, { onSuccess: () => onOpenChange(false) });
      }
    } else if (type === "item") {
      if (mode === "add") {
        addInventoryItem.mutate({ characterId, name, description, quantity }, { 
          onSuccess: () => {
            createAutoItemNote(name, description, "item");
            onOpenChange(false);
          }
        });
      } else if (mode === "edit" && initialData) {
        updateInventoryItem.mutate({ id: initialData.id, data: { name, description, quantity } }, { onSuccess: () => onOpenChange(false) });
      }
    } else if (type === "equipment") {
      const enteredRoll = weaponRoll.trim();
      const rollChanged = mode !== "edit" || !initialData || weaponRoll !== displayWeaponRoll(initialData.diceType, initialData.modifier);
      // An explicit blank survives JSON and is distinct from a legacy file's missing dice type.
      const rollFields = enteredRoll ? { diceType: enteredRoll, modifier: 0 } : { diceType: "", modifier: "" };
      if (rollChanged && enteredRoll) {
        try {
          if (needsSelectedStat(enteredRoll)) throw new Error("Use a named attribute, such as POWm. A weapon strike has no linked-attribute picker.");
          validateRollFormulaSyntax(enteredRoll);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Enter a valid weapon roll formula.");
          return;
        }
      }
      if (mode === "add") {
        const extra = { ...rollFields, dtBonus, statModifiers };
        addEquipment.mutate({
          characterId,
          name,
          description,
          equipped,
          assignedToQuickRolls,
          dtBonus,
          statModifiers,
          ...rollFields,
        }, { 
          onSuccess: () => {
            createAutoItemNote(name, description, "equipment", extra);
            onOpenChange(false);
          }
        });
      } else if (mode === "edit" && initialData) {
        updateEquipment.mutate({
          id: initialData.id,
          data: {
            name,
            description,
            equipped,
            assignedToQuickRolls,
            dtBonus,
            statModifiers,
            ...(rollChanged ? rollFields : initialData.diceType === undefined ? { diceType: "" } : {}),
          },
        }, { onSuccess: () => onOpenChange(false) });
      }
    }
  };

  const entryLabel = type === "equipment" ? "equipment" : type === "currency" ? "currency" : "item";
  const abilityPanel = previewOwnerKey || (mode === "edit" && type !== "currency" && initialData) ? (
    <GearSection title={type === "equipment" ? "Equipment abilities" : "Item abilities"}
      help={previewEnabled ? "Draft passives, activations, and other features in the shared ability form. Closing a preview doesn't save it or discard your edits to this entry." : "Add or edit passives, activations, and other abilities attached to this entry."}
      actions={<Button id={`${abilityButtonId}-add`} type="button" variant="outline" size="sm"
        aria-label={previewEnabled ? `Preview new ${abilityOwnerType} ability` : undefined}
        onClick={event => openAbilityPreview(null, event.currentTarget.id)}>
        {previewEnabled ? "Draft ability" : "Add ability"}
      </Button>}
    >
      {itemAbilities.length ? <ul className="space-y-2">
        {itemAbilities.map(ab => <li key={ab.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 bg-background/40 p-3">
          <div className="min-w-0 grow basis-32">
            <p className="break-words font-serif text-sm font-semibold">{ab.name}</p>
            {ab.description && <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">{ab.description}</p>}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button id={`${abilityButtonId}-${ab.id}`} type="button" variant="outline" size="sm"
              aria-label={`${previewEnabled ? "Preview" : "Edit"} ${abilityOwnerType} ability: ${ab.name}`}
              onClick={event => openAbilityPreview(ab, event.currentTarget.id)}>
              {previewEnabled ? "Edit in preview" : "Edit ability"}
            </Button>
            {!previewEnabled && <Button type="button" variant="ghost" size="icon" aria-label={`Remove ability: ${ab.name}`} className="size-8 text-destructive" onClick={() => {
              if (confirm(`Erase ability "${ab.name}"?`)) deleteAbility.mutate({ id: ab.id, charId: characterId });
            }}><Trash2 className="size-4" aria-hidden="true" /></Button>}
          </div>
        </li>)}
      </ul> : mode === "edit" && <p className="text-sm text-muted-foreground">No abilities attached yet.</p>}
    </GearSection>
  ) : null;

  const notesPicker = mode === "add" && type !== "currency" && <Dialog open={isNotesPickerOpen} onOpenChange={setIsNotesPickerOpen}>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" size="sm" title="Copy details from a Campaign Note into this form"><BookText className="size-3.5" aria-hidden="true" /> Fill from notes</Button>
    </DialogTrigger>
    <DialogContent className="z-[100] max-h-[75dvh] overflow-y-auto border-border bg-card p-5 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl text-primary">Choose an item note</DialogTitle>
        <DialogDescription>Copy details into this form. You can review them before saving.</DialogDescription>
      </DialogHeader>
      <GearField id={`${fieldId}-search`} label="Search item notes">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id={`${fieldId}-search`} type="search" value={pickerSearchQuery} onChange={e => setPickerSearchQuery(e.target.value)} className={`${inputClass} pl-9`} />
        </div>
      </GearField>
      {matchingNotes.length ? <ul className="space-y-2">
        {matchingNotes.map(note => <li key={note.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/40 bg-background/50 p-3">
          <div className="min-w-0 grow basis-32">
            <p className="break-words font-serif text-sm font-semibold">{note.title}</p>
            <p className="line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{note.content}</p>
          </div>
          <Button type="button" size="sm" variant="outline" aria-label={`Use note: ${note.title}`} onClick={() => handlePrepopulateFromNote(note)}>Use note</Button>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">{noteQuery ? "No item notes match your search." : "No item notes in Campaign Notes yet."}</p>}
    </DialogContent>
  </Dialog>;

  return (
    <Dialog open={isOpen} onOpenChange={open => {
      if (!open && savingAbility) return;
      if (!open && activePreview) { closeAbilityPreview(); return; }
      if (!open && activeBlueprint) {
        if (window.confirm("Close this equipment preview and discard its temporary draft?")) closeBlueprint();
        return;
      }
      onOpenChange(open);
    }}>
      <DialogContent className={previewBody ? previewAbilityDialogClass : gearDialogClass} onCloseAutoFocus={returnFocus ? event => { event.preventDefault(); returnFocus(); } : undefined}>
        <DialogHeader className={previewAbilityHeaderClass}>
          <DialogTitle ref={previewBody ? previewTitleRef : undefined} tabIndex={previewBody ? -1 : undefined} className={previewAbilityTitleClass}>
            {activeBlueprint ? "Equipment set preview" : activePreview ? `${activePreview.initial ? "Edit" : "New"} ${abilityOwnerType} ability` : `${mode === "add" ? "Add" : "Edit"} ${entryLabel}`}
          </DialogTitle>
          <DialogDescription>
            {activePreview ? previewEnabled ? `Ability draft for ${abilityPreviewOwner}. Closing returns to this entry without saving the draft.` : `${abilityPreviewOwner} · Save the ability without changing the gear details.`
              : activeBlueprint ? "Draft weapon pieces and their shared features without changing saved gear."
              : type === "currency" ? "Record this currency and its balance."
              : type === "equipment" ? "Set up a weapon, armor piece, or accessory."
              : "Record a general item and how many you carry."}
          </DialogDescription>
        </DialogHeader>

        {activeBlueprint ? <LocalEquipmentBlueprint key={blueprintOwnerKey} characterId={characterId} ownerName={characterName}
          seed={name.trim() ? { name, description, dtBonus: dtBonus === "" ? undefined : dtBonus, damageFormula: weaponRoll.trim() || undefined } : undefined}
          onClose={closeBlueprint} /> : activePreview ? previewEnabled ? <LocalAbilityDraft
          key={`${activePreview.ownerKey}:${activePreview.initial?.id ?? "new"}`}
          characterId={characterId}
          owner={{ kind: "item", name: abilityPreviewOwner, wielderName: characterName, equipment: type === "equipment" }}
          initial={activePreview.initial}
          onClose={closeAbilityPreview}
        /> : <OwnedItemAbilityEditor
          key={`${activePreview.ownerKey}:${activePreview.initial?.id ?? "new"}`}
          characterId={characterId} characterName={characterName} ownerName={abilityPreviewOwner}
          equipmentId={type === "equipment" ? initialData.id : null} inventoryItemId={type === "item" ? initialData.id : null}
          initialData={activePreview.initial} onClose={closeAbilityPreview} onPendingChange={setSavingAbility}
        /> : <form onSubmit={handleSave} className="flex min-h-0 flex-col">
          <div className="min-h-0 space-y-4 overflow-y-auto px-3 py-4 sm:px-4">
            <GearSection title={type === "currency" ? "Currency details" : "Details"}
              help={type === "currency" ? "Name the currency and enter its total balance. Existing currency names are fixed." : "Name the entry and describe what it is. General items also track the quantity you carry."}
              actions={notesPicker}>
              <div className={type === "equipment" ? "grid gap-3" : "grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)]"}>
                <GearField id={`${fieldId}-name`} label="Name">
                  <Input id={`${fieldId}-name`} value={name} onChange={e => setName(e.target.value)} placeholder={type === "currency" ? "e.g. Marks" : type === "equipment" ? "Equipment name" : "Item name"} required disabled={mode === "edit" && type === "currency"} className={inputClass} />
                </GearField>
                {type === "currency" && <GearField id={`${fieldId}-amount`} label="Balance">
                  <Input id={`${fieldId}-amount`} type="number" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} required className={formulaClass} />
                </GearField>}
                {type === "item" && <GearField id={`${fieldId}-quantity`} label="Quantity">
                  <Input id={`${fieldId}-quantity`} type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} required className={formulaClass} />
                </GearField>}
                {type !== "currency" && <div className="sm:col-span-full">
                  <GearField id={`${fieldId}-description`} label="Description">
                    <Textarea id={`${fieldId}-description`} value={description} onChange={e => setDescription(e.target.value)} placeholder="Appearance, details, or rules to reference at the table" className={`${inputClass} min-h-20`} />
                  </GearField>
                </div>}
              </div>
            </GearSection>

            {type === "equipment" && <>
              <GearSection title="Weapon roll" help="Enter the complete strike formula. Leave it blank for gear without a strike. Features with their own rolls belong under Equipment abilities.">
                <GearField id={`${fieldId}-weapon-roll`} label="Weapon roll formula" help="Include dice and any bonuses here. POW uses the score, POWm uses its rank modifier, and POWr rolls the attribute and adds its rank modifier. No bonus is added unless the formula includes one.">
                  <Input id={`${fieldId}-weapon-roll`} value={weaponRoll} onChange={e => setWeaponRoll(e.target.value)} placeholder="e.g. 2d6 + POWm" className={formulaClass} />
                </GearField>
              </GearSection>

              <GearSection title="Bonuses while equipped" help="These changes apply while the gear is equipped. DT adds to Damage Threshold; an attribute bonus changes the score used for that attribute's die and rank modifier.">
                <GearField id={`${fieldId}-dt`} label="Damage Threshold (DT) bonus" help="Enter a number or a static formula for extra DT. WIL uses the score; WILm uses the rank modifier. This field does not roll dice.">
                  <Input id={`${fieldId}-dt`} value={dtBonus} onChange={e => setDtBonus(e.target.value)} placeholder="e.g. 2 + WIL" className={`${formulaClass} sm:max-w-xs`} />
                </GearField>
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-medium">Attribute bonuses<SectionHelp label="Attribute bonuses">Enter a bonus or penalty for each score this gear changes. Leave unchanged attributes blank. Formulas here read base scores so equipment order doesn't change the result.</SectionHelp></legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {STATS_LIST.map(stat => <div key={stat} className="min-w-0 space-y-1 rounded-md border border-border/40 bg-background/40 p-2">
                      <label htmlFor={`${fieldId}-${stat}`} className="block text-center text-xs font-medium uppercase text-muted-foreground">{stat.slice(0, 3)}</label>
                      <Input id={`${fieldId}-${stat}`} aria-label={`${stat} bonus`} value={statModifiers[stat] ?? ""} onChange={e => handleStatModifierChange(stat, e.target.value)} className={`${formulaClass} h-8 text-center`} />
                    </div>)}
                  </div>
                </fieldset>
              </GearSection>
            </>}

            {abilityPanel}

            {blueprintOwnerKey && <GearSection title="Equipment set" help="Draft paired pieces and features that depend on using them together, such as Kharvask. Export a draft to keep working on it. It doesn't change saved gear."
              actions={<Button id={`${abilityButtonId}-blueprint`} type="button" variant="outline" size="sm" aria-label={previewEnabled ? "Preview equipment set" : "Open equipment set draft"} onClick={() => setBlueprintKey(blueprintOwnerKey)}>{previewEnabled ? "Open set preview" : "Open set draft"}</Button>} />}
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/40 bg-card p-3 sm:px-4">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm">{mode === "add" ? `Add ${entryLabel}` : "Save changes"}</Button>
          </footer>
        </form>}
      </DialogContent>
    </Dialog>
  );
}
