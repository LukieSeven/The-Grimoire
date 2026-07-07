import React, { useState, useEffect } from "react";
import {
  useAddEquipment, useUpdateEquipment,
  useAddCurrency, useUpdateCurrency,
  useAddInventoryItem, useUpdateInventoryItem,
  useListNotes, useCreateNote,
  useListAbilities, useDeleteAbility
} from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, BookText, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  characterId: number;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  type: "currency" | "equipment" | "item";
  initialData?: any;
  onAddAbilityClick?: (eqId: number | null, invItemId: number | null) => void;
  onEditAbilityClick?: (ability: any) => void;
}

const STATS_LIST = ["power", "vitality", "spirit", "agility", "endurance", "precision", "willpower", "charisma"];

export function EditInventoryDialog({
  characterId,
  isOpen,
  onOpenChange,
  mode,
  type,
  initialData,
  onAddAbilityClick,
  onEditAbilityClick
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

  // Searchable Notes Picker states
  const [isNotesPickerOpen, setIsNotesPickerOpen] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");

  const handlePrepopulateFromNote = (note: any) => {
    setName(note.title);
    const content = note.content || "";
    const descMatch = content.match(/Description:\s*(.*)/);
    const diceMatch = content.match(/Dice:\s*(.*)/);
    const modMatch = content.match(/Modifier:\s*(.*)/);
    const dtMatch = content.match(/DT Bonus:\s*(\d+)/);
    const statsMatch = content.match(/Stat Modifiers:\s*(.*)/);

    if (descMatch) {
      setDescription(descMatch[1].trim());
    } else {
      setDescription(content);
    }

    if (type === "equipment") {
      if (diceMatch) setDiceType(diceMatch[1].trim() === "None" ? "" : diceMatch[1].trim());
      if (modMatch) setModifier(modMatch[1].trim() === "None" ? "" : modMatch[1].trim());
      if (dtMatch) setDtBonus(Number(dtMatch[1]));
      if (statsMatch) {
        try {
          const parsed = JSON.parse(statsMatch[1].trim());
          if (parsed && typeof parsed === "object") {
            setStatModifiers(parsed);
          }
        } catch (e) {
          // ignore invalid json
        }
      }
    }
    setIsNotesPickerOpen(false);
    toast.success(`Pre-populated details from note: "${note.title}"`);
  };

  // General Form States
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Currency State
  const [amount, setAmount] = useState(0);

  // Item State
  const [quantity, setQuantity] = useState(1);

  // Equipment State
  const [dtBonus, setDtBonus] = useState(0);
  const [diceType, setDiceType] = useState("");
  const [modifier, setModifier] = useState("");
  const [equipped, setEquipped] = useState(false);
  const [assignedToQuickRolls, setAssignedToQuickRolls] = useState(false);
  
  // Stat Modifiers for equipment: key-value map
  const [statModifiers, setStatModifiers] = useState<Record<string, number>>({});

  // Sync state when dialog opens or edits
  useEffect(() => {
    if (isOpen) {
      if (mode === "edit" && initialData) {
        setName(initialData.name || "");
        setDescription(initialData.description || "");
        setAmount(initialData.amount || 0);
        setQuantity(initialData.quantity || 1);
        setDtBonus(initialData.dtBonus || 0);
        setDiceType(initialData.diceType || "");
        setModifier(initialData.modifier !== undefined ? String(initialData.modifier) : "");
        setEquipped(!!initialData.equipped);
        setAssignedToQuickRolls(!!initialData.assignedToQuickRolls);
        setStatModifiers(initialData.statModifiers || {});
      } else {
        // Reset to defaults for add mode
        setName("");
        setDescription("");
        setAmount(0);
        setQuantity(1);
        setDtBonus(0);
        setDiceType("");
        setModifier("");
        setEquipped(false);
        setAssignedToQuickRolls(false);
        setStatModifiers({});
      }
    }
  }, [isOpen, mode, type, initialData]);

  const handleStatModifierChange = (stat: string, val: number) => {
    setStatModifiers(prev => {
      const next = { ...prev };
      if (val === 0) {
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
      noteContent += `\nModifier: ${extraFields.modifier || "None"}`;
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
      if (mode === "add") {
        const extra = { diceType, modifier, dtBonus, statModifiers };
        addEquipment.mutate({
          characterId,
          name,
          description,
          equipped,
          assignedToQuickRolls,
          dtBonus,
          statModifiers,
          diceType: diceType || undefined,
          modifier: diceType ? modifier : "",
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
            diceType: diceType || undefined,
            modifier: diceType ? modifier : "",
          },
        }, { onSuccess: () => onOpenChange(false) });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none p-6">
        <div className="absolute inset-1 border border-border/10 pointer-events-none" />
        <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

        <DialogHeader className="border-b border-border/30 pb-2 z-10 relative">
          <DialogTitle className="font-serif text-2xl text-primary font-bold">
            {mode === "add" ? `Add ${type.toUpperCase()}` : `Edit ${type.toUpperCase()}`}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 mt-4 text-xs font-sans z-10 relative">
          
          {/* Add from Notes picker trigger */}
          {mode === "add" && (
            <div className="mb-2">
              <Dialog open={isNotesPickerOpen} onOpenChange={setIsNotesPickerOpen}>
                <DialogTrigger asChild>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full flex items-center justify-center gap-1.5 border-primary/45 text-primary hover:bg-primary/5 rounded-none font-bold uppercase tracking-wider font-mono h-8 text-[10px]"
                  >
                    <BookText className="w-3.5 h-3.5" /> Add from Notes
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px] max-h-[75vh] overflow-y-auto bg-card border border-border shadow-2xl p-5 rounded-none z-[100]">
                  <div className="absolute inset-1 border border-border/10 pointer-events-none" />
                  <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

                  <DialogHeader className="border-b border-border/30 pb-2 z-10 relative">
                    <DialogTitle className="font-serif text-xl text-primary font-bold">
                      Select Item from Campaign Notes
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4 font-sans text-xs z-10 relative">
                    {/* Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search items by name/description..."
                        value={pickerSearchQuery}
                        onChange={(e) => setPickerSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs rounded-none bg-background border-border/60"
                      />
                    </div>

                    {/* Scrollable list of item notes */}
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {notes && notes.filter(n => n.category === "item" && (
                        pickerSearchQuery.trim() === "" ||
                        n.title.toLowerCase().includes(pickerSearchQuery.toLowerCase()) ||
                        n.content.toLowerCase().includes(pickerSearchQuery.toLowerCase())
                      )).length > 0 ? (
                        notes.filter(n => n.category === "item" && (
                          pickerSearchQuery.trim() === "" ||
                          n.title.toLowerCase().includes(pickerSearchQuery.toLowerCase()) ||
                          n.content.toLowerCase().includes(pickerSearchQuery.toLowerCase())
                        )).map((note) => (
                          <div key={note.id} className="p-3 bg-background/50 hover:bg-accent/30 border border-border/40 hover:border-primary/40 transition-all flex justify-between items-start gap-4">
                            <div className="min-w-0 flex-1">
                              <h5 className="font-serif font-bold text-foreground truncate">{note.title}</h5>
                              <p className="text-[10px] text-muted-foreground/80 font-serif line-clamp-2 mt-0.5 whitespace-pre-wrap">{note.content}</p>
                            </div>
                            <Button 
                              type="button" 
                              size="sm" 
                              onClick={() => handlePrepopulateFromNote(note)}
                              className="h-6 text-[10px] bg-primary text-primary-foreground rounded-none px-2.5"
                            >
                              Import
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground/60 italic font-serif text-center py-6">
                          {notes && notes.filter(n => n.category === "item").length > 0 
                            ? "No item notes match your search query." 
                            : "No Campaign Notes exist in the 'Item' category yet."}
                        </p>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Common name input */}
          <div>
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={type === "currency" ? "Gold, Silver, etc." : "Item name"}
              required 
              disabled={mode === "edit" && type === "currency"} // Block renaming currency on edit
              className="bg-background rounded-none h-9 text-xs" 
            />
          </div>

          {/* Currency specific fields */}
          {type === "currency" && (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Amount</label>
              <Input type="number" min={0} value={amount} onChange={e => setAmount(Number(e.target.value))} required className="bg-background font-mono rounded-none h-9 text-xs" />
            </div>
          )}

          {/* General item specific fields */}
          {type === "item" && (
            <>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Quantity</label>
                <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} required className="bg-background font-mono rounded-none h-9 text-xs" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Item details..." className="bg-background font-serif rounded-none min-h-[70px]" />
              </div>
            </>
          )}

          {/* Equipment specific fields */}
          {type === "equipment" && (
            <>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Armor, weapon, or accessory details..." className="bg-background font-serif rounded-none min-h-[70px]" />
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border/20 pt-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">DT Bonus</label>
                  <Input type="number" min={0} value={dtBonus} onChange={e => setDtBonus(Number(e.target.value))} required className="bg-background font-mono rounded-none h-9 text-xs" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Weapon Damage Die</label>
                  <Input value={diceType} onChange={e => setDiceType(e.target.value)} placeholder="e.g. d8, d10" className="bg-background font-mono rounded-none h-9 text-xs" />
                </div>
              </div>

              {diceType && (
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Weapon Modifier (e.g. +2, POWr+6)</label>
                  <Input value={modifier} onChange={e => setModifier(e.target.value)} required className="bg-background font-mono rounded-none h-9 text-xs" />
                </div>
              )}

              {/* Stat Modifiers section */}
              <div className="border-t border-border/20 pt-3">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-2 font-serif">Stat Modifiers</label>
                <div className="grid grid-cols-4 gap-2">
                  {STATS_LIST.map((stat) => {
                    const currentVal = statModifiers[stat] || 0;
                    return (
                      <div key={stat} className="bg-background/40 p-1 rounded border border-border/40 text-center">
                        <label className="text-[8px] font-bold text-stone-500 uppercase block mb-0.5">{stat.substring(0,3)}</label>
                        <Input 
                          type="number" 
                          value={currentVal} 
                          onChange={(e) => handleStatModifierChange(stat, Number(e.target.value))} 
                          className="h-7 text-center font-mono bg-background text-xs rounded-none" 
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Integrated Item Abilities Management */}
          {mode === "edit" && type !== "currency" && initialData && (
            <div className="border-t border-border/30 pt-4 mt-3 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-primary uppercase tracking-widest block font-serif">Item Abilities</label>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    const eqId = type === "equipment" ? initialData.id : null;
                    const invItemId = type === "item" ? initialData.id : null;
                    onAddAbilityClick?.(eqId, invItemId);
                  }}
                  className="h-6 text-[9px] uppercase font-mono tracking-wider border-primary/45 text-primary hover:bg-primary/5 rounded-none"
                >
                  + Add Ability
                </Button>
              </div>
              {(() => {
                const itemAbilities = abilities.filter(a => 
                  (type === "equipment" && a.equipmentId === initialData.id) ||
                  (type === "item" && a.inventoryItemId === initialData.id)
                );
                if (itemAbilities.length === 0) {
                  return <p className="text-[11px] text-muted-foreground/60 italic font-serif pl-1">No abilities attached to this item.</p>;
                }
                return (
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {itemAbilities.map(ab => (
                      <div key={ab.id} className="flex justify-between items-center bg-background/50 border border-border/40 p-2 text-xs">
                        <div className="min-w-0 flex-1 pr-2">
                          <span className="font-serif font-bold text-foreground block truncate">{ab.name}</span>
                          {ab.description && <span className="text-[10px] text-muted-foreground/80 block line-clamp-1 truncate font-serif">{ab.description}</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditAbilityClick?.(ab)}
                            className="h-6 w-6 text-primary hover:bg-primary/10 rounded-none cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Erase ability "${ab.name}"?`)) {
                                deleteAbility.mutate({ id: ab.id, charId: characterId });
                              }
                            }}
                            className="h-6 w-6 text-destructive hover:bg-destructive/10 rounded-none cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border/30 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-none">Cancel</Button>
            <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-none">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
