import React, { useState, useRef, useEffect } from "react";
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
  Plus, Upload, Download, ArrowLeft, Send, ChevronDown, ChevronRight, BookMarked
} from "lucide-react";
import { toast } from "sonner";

// Taxonomy Configuration matching requested tiered hierarchy
const TAXONOMY = [
  {
    value: "world",
    label: "WORLD",
    icon: "🌍",
    subcategories: [
      { value: "world-veridia", label: "Veridia" },
      { value: "world-regions", label: "Regions" },
      { value: "world-kingdoms", label: "Kingdoms" },
      { value: "world-cities", label: "Cities" },
      { value: "world-settlements", label: "Settlements" },
      { value: "world-landmarks", label: "Landmarks" },
      { value: "world-biomes", label: "Biomes" },
      { value: "world-planes", label: "Planes" }
    ]
  },
  {
    value: "entities",
    label: "ENTITIES",
    icon: "👤",
    subcategories: [
      { value: "entities-characters", label: "Characters" },
      { value: "entities-pcs", label: "Player Characters" },
      { value: "entities-npcs", label: "NPCs" },
      { value: "entities-notable", label: "Notable Figures" },
      { value: "entities-organizations", label: "Organizations" },
      { value: "entities-governments", label: "Governments" },
      { value: "entities-guilds", label: "Guilds" },
      { value: "entities-religions", label: "Religions" },
      { value: "entities-military", label: "Military Factions" }
    ]
  },
  {
    value: "bestiary",
    label: "BESTIARY",
    icon: "🧩",
    subcategories: [
      { value: "bestiary-creatures", label: "Creatures" },
      { value: "bestiary-beasts", label: "Beasts" },
      { value: "bestiary-monsters", label: "Monsters" },
      { value: "bestiary-mythical", label: "Mythical Entities" },
      { value: "bestiary-bosses", label: "Bosses / Named Threats" }
    ]
  },
  {
    value: "systems",
    label: "SYSTEMS",
    icon: "⚔️",
    subcategories: [
      { value: "systems-essences", label: "Essences" },
      { value: "systems-scripts", label: "Scripts (God-Languages)" },
      { value: "systems-ranks", label: "Ranks (Iron → Diamond)" },
      { value: "systems-combat", label: "Combat Rules" },
      { value: "systems-status", label: "Status Effects" },
      { value: "systems-mechanics", label: "Mechanics Reference" }
    ]
  },
  {
    value: "items",
    label: "ITEMS",
    icon: "🧳",
    subcategories: [
      { value: "items-equipment", label: "Equipment" },
      { value: "items-weapons", label: "Weapons" },
      { value: "items-armor", label: "Armor" },
      { value: "items-tools", label: "Tools" },
      { value: "items-artifacts", label: "Artifacts" },
      { value: "items-consumables", label: "Consumables" },
      { value: "items-magic", label: "Magical Items" }
    ]
  },
  {
    value: "maps",
    label: "MAPS",
    icon: "🗺️",
    subcategories: [
      { value: "maps-world", label: "World Map" },
      { value: "maps-regional", label: "Regional Maps" },
      { value: "maps-city", label: "City Maps" },
      { value: "maps-dungeons", label: "Dungeons" },
      { value: "maps-poi", label: "Points of Interest Layers" }
    ]
  },
  {
    value: "lore",
    label: "LORE / ARCHIVES",
    icon: "📖",
    subcategories: [
      { value: "lore-events", label: "Historical Events" },
      { value: "lore-wars", label: "Wars" },
      { value: "lore-conquests", label: "Conquests" },
      { value: "lore-cataclysms", label: "Cataclysms" },
      { value: "lore-myths", label: "Myths & Legends" },
      { value: "lore-texts", label: "Ancient Texts" },
      { value: "lore-prophecies", label: "Prophecies" },
      { value: "lore-doctrine", label: "Religious Doctrine" }
    ]
  },
  {
    value: "glossary",
    label: "THE GLOSSARY",
    icon: "📒",
    subcategories: [
      { value: "glossary-terms", label: "Terms" },
      { value: "glossary-names", label: "Names" },
      { value: "glossary-concepts", label: "Codified Concepts" },
      { value: "glossary-crossrefs", label: "Cross-references" }
    ]
  }
];

export default function Codex() {
  const [, setLocation] = useLocation();
  
  // Storage hooks
  const { data: codexNotes = [], isLoading } = useListCodexNotes();
  const createCodex = useCreateCodexNote();
  const updateCodex = useUpdateCodexNote();
  const deleteCodex = useDeleteCodexNote();
  const { data: characters = [] } = useListCharacters();
  const pushToCharacterNote = useCreateNote();

  // Component Search & Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  
  // Track expanded parent tabs in the left sidebar
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({
    world: true,
    entities: false,
    bestiary: false
  });

  // Editor states
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("world");
  const [editSubcategory, setEditSubcategory] = useState("world-cities");
  const [editTags, setEditTags] = useState("");

  // Push to Character States
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [noteToPush, setNoteToPush] = useState<any | null>(null);

  // File Import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toggle Parent collapse
  const toggleParent = (parentVal: string) => {
    setExpandedParents(prev => ({ ...prev, [parentVal]: !prev[parentVal] }));
  };

  // Filter notes based on hierarchy selection & search query
  const filteredNotes = codexNotes.filter(n => {
    // 1. Unconditionally hide raw "Random encounters"
    if (n.title.toLowerCase().includes("random encounter")) return false;

    // 2. Keyword Search filter
    const matchesSearch = 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      n.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.tags && n.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
    
    if (!matchesSearch) return false;

    // 3. Hierarchical Category/Subcategory filter
    if (selectedSubcategory !== "all") {
      return n.subcategory === selectedSubcategory;
    } else if (selectedCategory !== "all") {
      return n.category === selectedCategory;
    }
    
    return true;
  });

  // Selected Note fallback
  const selectedNote = codexNotes.find(n => n.id === selectedNoteId) || filteredNotes[0] || null;

  // Auto-align selected note on search/navigation change
  useEffect(() => {
    if (filteredNotes.length > 0) {
      const exists = filteredNotes.some(n => n.id === selectedNoteId);
      if (!exists) {
        setSelectedNoteId(filteredNotes[0].id);
      }
    } else {
      setSelectedNoteId(null);
    }
  }, [selectedCategory, selectedSubcategory, searchTerm]);

  // Handle Edit Click
  const handleStartEdit = () => {
    if (!selectedNote) return;
    setEditTitle(selectedNote.title);
    setEditContent(selectedNote.content);
    setEditCategory(selectedNote.category || "world");
    setEditSubcategory(selectedNote.subcategory || "world-cities");
    setEditTags(selectedNote.tags ? selectedNote.tags.join(", ") : "");
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
        subcategory: editSubcategory,
        tags: tagsArray
      }
    }, {
      onSuccess: () => {
        setIsEditing(false);
        toast.success("Chronicle revised in the Codex!");
      }
    });
  };

  // Handle Add Click
  const handleStartAdd = () => {
    setEditTitle("");
    setEditContent("");
    setEditCategory(selectedCategory === "all" ? "world" : selectedCategory);
    setEditSubcategory(selectedSubcategory === "all" ? "world-cities" : selectedSubcategory);
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
      subcategory: editSubcategory,
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
          toast.success("Chronicle erased from the archives.");
        }
      });
    }
  };

  // Export JSON
  const handleExportBackup = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(codexNotes, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Veridia_Codex_Backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Codex backup exported.");
    } catch {
      toast.error("Failed to export Codex backup.");
    }
  };

  // Import JSON
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
              category: note.category || "world",
              subcategory: note.subcategory || "world-landmarks",
              tags: note.tags || ["IMPORTED"],
              coordinates: note.coordinates || null
            });
            importCount++;
          }
        });

        toast.success(`Imported ${importCount} new chronicles. (Skipped ${skipCount} duplicates).`);
      } catch (err) {
        toast.error("Invalid file format. Import requires a JSON array of notes.");
      }
    };
    reader.readAsText(file);
  };

  // Push to Character Notes tab
  const handleOpenPushModal = (note: any) => {
    setNoteToPush(note);
    setIsPushModalOpen(true);
  };

  const handlePushToCharacter = (charId: number, charName: string) => {
    if (!noteToPush) return;
    const pushedContent = `${noteToPush.content}\n\n*Pushed from Veridia Codex lore archives (${noteToPush.category}/${noteToPush.subcategory}).*`;
    
    pushToCharacterNote.mutate({
      characterId: charId,
      title: noteToPush.title,
      content: pushedContent,
      category: noteToPush.category === "bestiary" ? "bestiary" : "lore",
      tags: [...(noteToPush.tags || []), "CODEX"]
    }, {
      onSuccess: () => {
        setIsPushModalOpen(false);
        setNoteToPush(null);
        toast.success(`Pushed chronicle to ${charName}'s Campaign Notes!`);
      }
    });
  };

  // Get active subcategory label
  const getFilterLabel = () => {
    if (selectedSubcategory !== "all") {
      for (const cat of TAXONOMY) {
        const sub = cat.subcategories.find(s => s.value === selectedSubcategory);
        if (sub) return `${cat.icon} ${cat.label} › ${sub.label}`;
      }
    } else if (selectedCategory !== "all") {
      const cat = TAXONOMY.find(c => c.value === selectedCategory);
      if (cat) return `${cat.icon} ${cat.label} (All)`;
    }
    return "📚 All Codex Archives";
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
              Campaign World Lore & Land Index
            </p>
          </div>
        </div>

        {/* Action and Import/Export panel */}
        <div className="flex items-center gap-2.5">
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
            className="h-8 text-[10px] uppercase font-mono tracking-wider border-stone-850 hover:bg-stone-900/60 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all text-stone-400"
            title="Import Map file (.map) or Codex Backup (.json)"
          >
            <Upload className="w-3.5 h-3.5 text-amber-500" /> Import Map/Backup
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportBackup}
            className="h-8 text-[10px] uppercase font-mono tracking-wider border-stone-850 hover:bg-stone-900/60 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all text-stone-400"
            title="Export all Codex chronicles (.json)"
          >
            <Download className="w-3.5 h-3.5 text-amber-500" /> Export Backup
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[72vh]">
        
        {/* LEFT BAR: Hierarchical collapsable Index Tree */}
        <div className="lg:col-span-3 bg-stone-950/30 border border-stone-900/65 p-4 rounded-md flex flex-col gap-4 max-h-[82vh] overflow-y-auto pr-2">
          
          {/* Header title */}
          <div className="border-b border-border/15 pb-2">
            <h3 className="text-xs font-mono font-bold tracking-widest text-amber-500/80 uppercase flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5" /> Registry Index
            </h3>
          </div>

          {/* Reset All filter option */}
          <button
            onClick={() => { setSelectedCategory("all"); setSelectedSubcategory("all"); }}
            className={`w-full text-left px-2 py-1.5 text-xs font-bold font-mono tracking-wider uppercase border cursor-pointer transition-all ${
              selectedCategory === "all" && selectedSubcategory === "all"
                ? "bg-amber-950/20 border-amber-600/40 text-amber-400"
                : "bg-transparent border-transparent text-stone-400 hover:text-stone-300"
            }`}
          >
            📚 View All Archives ({codexNotes.filter(n => !n.title.toLowerCase().includes("random encounter")).length})
          </button>

          {/* Collapsible Nested tree list */}
          <div className="space-y-3.5">
            {TAXONOMY.map((group) => {
              const isExpanded = !!expandedParents[group.value];
              const isParentSelected = selectedCategory === group.value && selectedSubcategory === "all";
              const noteCount = codexNotes.filter(n => n.category === group.value && !n.title.toLowerCase().includes("random encounter")).length;

              return (
                <div key={group.value} className="space-y-1">
                  
                  {/* Parent Title Row */}
                  <div className="flex items-center justify-between group">
                    <button
                      onClick={() => { setSelectedCategory(group.value); setSelectedSubcategory("all"); }}
                      className={`flex-1 text-left font-bold font-mono text-xs tracking-wider uppercase flex items-center gap-1.5 py-1 px-1.5 border border-transparent transition-all cursor-pointer ${
                        isParentSelected 
                          ? "bg-stone-900/40 text-amber-400 border-stone-850" 
                          : "text-stone-300 hover:text-white"
                      }`}
                    >
                      <span className="text-sm leading-none">{group.icon}</span>
                      <span>{group.label}</span>
                      <span className="text-[9px] text-stone-500 font-mono font-normal">({noteCount})</span>
                    </button>

                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleParent(group.value); }}
                      className="p-1 text-stone-500 hover:text-stone-300 rounded hover:bg-stone-900/60 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Nested Subcategories child row list */}
                  {isExpanded && (
                    <div className="pl-6 border-l border-stone-900/80 space-y-1 pt-0.5 animate-in slide-in-from-top-1 duration-150">
                      {group.subcategories.map((sub) => {
                        const isSubSelected = selectedSubcategory === sub.value;
                        const subCount = codexNotes.filter(n => n.subcategory === sub.value && !n.title.toLowerCase().includes("random encounter")).length;

                        return (
                          <button
                            key={sub.value}
                            onClick={() => { setSelectedCategory(group.value); setSelectedSubcategory(sub.value); }}
                            className={`w-full text-left py-1 px-2 text-xs font-serif transition-all cursor-pointer flex justify-between items-center ${
                              isSubSelected 
                                ? "text-amber-400 font-bold border-l-2 border-amber-600 pl-1.5 bg-amber-950/[0.03]" 
                                : "text-stone-400 hover:text-stone-200"
                            }`}
                          >
                            <span>{sub.label}</span>
                            <span className="text-[8px] font-mono text-stone-600 font-normal">({subCount})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER COLUMN: Search results card list */}
        <div className="lg:col-span-4 flex flex-col gap-4 max-h-[82vh]">
          
          {/* SEARCH BAR (Front & Center) */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              type="text" 
              placeholder="Search index, tags, landmarks..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 bg-stone-950/40 border-stone-900 text-stone-200 text-xs font-serif rounded-md h-9 focus-visible:ring-amber-600/40"
            />
          </div>

          {/* Active Filter Description bar */}
          <div className="bg-stone-900/15 border border-stone-900/60 p-2.5 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-stone-400">
            <span>{getFilterLabel()}</span>
            <span className="font-bold text-amber-500">Cards: {filteredNotes.length}</span>
          </div>

          {/* Entry Cards List Scrollblock */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
            <div className="flex justify-end px-1">
              <Button 
                onClick={handleStartAdd}
                size="sm" 
                className="h-6 text-[9px] uppercase font-mono tracking-widest bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-none px-2 cursor-pointer"
              >
                <Plus className="w-3 h-3 mr-1" /> Add Entry
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-xs text-stone-500 italic">Consulting the library ledges...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-12 text-xs text-stone-500 italic bg-stone-950/10 border border-dashed border-stone-900 rounded-lg">
                No entries match filters.
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
                        <span className="text-[7px] uppercase font-mono tracking-wider px-1.5 py-0.25 border border-stone-850 rounded bg-stone-900/40 text-stone-400">
                          {note.subcategory.split("-")[1] || note.category}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-stone-400/90 font-serif leading-relaxed line-clamp-2">
                        {note.content}
                      </p>

                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {note.tags.slice(0, 3).map((tag, idx) => (
                            <span key={idx} className="text-[8px] font-mono text-amber-500/50 font-semibold uppercase">
                              #{tag}
                            </span>
                          ))}
                          {note.tags.length > 3 && (
                            <span className="text-[8px] font-mono text-stone-600 font-semibold">
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

        {/* RIGHT COLUMN: Parchment Scroll View / Add Form / Edit Form */}
        <div className="lg:col-span-5 flex flex-col min-h-[480px]">
          {isAdding || isEditing ? (
            /* Chronicle Editor/Creator Form */
            <form onSubmit={isAdding ? handleSaveNew : handleSaveEdit} className="flex-1 bg-[#120e0a] border border-amber-900/30 p-6 shadow-2xl flex flex-col justify-between text-xs max-w-3xl mx-auto w-full relative">
              <div className="absolute inset-1 border border-amber-950/15 pointer-events-none" />
              <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-amber-900/10 pointer-events-none" />

              <div className="space-y-4 flex-1">
                <h3 className="text-base font-bold text-amber-500 border-b border-amber-900/30 pb-2">
                  {isAdding ? "Forge New Chronicle" : `Re-write: ${selectedNote?.title}`}
                </h3>

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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block font-bold">Parent Category</label>
                    <select
                      value={editCategory}
                      onChange={e => {
                        const catVal = e.target.value;
                        setEditCategory(catVal);
                        // Auto-align default subcategory
                        const firstSub = TAXONOMY.find(t => t.value === catVal)?.subcategories[0]?.value || "";
                        setEditSubcategory(firstSub);
                      }}
                      className="w-full bg-stone-950 border border-stone-900 h-8 rounded-none px-2 text-xs font-serif text-stone-200 focus:outline-none focus:border-amber-600/40"
                    >
                      {TAXONOMY.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block font-bold">Subcategory</label>
                    <select
                      value={editSubcategory}
                      onChange={e => setEditSubcategory(e.target.value)}
                      className="w-full bg-stone-950 border border-stone-900 h-8 rounded-none px-2 text-xs font-serif text-stone-200 focus:outline-none focus:border-amber-600/40"
                    >
                      {TAXONOMY.find(t => t.value === editCategory)?.subcategories.map(sub => (
                        <option key={sub.value} value={sub.value}>{sub.label}</option>
                      ))}
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
                  <label className="text-[9px] font-mono uppercase tracking-widest text-stone-400 block font-bold mb-1">Description / Chronicle text</label>
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
            /* Parchment Read Screen */
            <div className="flex-1 bg-[#16110c] border border-amber-900/45 p-7 shadow-2xl relative flex flex-col justify-between parchment-glow w-full max-w-3xl mx-auto animate-in fade-in duration-300">
              {/* Decorative border overlays */}
              <div className="absolute inset-1.5 border border-amber-950/20 pointer-events-none" />
              <div className="absolute top-3.5 left-3.5 right-3.5 bottom-3.5 border border-dashed border-amber-900/15 pointer-events-none" />

              {/* Header Title & Tags */}
              <div className="space-y-3 z-10 border-b border-amber-900/20 pb-4">
                <div className="flex justify-between items-baseline flex-wrap gap-2">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-amber-500 tracking-wide leading-tight">
                    {selectedNote.title}
                  </h2>
                  
                  <span className="text-[9px] uppercase font-mono tracking-widest px-2 py-0.5 border border-amber-900/40 rounded bg-amber-950/20 text-amber-400">
                    {selectedNote.subcategory ? selectedNote.subcategory.split("-")[1] : selectedNote.category}
                  </span>
                </div>

                {selectedNote.tags && selectedNote.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
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

              {/* Scroll Description contents */}
              <div className="flex-1 overflow-y-auto font-serif text-sm leading-relaxed text-stone-200/90 py-6 pr-2 whitespace-pre-wrap select-text max-h-[38vh] min-h-[220px]">
                {selectedNote.content || <em className="text-stone-500">No chronicle description. Click edit to compile.</em>}
              </div>

              {/* Actions Bottom Bar */}
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
              <BookMarked className="w-8 h-8 text-stone-700 mb-2 animate-pulse" />
              <p className="text-xs text-stone-500 italic max-w-xs leading-relaxed font-serif">
                Select a chronicle from the index tree on the left to consult its details, or forge a new entry.
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

// Custom CSS block
const styleBlock = (
  <style>{`
    .parchment-glow {
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.85),
                  0 0 40px 2px rgba(217, 119, 6, 0.08);
    }
  `}</style>
);
