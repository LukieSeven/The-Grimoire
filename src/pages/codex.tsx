import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { 
  useListCodexNotes, 
  useCreateCodexNote, 
  useUpdateCodexNote, 
  useDeleteCodexNote,
  useListCharacters,
  useCreateNote
} from "@/hooks/useStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, BookOpen, MapPin, Sparkles, Feather, Trash2, 
  Plus, Upload, Download, ArrowLeft, Send, CheckCircle2 
} from "lucide-react";
import { toast } from "sonner";

export default function Codex() {
  const [, setLocation] = useLocation();
  
  // Storage Hooks
  const { data: codexNotes = [], isLoading } = useListCodexNotes();
  const createCodex = useCreateCodexNote();
  const updateCodex = useUpdateCodexNote();
  const deleteCodex = useDeleteCodexNote();
  const { data: characters = [] } = useListCharacters();
  const pushToCharacterNote = useCreateNote();

  // Component States
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  
  // Form Editor States
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("location");
  const [editTags, setEditTags] = useState("");

  // Push to Character States
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [noteToPush, setNoteToPush] = useState<any | null>(null);

  // File Import States
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Categories definition
  const categories = [
    { value: "all", label: "All Chronicles", icon: BookOpen },
    { value: "location", label: "Locations", icon: MapPin },
    { value: "npc", label: "NPCs & Factions", icon: Feather },
    { value: "lore", label: "Lore & Legends", icon: Sparkles },
    { value: "bestiary", label: "Bestiary", icon: AlertCircleShim },
  ];

  function AlertCircleShim(props: any) {
    return <Sparkles className="text-red-400" {...props} />;
  }

  // Filter notes
  const filteredNotes = codexNotes.filter(n => {
    const matchesSearch = 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      n.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = activeCategory === "all" || n.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Selected Note object
  const selectedNote = codexNotes.find(n => n.id === selectedNoteId) || filteredNotes[0] || null;

  // Set default selected note on load or category change
  React.useEffect(() => {
    if (filteredNotes.length > 0 && (!selectedNoteId || !codexNotes.some(n => n.id === selectedNoteId))) {
      setSelectedNoteId(filteredNotes[0].id);
    }
  }, [activeCategory, searchTerm]);

  // Handle Edit click
  const handleStartEdit = () => {
    if (!selectedNote) return;
    setEditTitle(selectedNote.title);
    setEditContent(selectedNote.content);
    setEditCategory(selectedNote.category);
    setEditTags(selectedNote.tags.join(", "));
    setIsEditing(true);
  };

  // Handle Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNote) return;
    
    const tagsArray = editTags
      .split(",")
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);

    updateCodex.mutate({
      id: selectedNote.id,
      data: {
        title: editTitle,
        content: editContent,
        category: editCategory,
        tags: tagsArray
      }
    }, {
      onSuccess: () => {
        setIsEditing(false);
        toast.success("Chronicle updated in the Codex!");
      }
    });
  };

  // Handle Start Add
  const handleStartAdd = () => {
    setEditTitle("");
    setEditContent("");
    setEditCategory(activeCategory === "all" ? "location" : activeCategory);
    setEditTags("");
    setIsAdding(true);
  };

  // Handle Save New
  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = editTags
      .split(",")
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);

    createCodex.mutate({
      title: editTitle,
      content: editContent,
      category: editCategory,
      tags: tagsArray,
      coordinates: null
    }, {
      onSuccess: (newNote) => {
        setIsAdding(false);
        setSelectedNoteId(newNote.id);
        toast.success("New chronicle forged in the Codex!");
      }
    });
  };

  // Handle Delete
  const handleDeleteNote = (id: number) => {
    if (confirm("Are you absolutely sure you want to erase this chronicle from the Codex?")) {
      deleteCodex.mutate({ id }, {
        onSuccess: () => {
          setSelectedNoteId(null);
          toast.success("Chronicle deleted from the Codex.");
        }
      });
    }
  };

  // Backup Export
  const handleExportBackup = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(codexNotes, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Veridia_Codex_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Codex backup file exported successfully.");
    } catch {
      toast.error("Failed to export Codex backup.");
    }
  };

  // Backup Import
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error("Format is not a JSON Array");
        
        let importCount = 0;
        let skipCount = 0;

        parsed.forEach((note: any) => {
          const exists = codexNotes.some(existing => existing.title.toLowerCase() === note.title.toLowerCase());
          if (exists) {
            skipCount++;
          } else {
            createCodex.mutate({
              title: note.title,
              content: note.content,
              category: note.category || "location",
              tags: note.tags || ["IMPORTED"],
              coordinates: note.coordinates || null
            });
            importCount++;
          }
        });

        toast.success(`Imported ${importCount} new chronicles. (Skipped ${skipCount} duplicates).`);
      } catch (err) {
        toast.error("Invalid backup file format. Must be a JSON file containing an array of notes.");
      }
    };
    reader.readAsText(file);
  };

  // Push to Character
  const handleOpenPushModal = (note: any) => {
    setNoteToPush(note);
    setIsPushModalOpen(true);
  };

  const handlePushToCharacter = (charId: number, charName: string) => {
    if (!noteToPush) return;
    
    // Add prefix indicating source
    const pushedContent = `${noteToPush.content}\n\n*Pushed from Veridia Codex lore registry.*`;
    
    pushToCharacterNote.mutate({
      characterId: charId,
      title: noteToPush.title,
      content: pushedContent,
      category: noteToPush.category === "bestiary" ? "bestiary" : "lore",
      tags: [...noteToPush.tags, "CODEX"]
    }, {
      onSuccess: () => {
        setIsPushModalOpen(false);
        setNoteToPush(null);
        toast.success(`Ported lore chronicle directly to ${charName}'s Campaign Notes!`);
      }
    });
  };

  return (
    <div className="relative min-h-[92vh] bg-[#0c0806] text-stone-100 flex flex-col font-serif select-none p-4 max-w-7xl mx-auto space-y-4">
      
      {styleBlock}

      {/* ── Top Header Controls ── */}
      <div className="flex items-center justify-between border-b border-border/20 pb-4 flex-wrap gap-4 mt-2">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/")} 
            className="text-stone-400 hover:text-stone-200 rounded-none cursor-pointer pl-0 font-serif"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Bookcase
          </Button>
          <div className="h-4 w-px bg-border/20" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-widest bg-gradient-to-r from-amber-500 to-yellow-200 bg-clip-text text-transparent drop-shadow-md">
              Veridia Codex
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-stone-500 uppercase mt-0.5">
              Campaign World Lore & Landmark Index
            </p>
          </div>
        </div>

        {/* Backup utilities */}
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".json,.map" 
            className="hidden" 
          />
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleImportClick}
            className="h-8 text-[10px] uppercase font-mono tracking-wider border-stone-800/80 hover:bg-stone-900/60 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all text-stone-400"
            title="Import Map file (.map) or Codex Backup (.json)"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" /> Import Map/Backup
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportBackup}
            className="h-8 text-[10px] uppercase font-mono tracking-wider border-stone-800/80 hover:bg-stone-900/60 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all text-stone-400"
            title="Export all Codex chronicles (.json)"
          >
            <Download className="w-3.5 h-3.5 text-amber-500" /> Export Backup
          </Button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[70vh]">
        
        {/* Left Column (Search, Categories, and Note Cards) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              type="text" 
              placeholder="Search chronicles, tags, locations..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-stone-950/40 border-stone-800/80 text-stone-200 text-xs font-serif rounded-md h-9 focus-visible:ring-amber-600/45 focus-visible:border-amber-600/40"
            />
          </div>

          {/* Categories select row */}
          <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-thin border-b border-border/10">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setActiveCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider font-mono border rounded-none whitespace-nowrap transition-all cursor-pointer ${
                    isActive 
                      ? "bg-amber-950/20 border-amber-600/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)]" 
                      : "bg-transparent border-stone-900 text-stone-400 hover:border-stone-800 hover:text-stone-300"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cat.label.split(" ")[0]}
                </button>
              );
            })}
          </div>

          {/* Notes Cards List */}
          <div className="flex-1 overflow-y-auto max-h-[58vh] lg:max-h-[64vh] pr-1.5 space-y-2.5">
            <div className="flex justify-between items-center px-1 mb-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">
                Matches: {filteredNotes.length}
              </span>
              <Button 
                onClick={handleStartAdd}
                size="sm" 
                className="h-6 text-[10px] uppercase font-mono tracking-widest bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-none px-2 cursor-pointer"
              >
                <Plus className="w-3 h-3 mr-1" /> Add Entry
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-xs text-stone-500 italic">Consulting the archives...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-12 text-xs text-stone-500 italic bg-stone-950/10 border border-dashed border-stone-900 rounded-lg">
                No entries match the query in Veridia Codex.
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = selectedNote?.id === note.id;
                return (
                  <Card 
                    key={note.id}
                    onClick={() => { setSelectedNoteId(note.id); setIsEditing(false); setIsAdding(false); }}
                    className={`border transition-all cursor-pointer hover:border-amber-600/20 hover:bg-stone-900/10 rounded-none shadow-sm ${
                      isSelected 
                        ? "bg-amber-950/[0.04] border-amber-600/40 shadow-inner" 
                        : "bg-stone-950/15 border-stone-900/60"
                    }`}
                  >
                    <CardContent className="p-3.5 space-y-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={`text-sm font-bold leading-tight ${isSelected ? "text-amber-400" : "text-stone-300"}`}>
                          {note.title}
                        </h4>
                        <span className="text-[7px] uppercase font-mono tracking-wider px-1 py-0.25 border border-stone-800 rounded bg-stone-900/40 text-stone-400">
                          {note.category}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-stone-400/90 font-serif leading-relaxed line-clamp-2">
                        {note.content}
                      </p>

                      {note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {note.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="text-[8px] font-mono text-amber-500/60 font-semibold uppercase">
                              #{tag}
                            </span>
                          ))}
                          {note.tags.length > 3 && (
                            <span className="text-[8px] font-mono text-stone-500 font-semibold">
                              +{note.tags.length - 3}
                            </span>
                          )}
                          {note.coordinates && (
                            <span className="text-[8px] font-mono text-teal-400/60 font-bold ml-auto flex items-center gap-0.5">
                              {note.coordinates.label} Coord
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (Parchement View / Add / Edit Forms) */}
        <div className="lg:col-span-8 flex flex-col min-h-[480px]">
          {isAdding || isEditing ? (
            /* Forge/Edit Entry Form */
            <form onSubmit={isAdding ? handleSaveNew : handleSaveEdit} className="flex-1 bg-[#120e0a] border border-amber-900/30 p-6 shadow-2xl flex flex-col justify-between text-xs max-w-3xl mx-auto w-full relative">
              <div className="absolute inset-1 border border-amber-950/15 pointer-events-none" />
              <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-amber-900/10 pointer-events-none" />

              <div className="space-y-4 flex-1">
                <h3 className="text-base font-bold text-amber-500 border-b border-amber-900/30 pb-2">
                  {isAdding ? "Forge New Chronicle" : `Re-write: ${selectedNote?.title}`}
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block font-bold">Chronicle Title</label>
                    <Input 
                      value={editTitle} 
                      onChange={e => setEditTitle(e.target.value)} 
                      required 
                      placeholder="e.g. Mount Troyzan" 
                      className="bg-stone-950 border-stone-900 rounded-none h-8 text-xs font-serif text-stone-200 focus-visible:ring-amber-600/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block font-bold">Category</label>
                    <select
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-900 h-8 rounded-none px-2 text-xs font-serif text-stone-200 focus:outline-none focus:border-amber-600/40"
                    >
                      <option value="location">Location</option>
                      <option value="npc">NPC & Faction</option>
                      <option value="lore">Lore & Legend</option>
                      <option value="bestiary">Bestiary</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block font-bold">Tags (Comma separated)</label>
                  <Input 
                    value={editTags} 
                    onChange={e => setEditTags(e.target.value)} 
                    placeholder="e.g. POI, VOLCANO, DANGER" 
                    className="bg-stone-950 border-stone-900 rounded-none h-8 text-xs font-serif text-stone-200 focus-visible:ring-amber-600/40"
                  />
                </div>

                <div className="space-y-1 flex-1 flex flex-col">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block font-bold mb-1">Chronicle Contents / Lore</label>
                  <Textarea 
                    value={editContent} 
                    onChange={e => setEditContent(e.target.value)} 
                    required 
                    placeholder="Record what is written in the legends, or describe the landmarks..." 
                    className="bg-stone-950 border-stone-900 rounded-none flex-1 min-h-[220px] text-xs font-serif leading-relaxed text-stone-200 focus-visible:ring-amber-600/40"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-amber-900/30 mt-4">
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setIsEditing(false); setIsAdding(false); }}
                  className="rounded-none hover:bg-stone-900 text-stone-400 font-serif"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  size="sm" 
                  className="bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-none font-serif px-4 cursor-pointer"
                >
                  Forge Entry
                </Button>
              </div>
            </form>
          ) : selectedNote ? (
            /* Parchment Read View */
            <div className="flex-1 bg-[#16110c] border border-amber-900/45 p-7 shadow-2xl relative flex flex-col justify-between parchment-glow w-full max-w-3xl mx-auto animate-in fade-in duration-300">
              {/* Decorative border overlays */}
              <div className="absolute inset-1.5 border border-amber-950/20 pointer-events-none" />
              <div className="absolute top-3.5 left-3.5 right-3.5 bottom-3.5 border border-dashed border-amber-900/15 pointer-events-none" />

              {/* Chronicle Header */}
              <div className="space-y-3 z-10 border-b border-amber-900/20 pb-4">
                <div className="flex justify-between items-baseline flex-wrap gap-2">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-amber-500 tracking-wide leading-tight">
                    {selectedNote.title}
                  </h2>
                  
                  <span className="text-[9px] uppercase font-mono tracking-widest px-2 py-0.5 border border-amber-900/40 rounded bg-amber-950/20 text-amber-400">
                    {selectedNote.category}
                  </span>
                </div>

                {selectedNote.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {selectedNote.tags.map((tag, idx) => (
                      <span key={idx} className="text-[9px] font-mono bg-amber-950/15 border border-amber-900/30 text-amber-500/80 px-2 py-0.5 rounded-none font-semibold uppercase tracking-wider">
                        #{tag}
                      </span>
                    ))}
                    {selectedNote.coordinates && (
                      <span className="text-[9px] font-mono text-teal-400 font-semibold border border-teal-900/40 px-2 py-0.5 rounded-none bg-teal-950/10 flex items-center gap-1.5 ml-auto">
                        <MapPin className="w-3 h-3 text-teal-400" />
                        Coord: X: {selectedNote.coordinates.x.toFixed(0)}, Y: {selectedNote.coordinates.y.toFixed(0)} ({selectedNote.coordinates.label})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Chronicle Description scroll block */}
              <div className="flex-1 overflow-y-auto font-serif text-sm leading-relaxed text-stone-200/90 py-6 pr-2 whitespace-pre-wrap select-text max-h-[38vh] min-h-[220px]">
                {selectedNote.content || <em className="text-stone-500">No chronicle notes exist. Edit to add lore.</em>}
              </div>

              {/* Bottom Actions Row */}
              <div className="border-t border-amber-900/20 pt-4 flex justify-between items-center mt-4">
                <Button
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  variant="ghost" 
                  size="sm" 
                  className="text-stone-500 hover:text-red-400 hover:bg-red-950/10 h-8 rounded-none cursor-pointer font-serif"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Erase
                </Button>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleStartEdit}
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-serif border border-stone-850 hover:bg-stone-900 text-stone-400 hover:text-stone-200 rounded-none px-3.5 font-bold cursor-pointer"
                  >
                    Edit Note
                  </Button>
                  
                  <Button 
                    onClick={() => handleOpenPushModal(selectedNote)}
                    size="sm" 
                    className="h-8 text-xs font-serif bg-amber-600 hover:bg-amber-500 text-stone-950 px-4 font-bold rounded-none flex items-center gap-1.5 cursor-pointer shadow-md"
                    title="Push this coordinate/lore note directly to a character notes sheet"
                  >
                    <Send className="w-3.5 h-3.5 text-stone-900" /> Push to Character
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 border border-dashed border-stone-900 flex flex-col justify-center items-center p-12 text-center max-w-3xl mx-auto w-full rounded-lg bg-stone-950/10">
              <BookOpen className="w-8 h-8 text-stone-700 mb-2 animate-pulse" />
              <p className="text-xs text-stone-500 italic max-w-xs leading-relaxed font-serif">
                Select a chronicle from the index on the left to consult its details, or compile a new landmark entry.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Push to Character Modal dialog ── */}
      <Dialog open={isPushModalOpen} onOpenChange={setIsPushModalOpen}>
        <DialogContent className="sm:max-w-[420px] bg-[#120d09] border border-amber-900/35 text-stone-100 p-6 rounded-none relative">
          <div className="absolute inset-1 border border-amber-950/15 pointer-events-none" />
          <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-amber-900/10 pointer-events-none" />

          <DialogHeader className="border-b border-amber-900/20 pb-3">
            <DialogTitle className="font-serif text-lg font-bold text-amber-500 flex items-center gap-2">
              <Send className="w-4 h-4" /> Port Lore to Hero
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-3 text-xs text-stone-400 font-serif leading-relaxed">
            Copying <strong className="text-stone-200">\"{noteToPush?.title}\"</strong> into the selected character's private **Campaign Notes** log. Choose which active hero receives this registry:
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {characters.length === 0 ? (
              <p className="text-xs italic text-stone-600 text-center py-4 font-serif">No active characters registered in the Grimoire.</p>
            ) : (
              characters.map(char => (
                <button
                  key={char.id}
                  onClick={() => handlePushToCharacter(char.id, char.name)}
                  className="w-full flex items-center justify-between p-2.5 border border-stone-900 hover:border-amber-600/30 bg-stone-950/30 hover:bg-amber-950/[0.04] transition-all text-stone-300 hover:text-amber-400 text-xs font-serif font-bold text-left rounded-none cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {char.avatar ? (
                      <img src={char.avatar} alt={char.name} className="w-5 h-5 rounded-full object-cover border border-stone-800" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-stone-900 flex items-center justify-center text-[9px] text-stone-400 uppercase font-mono">
                        {char.name.charAt(0)}
                      </span>
                    )}
                    {char.name}
                  </span>
                  <span className="text-[9px] text-stone-500 uppercase font-mono tracking-wider font-normal">
                    {char.race} · Level {char.level}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-amber-900/20 mt-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setIsPushModalOpen(false); setNoteToPush(null); }} 
              className="rounded-none text-stone-500 font-serif hover:bg-stone-900"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Styling classes block for the scrollbar/etc
const styleBlock = (
  <style>{`
    .parchment-glow {
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.85),
                  0 0 40px 2px rgba(217, 119, 6, 0.08);
    }
    .scrollbar-thin::-webkit-scrollbar {
      height: 4px;
      width: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
      background: transparent;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
      background: #2c1d14;
      border-radius: 2px;
    }
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
      background: #4a2e20;
    }
  `}</style>
);
