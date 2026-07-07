import React, { useState } from "react";
import { useListSkills, useAddSkill, useUpdateSkill, useDeleteSkill } from "@/hooks/useStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2 } from "lucide-react";

interface Props {
  characterId: number;
}

export function EditSkillsDialog({ characterId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: skills } = useListSkills(characterId);
  const addSkill = useAddSkill();
  const updateSkill = useUpdateSkill();
  const deleteSkill = useDeleteSkill();

  // Mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [value, setValue] = useState(1);
  const [category, setCategory] = useState("");

  const resetForm = () => {
    setName("");
    setValue(1);
    setCategory("");
    setEditingId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setMode("add");
  };

  const handleOpenEdit = (skill: any) => {
    setEditingId(skill.id);
    setName(skill.name);
    setValue(skill.value);
    setCategory(skill.category || "");
    setMode("edit");
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalCategory = category.trim() || null;

    if (mode === "add") {
      addSkill.mutate({
        characterId,
        name,
        value,
        training: 0,
        category: finalCategory,
      }, {
        onSuccess: () => setMode("list"),
      });
    } else if (mode === "edit" && editingId) {
      updateSkill.mutate({
        id: editingId,
        data: {
          name,
          value,
          category: finalCategory,
        },
      }, {
        onSuccess: () => setMode("list"),
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this custom skill?")) {
      deleteSkill.mutate({ id, charId: characterId });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) setMode("list"); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 font-serif text-sm">
          Edit Skills
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[75vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-none p-6">
        <div className="absolute inset-1 border border-border/10 pointer-events-none" />
        <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

        <DialogHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between z-10 relative">
          <DialogTitle className="font-serif text-2xl text-primary font-bold">
            {mode === "list" && "Custom Skills"}
            {mode === "add" && "Create Custom Skill"}
            {mode === "edit" && "Modify Custom Skill"}
          </DialogTitle>
          {mode === "list" && (
            <Button size="sm" onClick={handleOpenAdd} className="bg-primary text-primary-foreground font-serif">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Skill
            </Button>
          )}
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-3 mt-4 z-10 relative">
            {skills && skills.length > 0 ? (
              <div className="divide-y divide-border/40 max-h-[45vh] overflow-y-auto pr-1">
                {skills.map((skill) => (
                  <div key={skill.id} className="py-2.5 flex justify-between items-center group">
                    <div className="font-serif text-base text-foreground font-semibold flex items-center gap-2 flex-wrap">
                      <span>{skill.name}</span>
                      <span className="font-mono text-primary font-bold">-{skill.value}</span>
                      {skill.category && (
                        <span className="text-[8px] font-mono bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 uppercase tracking-wider font-semibold">
                          {skill.category}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(skill)} className="h-8 w-8 text-primary hover:bg-primary/10 rounded-none">
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(skill.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-none">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground font-serif italic">
                No custom skills registered. Add skills like Beastial, Stealth, or Lore.
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 mt-4 text-xs font-sans z-10 relative">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Skill Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Beast Handling, Arcana" className="bg-background rounded-none h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Starting Skill Value</label>
                <Input type="number" min={1} max={30} value={value} onChange={e => setValue(Math.min(30, Math.max(1, Number(e.target.value))))} required className="bg-background font-mono rounded-none h-9" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Category / Group (Optional)</label>
                <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Languages, Faunology" className="bg-background rounded-none h-9" />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border/30 pt-4">
              <Button type="button" variant="ghost" onClick={() => setMode("list")} className="rounded-none">Back</Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-serif rounded-none">
                {mode === "add" ? "Add Skill" : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
