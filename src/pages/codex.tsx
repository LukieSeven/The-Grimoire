import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { 
  useListCodexNotes, 
  useCreateCodexNote, 
  useUpdateCodexNote, 
  useDeleteCodexNote,
  useListCharacters,
  useCreateNote,
  useListUnlockedPasswords,
  useLockPassword
} from "@/hooks/useStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomizeToolDialog } from "@/components/dialogs/customize-tool-dialog";
import { exportCodexBackup, importCodexBackup, sessionState } from "@/lib/storage";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Search, BookOpen, MapPin, Sparkles, Trash2, 
  Plus, Upload, Download, ArrowLeft, Send, ChevronDown, ChevronRight, BookMarked, Lock, Library
} from "lucide-react";
import { toast } from "sonner";

// Taxonomy Configuration (NPCs removed, planes added)
const TAXONOMY = [
  {
    value: "world",
    label: "LOCATIONS",
    icon: "🌍",
    subcategories: [
      { value: "world-regions", label: "Regions & Kingdoms" },
      { value: "world-cities", label: "Cities" },
      { value: "world-settlements", label: "Settlements" },
      { value: "world-landmarks", label: "Landmarks" },
      { value: "world-planes", label: "Planes & Worlds" }
    ]
  },
  {
    value: "entities",
    label: "ENTITIES",
    icon: "👤",
    subcategories: [
      { value: "entities-characters", label: "Characters" },
      { value: "entities-pcs", label: "Player Characters" },
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

// Flat List of Governing Realms in Cormant Map Data (reused for Veridia kingdoms and Planes)
const REALMS_LIST = [
  { id: 0, name: "Wildlands (Neutral Territories)" },
  { id: 1, name: "Kingdom of Pfaf" },
  { id: 2, name: "Principality of Coulonia" },
  { id: 3, name: "Duchy of Otnausern" },
  { id: 4, name: "Kingdom of Schopfloch" },
  { id: 5, name: "Duchy of Urgasia" },
  { id: 6, name: "Duchy of Steileria" },
  { id: 7, name: "Duchy of Ondijarvia" },
  { id: 8, name: "Atiladian Empire" },
  { id: 9, name: "Grand Duchy of Rorenia" },
  { id: 10, name: "Principality of Lausachlinia" },
  { id: 11, name: "Duchy of Torioria" },
  { id: 12, name: "Kingdom of Sezasecia" },
  { id: 13, name: "Duchy of Coria" },
  { id: 14, name: "Kingdom of Naueschia" },
  { id: 15, name: "Kingdom of Garfalgar" },
  { id: 16, name: "Kingdom of Tivetrenaia" },
  { id: 17, name: "Helolisian Empire" },
  { id: 18, name: "Murg Theocracy" },
  { id: 19, name: "Grand Duchy of Dubria" },
  { id: 20, name: "Republic of Lolida" },
  { id: 21, name: "Protectorate of Fuencoma" },
  { id: 22, name: "Republic of Yunseguria" },
  { id: 23, name: "Grand Duchy of Glins" },
  { id: 24, name: "Kingdom of Gorbachzaria" },
  { id: 25, name: "Grand Duchy of Buscadosia" },
  { id: 26, name: "Protectorate of Sandilia" },
  { id: 27, name: "Lougenian Empire" },
  { id: 28, name: "Charian Marches" },
  { id: 29, name: "Kingdom of Pontefia" },
  // Planar Clusters mapping
  { id: 100, name: "The Psychic Planes" },
  { id: 101, name: "The Sound Scape" },
  { id: 102, name: "The Chrono Hold" },
  { id: 103, name: "Void Realms" },
  { id: 104, name: "Deverloche Plains" },
  { id: 105, name: "The Ore Realms" },
  { id: 106, name: "The Flora-scapes" },
  { id: 107, name: "The Expanse" },
  { id: 108, name: "The Stormhold" },
  { id: 109, name: "The Stonehold" },
  { id: 110, name: "The Lumosdeep" },
  { id: 111, name: "The Umbraldeep" },
  { id: 112, name: "The Frost Deep" },
  { id: 113, name: "The Emberdeep" }
];

export default function Codex() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  useEffect(() => {
    if (!sessionState.isCodexUnlocked) {
      setLocation("/");
    }
  }, [setLocation]);
  
  // Storage hooks
  const { data: codexNotes = [], isLoading } = useListCodexNotes();
  const createCodex = useCreateCodexNote();
  const updateCodex = useUpdateCodexNote();
  const deleteCodex = useDeleteCodexNote();
  const { data: characters = [] } = useListCharacters();
  const pushToCharacterNote = useCreateNote();

  // Storage hooks for decryption passwords
  const { data: unlockedPasswords = [] } = useListUnlockedPasswords();
  const lockPassword = useLockPassword();

  // Component Search & Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  
  // Draggable resizable sidebar states
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizingRef = useRef(false);

  const resizeSidebar = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newWidth = Math.max(180, Math.min(450, e.clientX - 20));
    setSidebarWidth(newWidth);
  };

  const stopResizing = () => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", resizeSidebar);
    document.removeEventListener("mouseup", stopResizing);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.addEventListener("mousemove", resizeSidebar);
    document.addEventListener("mouseup", stopResizing);
  };

  // Collapsible Left Index states (ALL Collapsed on Page Mount)
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [expandedCountries, setExpandedCountries] = useState<Record<number, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [expandedTowns, setExpandedTowns] = useState<Record<number, boolean>>({});

  // Editor states
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("world");
  const [editSubcategory, setEditSubcategory] = useState("world-cities");
  const [editTags, setEditTags] = useState("");
  const [editSecretPassword, setEditSecretPassword] = useState("");
  const [editStateId, setEditStateId] = useState<number | null>(null);

  // Push to Character States
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [noteToPush, setNoteToPush] = useState<any | null>(null);

  // File Import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toggle Parent collapse
  const toggleParent = (parentVal: string) => {
    setExpandedParents(prev => ({ ...prev, [parentVal]: !prev[parentVal] }));
  };

  const toggleCountryExpand = (countryId: number) => {
    setExpandedCountries(prev => ({ ...prev, [countryId]: !prev[countryId] }));
  };

  const toggleFolderExpand = (folderKey: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderKey]: !prev[folderKey] }));
  };

  const toggleTownExpand = (townId: number) => {
    setExpandedTowns(prev => ({ ...prev, [townId]: !prev[townId] }));
  };

  // Helper to determine if a note is unlocked/visible
  const isNoteVisible = (note: any) => {
    if ((note.title || "").toLowerCase().includes("random encounter")) return false;
    if (note.secretPassword) {
      const sanitize = (str: string) => 
        (str || "")
          .trim()
          .toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“]/g, "")
          .replace(/\s+/g, " ");
      return unlockedPasswords.some(pw => sanitize(pw) === sanitize(note.secretPassword));
    }
    return true;
  };

  // Filter notes based on strictly Title Search Matching
  const filteredNotes = codexNotes.filter(n => {
    if ((n.title || "").toLowerCase().includes("random encounter")) return false;
    if (n.secretPassword) {
      const sanitize = (str: string) => 
        (str || "")
          .trim()
          .toLowerCase()
          .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“]/g, "")
          .replace(/\s+/g, " ");
      const hasMatch = unlockedPasswords.some(pw => sanitize(pw) === sanitize(n.secretPassword));
      if (!hasMatch) return false;
    }

    const matchesSearch = (n.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Wildlands Virtual Region overview note
  const wildlandsVirtualNote = {
    id: -99,
    title: "Wildlands (Neutral Territories)",
    content: "Unclaimed lands, wild borderlands, and neutral ruins across Cormant governed by no crown.\n\nHistorically, these territories serve as buffer zones between warring kingdoms, populated by nomadic tribes, free companies, monster nests, and independent settlements that reject royal sovereignty. Dangerous but rich in unexplored mysteries.",
    category: "world",
    subcategory: "world-regions",
    tags: ["WILDLANDS"],
    stateId: 0,
    isState: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Veridia Virtual Region overview note
  const veridiaVirtualNote = {
    id: -100,
    title: "Veridia",
    content: "The mortal realm and primary continent of Cormant. Veridia is a land of diverse kingdoms, rolling valleys, ancient forests, and high peaks.\n\nFrom the Grand Duchy of Rorenia to the Wildlands border zones, this land holds the history of mortal crowns, magic confluences, and age-old conflicts.",
    category: "world",
    subcategory: "world-regions",
    tags: ["MORTAL", "MAINLAND"],
    stateId: -100,
    isState: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Planes & Other Worlds Virtual Region overview note
  const planesVirtualNote = {
    id: -101,
    title: "Planes & Other Worlds",
    content: "Cosmic clusters and realms outside of the mortal continent of Veridia.\n\nThese foreign dimensions consist of planes governed by unique elemental forces, spiritual laws, or eldritch entities. Traversable only via dimensional gates, ley line confluences, or powerful conjuration spells.",
    category: "world",
    subcategory: "world-planes",
    tags: ["PLANES", "COSMIC"],
    stateId: -101,
    isState: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Selected Note fallback
  const selectedNote = selectedNoteId === -99 
    ? wildlandsVirtualNote 
    : selectedNoteId === -100
    ? veridiaVirtualNote
    : selectedNoteId === -101
    ? planesVirtualNote
    : (codexNotes.find(n => n.id === selectedNoteId) || filteredNotes[0] || null);

  // Auto-expand parents/countries/planes on search query changes
  useEffect(() => {
    if (searchTerm.trim().length > 1) {
      const activeMatches = filteredNotes;
      const countriesToExpand: Record<number, boolean> = {};
      const foldersToExpand: Record<string, boolean> = {};
      const townsToExpand: Record<number, boolean> = {};

      activeMatches.forEach(note => {
        if (note.stateId !== undefined && note.stateId !== null) {
          if (note.subcategory === "world-planes") {
            foldersToExpand["locations-planes"] = true;
            foldersToExpand[`plane-${note.stateId}`] = true;
          } else {
            const countryNode = codexNotes.find(c => c.category === "world" && c.isState && c.stateId === note.stateId);
            const countryId = countryNode ? countryNode.id : (note.stateId === 0 ? -99 : null);
            
            if (countryId !== null) {
              countriesToExpand[countryId] = true;
              foldersToExpand["locations-veridia"] = true;
              
              if (note.subcategory === "world-cities" || note.subcategory === "world-settlements") {
                foldersToExpand[`${countryId}-cities`] = true;
              } else if (note.subcategory === "world-landmarks" || note.category === "maps" || note.category === "lore") {
                if (note.parentBurgId) {
                  foldersToExpand[`${countryId}-cities`] = true;
                  townsToExpand[note.parentBurgId] = true;
                } else {
                  foldersToExpand[`${countryId}-landmarks`] = true;
                }
              } else if (note.category === "entities" || note.category === "systems") {
                foldersToExpand[`${countryId}-entities`] = true;
              }
            }
          }
        }
      });

      setExpandedCountries(prev => ({ ...prev, ...countriesToExpand }));
      setExpandedFolders(prev => ({ ...prev, ...foldersToExpand }));
      setExpandedTowns(prev => ({ ...prev, ...townsToExpand }));
      setExpandedParents(prev => ({ ...prev, world: true }));
    }
  }, [searchTerm, filteredNotes, codexNotes]);

  // Handle Edit Click
  const handleStartEdit = () => {
    if (!selectedNote || selectedNote.id === -99) return;
    setEditTitle(selectedNote.title);
    setEditContent(selectedNote.content);
    setEditCategory(selectedNote.category || "world");
    setEditSubcategory(selectedNote.subcategory || "world-cities");
    setEditTags(selectedNote.tags ? selectedNote.tags.join(", ") : "");
    setEditSecretPassword(selectedNote.secretPassword || "");
    setEditStateId(selectedNote.stateId !== undefined ? selectedNote.stateId : null);
    setIsEditing(true);
  };

  // Handle Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNote || selectedNote.id === -99) return;
    
    const tagsArray = editTags
      .split(",")
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);

    const realmObj = REALMS_LIST.find(r => r.id === editStateId);
    if (realmObj && editStateId !== null) {
      const realmTagName = realmObj.name.split(" ")[0].replace(/[^a-zA-Z]/g, "").toUpperCase();
      if (realmTagName && !tagsArray.includes(realmTagName)) {
        tagsArray.push(realmTagName);
      }
    }

    updateCodex.mutate({
      id: selectedNote.id,
      data: {
        title: editTitle,
        content: editContent,
        category: editCategory,
        subcategory: editSubcategory,
        tags: tagsArray,
        secretPassword: editSecretPassword.trim() || null,
        stateId: editStateId
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
    setEditSecretPassword("");
    setEditStateId(null);
    setIsAdding(true);
  };

  // Handle Save New
  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = editTags
      .split(",")
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);

    const realmObj = REALMS_LIST.find(r => r.id === editStateId);
    if (realmObj && editStateId !== null) {
      const realmTagName = realmObj.name.split(" ")[0].replace(/[^a-zA-Z]/g, "").toUpperCase();
      if (realmTagName && !tagsArray.includes(realmTagName)) {
        tagsArray.push(realmTagName);
      }
    }

    createCodex.mutate({
      title: editTitle,
      content: editContent,
      category: editCategory,
      subcategory: editSubcategory,
      tags: tagsArray,
      coordinates: null,
      secretPassword: editSecretPassword.trim() || null,
      stateId: editStateId,
      isState: false,
      isCapital: false
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
    if (id === -99) return;
    if (confirm("Are you absolutely sure you want to erase this chronicle from the Codex?")) {
      deleteCodex.mutate({ id }, {
        onSuccess: () => {
          setSelectedNoteId(null);
          toast.success("Chronicle erased from the archives.");
        }
      });
    }
  };

  // Export Codex backup (.codex)
  const handleExportBackup = () => {
    try {
      exportCodexBackup();
      toast.success("Codex lore backup exported successfully!");
    } catch {
      toast.error("Failed to export Codex backup.");
    }
  };

  // Import Codex backup (.codex or legacy .json)
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        importCodexBackup(JSON.stringify(parsed));
        await queryClient.invalidateQueries();
        toast.success("Codex lore backup restored successfully!");
      } catch (err) {
        toast.error("Invalid file format. Import requires a valid backup .codex or .json file.");
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
      category: noteToPush.category,
      tags: [...(noteToPush.tags || []), "CODEX"]
    }, {
      onSuccess: () => {
        setIsPushModalOpen(false);
        setNoteToPush(null);
        toast.success(`Pushed chronicle to ${charName}'s private notes!`);
      }
    });
  };

  return (
    <div className="relative min-h-[92vh] bg-background text-foreground flex flex-col font-serif select-none p-4 max-w-7xl mx-auto space-y-4">
      
      {styleBlock}

      {/* ── Top Header Controls ── */}
      <div className="flex items-center justify-between border-b border-border/20 pb-4 flex-wrap gap-4 mt-2">
        <div className="flex items-center gap-3">
          <img 
            src={`${import.meta.env.BASE_URL}logo.jpg`} 
            alt="Veridia Codex Logo" 
            className="w-10 h-10 rounded-lg object-cover border border-primary/20 shadow-sm flex-shrink-0"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-widest bg-gradient-to-r from-primary to-primary-foreground bg-clip-text text-transparent drop-shadow-md">
              Veridia Codex
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-stone-500 uppercase mt-0.5">
              Campaign World Lore & Land Index
            </p>
          </div>
        </div>
      </div>

      {/* ── Unified Base Scheme Utility Control Bar ── */}
      <div className="bg-card/45 backdrop-blur-md border border-border/40 p-4 flex flex-wrap items-center justify-between gap-4 rounded-lg shadow-sm w-full">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => setLocation("/")}
            className="h-9 text-xs font-serif border border-border/50 hover:bg-accent/40 hover:text-foreground rounded-md cursor-pointer flex items-center gap-1.5 px-3.5 font-bold text-muted-foreground transition-all"
            title="Return to the library bookcase"
          >
            <Library className="w-3.5 h-3.5 text-primary" /> Return to The Archive
          </Button>
          <div className="h-4 w-px bg-border/30" />
          <CustomizeToolDialog />
        </div>
        <div className="flex items-center gap-2.5">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".codex,.json" 
            className="hidden" 
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleImportClick}
            className="h-8 text-xs font-serif border border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all"
            title="Restore Codex backup (.codex, .json)"
          >
            <Upload className="w-3.5 h-3.5" /> Import Codex
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportBackup}
            className="h-8 text-xs font-serif border border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all"
            title="Export Codex backup (.codex)"
          >
            <Download className="w-3.5 h-3.5" /> Export Codex
          </Button>
        </div>
      </div>

      {/* Main Grid Layout (Side-by-Side Flex Layout with Draggable Separator) */}
      <div className="flex w-full items-stretch gap-2 flex-1 min-h-[72vh] relative">
        
        {/* LEFT COLUMN: Hierarchical collapsable Index Tree & Search (Resizable Width) */}
        <div 
          style={{ width: sidebarWidth }}
          className="bg-card/45 border border-border/40 p-4 rounded-md flex flex-col gap-4 max-h-[82vh] overflow-y-auto pr-2 flex-shrink-0"
        >
          
          {/* Header title & Add Entry shortcut */}
          <div className="flex items-center justify-between border-b border-border/15 pb-2">
            <h3 className="text-xs font-mono font-bold tracking-widest text-primary uppercase flex items-center gap-1.5">
              <BookMarked className="w-3.5 h-3.5" /> Registry Index
            </h3>
            <Button 
              onClick={handleStartAdd}
              size="sm" 
              className="h-5 text-[9px] uppercase font-mono tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-none px-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-0.5" /> Add
            </Button>
          </div>

          {/* Search Bar prominently at top of sidebar (with Contextual Reset button) */}
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input 
                type="text" 
                placeholder="Search index..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8.5 bg-background border-border text-foreground text-xs font-serif rounded-md h-8.5 focus-visible:ring-primary/40"
              />
              {searchTerm && (
                <button 
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 font-sans text-xs"
                >
                  ×
                </button>
              )}
            </div>
            
            {(selectedCategory !== "all" || selectedSubcategory !== "all" || searchTerm) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedSubcategory("all");
                  setSearchTerm("");
                }}
                className="h-8.5 px-2 text-[10px] font-mono border-primary/30 text-primary hover:bg-primary/10 rounded-md shrink-0 uppercase tracking-wider cursor-pointer"
                title="Clear all filters & search"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Collapsible Nested tree list */}
          <div className="space-y-3.5">
            {TAXONOMY.map((group) => {
              const isExpanded = !!expandedParents[group.value];
              const isParentSelected = selectedCategory === group.value && selectedSubcategory === "all";
              const noteCount = codexNotes.filter(n => n.category === group.value && isNoteVisible(n)).length;

              return (
                <div key={group.value} className="space-y-1">
                  
                  {/* Parent Title Row (Name click triggers expansion/collapse) */}
                  <div className="flex items-center justify-between group">
                    <button
                      onClick={() => { 
                        setSelectedCategory(group.value); 
                        setSelectedSubcategory("all"); 
                        toggleParent(group.value); // Toggle folder state directly on name click!
                      }}
                      className={`flex-1 text-left font-bold font-mono text-xs tracking-wider uppercase flex items-center gap-1.5 py-1 px-1.5 border border-transparent transition-all cursor-pointer ${
                        isParentSelected 
                          ? "bg-card/90 text-primary border-border/20" 
                          : "text-foreground/90 hover:text-primary"
                      }`}
                    >
                      <span className="text-sm leading-none">{group.icon}</span>
                      <span>{group.label}</span>
                      <span className="text-[9px] text-stone-500 font-mono font-normal">({noteCount})</span>
                    </button>

                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleParent(group.value); }}
                      className="p-1 text-stone-500 hover:text-primary rounded hover:bg-card transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Custom LOCATIONS tree layout (Veridia + Planes side-by-side nesting folders) */}
                  {group.value === "world" && isExpanded && (
                    <div className="pl-3 border-l border-border/30 space-y-2.5 pt-1 animate-in slide-in-from-top-1 duration-150">
                      
                      {/* SUB-NODE 1: Veridia World Map */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between group/veridia-header">
                          <button
                            onClick={() => { 
                              setSelectedCategory("world"); 
                              setSelectedSubcategory("all");
                              setSelectedNoteId(-100);
                              setIsEditing(false);
                              setIsAdding(false);
                              toggleFolderExpand("locations-veridia"); // Toggle folder state directly on name click!
                            }}
                            className={`flex-grow text-left text-xs font-serif font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 py-0.5 px-1 cursor-pointer ${
                              selectedCategory === "world" && selectedSubcategory !== "world-planes" && selectedNoteId === -100
                                ? "text-primary font-bold"
                                : "text-stone-400 hover:text-primary"
                            }`}
                          >
                            <span>🪐</span>
                            <span>Veridia</span>
                          </button>
                          <button
                            onClick={() => toggleFolderExpand("locations-veridia")}
                            className="p-0.5 text-stone-500 hover:text-primary transition-colors"
                          >
                            {expandedFolders["locations-veridia"] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Veridia Geographic Tree */}
                        {expandedFolders["locations-veridia"] && (
                          <div className="pl-3 border-l border-border/30 space-y-2 pt-0.5 transition-all">
                            {(() => {
                              const activeCountries = codexNotes.filter(n => n.category === "world" && n.isState && n.subcategory !== "world-planes" && isNoteVisible(n));
                              const wildlandsNode = {
                                id: -99,
                                title: "Wildlands (Neutral Territories)",
                                content: "Unclaimed lands, wild borderlands, and neutral ruins across Cormant governed by no crown.",
                                category: "world",
                                subcategory: "world-regions",
                                tags: ["WILDLANDS"],
                                stateId: 0,
                                isState: true
                              };
                              const allCountries = [...activeCountries, wildlandsNode];

                              return allCountries.map(country => {
                                const isCountryExpanded = !!expandedCountries[country.id];
                                const isSelected = selectedNote?.id === country.id;
                                
                                const childSettlements = codexNotes.filter(n => n.stateId === country.stateId && (n.subcategory === "world-cities" || n.subcategory === "world-settlements") && !n.isState && isNoteVisible(n));
                                const childLandmarks = codexNotes.filter(n => n.stateId === country.stateId && (n.subcategory === "world-landmarks" || n.category === "maps" || n.category === "lore") && !n.isState && isNoteVisible(n));
                                const childEntities = codexNotes.filter(n => n.stateId === country.stateId && (n.category === "entities" || n.category === "systems") && !n.isState && isNoteVisible(n));
                                const totalChildren = childSettlements.length + childLandmarks.length + childEntities.length;

                                return (
                                  <div key={country.id} className="space-y-1">
                                    <div className="flex items-center justify-between group/country">
                                      <button
                                        onClick={() => { 
                                          setSelectedNoteId(country.id); 
                                          setIsEditing(false); 
                                          setIsAdding(false); 
                                          toggleCountryExpand(country.id); // Toggle folder state directly on name click!
                                        }}
                                        className={`flex-1 text-left py-0.5 px-1.5 text-xs font-serif transition-all cursor-pointer flex items-center gap-1 border border-transparent ${
                                          isSelected ? "text-primary font-bold bg-primary/5 border-primary/20" : "text-foreground/90 hover:text-primary"
                                        }`}
                                      >
                                        <span>📍</span>
                                        <span className="truncate">{country.title}</span>
                                        <span className="text-[8px] font-mono text-stone-600">({totalChildren})</span>
                                      </button>
                                      <button onClick={() => toggleCountryExpand(country.id)} className="p-0.5 text-stone-500 hover:text-primary">
                                        {isCountryExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                      </button>
                                    </div>

                                    {isCountryExpanded && (
                                      <div className="pl-4 border-l border-border/30 space-y-2 pt-0.5">
                                        
                                        {/* Folder 1.1: Cities & Settlements */}
                                        <div className="space-y-0.5">
                                          <button onClick={() => toggleFolderExpand(`${country.id}-cities`)} className="w-full text-left py-0.5 px-1 text-[9px] font-mono uppercase tracking-wider text-stone-500 hover:text-primary flex items-center gap-1 cursor-pointer">
                                            <span>{expandedFolders[`${country.id}-cities`] ? "📂" : "📁"}</span>
                                            <span className="truncate">Cities & Settlements ({childSettlements.length})</span>
                                          </button>
                                          {expandedFolders[`${country.id}-cities`] && (
                                            <div className="pl-3.5 space-y-0.5 border-l border-border/20">
                                              {childSettlements.map(note => {
                                                const isSelectedNote = selectedNote?.id === note.id;
                                                const localLandmarks = codexNotes.filter(n => n.parentBurgId === note.id && isNoteVisible(n));
                                                const hasLocalLandmarks = localLandmarks.length > 0;
                                                const isTownExpanded = !!expandedTowns[note.id];

                                                return (
                                                  <div key={note.id} className="space-y-0.5">
                                                    <div className="flex items-center justify-between group/town">
                                                      <button 
                                                        onClick={() => { 
                                                          setSelectedNoteId(note.id); 
                                                          setIsEditing(false); 
                                                          setIsAdding(false); 
                                                          if (hasLocalLandmarks) toggleTownExpand(note.id); // Toggle folder state directly on name click!
                                                        }} 
                                                        className={`flex-1 text-left py-0.5 px-1 text-[11px] font-serif truncate border-l cursor-pointer ${
                                                          isSelectedNote ? "text-primary font-bold border-primary pl-1.5 bg-primary/5" : "text-foreground/80 border-transparent hover:text-primary"
                                                        }`}
                                                      >
                                                        {note.isCapital ? "👑 " : ""}{note.title}
                                                      </button>
                                                      {hasLocalLandmarks && (
                                                        <button onClick={() => toggleTownExpand(note.id)} className="p-0.5 text-stone-600 hover:text-primary">
                                                          {isTownExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                                        </button>
                                                      )}
                                                    </div>

                                                    {hasLocalLandmarks && isTownExpanded && (
                                                      <div className="pl-3.5 ml-1 border-l border-primary/10 space-y-0.5 pt-0.5">
                                                        {localLandmarks.map(landmark => (
                                                          <button key={landmark.id} onClick={() => { setSelectedNoteId(landmark.id); setIsEditing(false); setIsAdding(false); }} className={`w-full text-left py-0.5 px-1.5 text-[10px] font-serif truncate border-l cursor-pointer ${selectedNote?.id === landmark.id ? "text-primary font-bold border-primary pl-1.5 bg-primary/5" : "text-stone-500 border-transparent hover:text-primary"}`}>
                                                            {landmark.subcategory === "maps-dungeons" ? "💀 " : "📍 "}{landmark.title}
                                                          </button>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>

                                        {/* Folder 1.2: Landmarks & Dungeons */}
                                        <div className="space-y-0.5">
                                          <button onClick={() => toggleFolderExpand(`${country.id}-landmarks`)} className="w-full text-left py-0.5 px-1 text-[9px] font-mono uppercase tracking-wider text-stone-500 hover:text-primary flex items-center gap-1 cursor-pointer">
                                            <span>{expandedFolders[`${country.id}-landmarks`] ? "📂" : "📁"}</span>
                                            <span className="truncate">Landmarks & Dungeons ({childLandmarks.filter(n => !n.parentBurgId).length})</span>
                                          </button>
                                          {expandedFolders[`${country.id}-landmarks`] && (
                                            <div className="pl-3.5 space-y-0.5 border-l border-border/20">
                                              {childLandmarks.filter(n => !n.parentBurgId).map(note => (
                                                <button key={note.id} onClick={() => { setSelectedNoteId(note.id); setIsEditing(false); setIsAdding(false); }} className={`w-full text-left py-0.5 px-1 text-[11px] font-serif truncate border-l cursor-pointer ${selectedNote?.id === note.id ? "text-primary font-bold border-primary pl-1.5 bg-primary/5" : "text-foreground/80 border-transparent hover:text-primary"}`}>
                                                  {note.subcategory === "maps-dungeons" ? "💀 " : "📍 "}{note.title}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Folder 1.3: Entities & Factions */}
                                        <div className="space-y-0.5">
                                          <button onClick={() => toggleFolderExpand(`${country.id}-entities`)} className="w-full text-left py-0.5 px-1 text-[9px] font-mono uppercase tracking-wider text-stone-500 hover:text-primary flex items-center gap-1 cursor-pointer">
                                            <span>{expandedFolders[`${country.id}-entities`] ? "📂" : "📁"}</span>
                                            <span className="truncate">Entities & Factions ({childEntities.length})</span>
                                          </button>
                                          {expandedFolders[`${country.id}-entities`] && (
                                            <div className="pl-3.5 space-y-0.5 border-l border-border/20">
                                              {childEntities.map(note => (
                                                <button key={note.id} onClick={() => { setSelectedNoteId(note.id); setIsEditing(false); setIsAdding(false); }} className={`w-full text-left py-0.5 px-1 text-[11px] font-serif truncate border-l cursor-pointer ${selectedNote?.id === note.id ? "text-primary font-bold border-primary pl-1.5 bg-primary/5" : "text-foreground/80 border-transparent hover:text-primary"}`}>
                                                  👤 {note.title}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>

                      {/* SUB-NODE 2: Planes & Other Worlds */}
                      <div className="space-y-1.5 border-t border-border/30 pt-2.5">
                        <div className="flex items-center justify-between group/planes-header">
                          <button
                            onClick={() => { 
                              setSelectedCategory("world"); 
                              setSelectedSubcategory("world-planes");
                              setSelectedNoteId(-101);
                              setIsEditing(false);
                              setIsAdding(false);
                              toggleFolderExpand("locations-planes"); // Toggle folder state directly on name click!
                            }}
                            className={`flex-grow text-left text-xs font-serif font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 py-0.5 px-1 cursor-pointer ${
                              selectedCategory === "world" && selectedSubcategory === "world-planes" && selectedNoteId === -101
                                ? "text-primary font-bold"
                                : "text-stone-400 hover:text-primary"
                            }`}
                          >
                            <span>✨</span>
                            <span>Planes & Other Worlds</span>
                          </button>
                          <button
                            onClick={() => toggleFolderExpand("locations-planes")}
                            className="p-0.5 text-stone-500 hover:text-primary transition-colors"
                          >
                            {expandedFolders["locations-planes"] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Collapsible Planar Clusters Folder tree */}
                        {expandedFolders["locations-planes"] && (
                          <div className="pl-3 border-l border-border/30 space-y-2 pt-0.5">
                            {(() => {
                              const planeClusters = codexNotes.filter(n => n.category === "world" && n.subcategory === "world-planes" && n.isState && isNoteVisible(n));
                              
                              if (planeClusters.length === 0) {
                                return <div className="text-[9px] text-stone-600 italic pl-2">No planar clusters registered.</div>;
                              }

                              return planeClusters.map(cluster => {
                                const isClusterExpanded = !!expandedFolders[`plane-${cluster.stateId}`];
                                const isSelected = selectedNote?.id === cluster.id;
                                
                                const nestedWorlds = codexNotes.filter(n => n.category === "world" && n.subcategory === "world-planes" && !n.isState && n.stateId === cluster.stateId && isNoteVisible(n));

                                return (
                                  <div key={cluster.id} className="space-y-1">
                                    {/* Planar Cluster Row */}
                                    <div className="flex items-center justify-between group/cluster">
                                      <button
                                        onClick={() => { 
                                          setSelectedNoteId(cluster.id); 
                                          setIsEditing(false); 
                                          setIsAdding(false); 
                                          toggleFolderExpand(`plane-${cluster.stateId}`); // Toggle folder state directly on name click!
                                        }}
                                        className={`flex-grow text-left py-0.5 px-1.5 text-xs font-serif transition-all flex items-center gap-1 border border-transparent cursor-pointer ${
                                          isSelected ? "text-primary font-bold bg-primary/5 border-primary/20" : "text-foreground/90 hover:text-primary"
                                        }`}
                                      >
                                        <span>🌀</span>
                                        <span className="truncate">{cluster.title}</span>
                                        <span className="text-[8px] font-mono text-stone-600">({nestedWorlds.length})</span>
                                      </button>
                                      <button 
                                        onClick={() => toggleFolderExpand(`plane-${cluster.stateId}`)}
                                        className="p-0.5 text-stone-500 hover:text-primary"
                                      >
                                        {isClusterExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                      </button>
                                    </div>

                                    {/* Nested Child Worlds */}
                                    {isClusterExpanded && (
                                      <div className="pl-3.5 ml-1 border-l border-primary/10 space-y-0.5 pt-0.5">
                                        {nestedWorlds.map(world => {
                                          const isSelectedWorld = selectedNote?.id === world.id;
                                          return (
                                            <button
                                              key={world.id}
                                              onClick={() => { setSelectedNoteId(world.id); setIsEditing(false); setIsAdding(false); }}
                                              className={`w-full text-left py-0.5 px-1 text-[11px] font-serif truncate border-l cursor-pointer ${
                                                isSelectedWorld 
                                                  ? "text-primary font-bold border-primary pl-1.5 bg-primary/5" 
                                                  : "text-stone-400 border-transparent hover:text-primary"
                                              }`}
                                            >
                                              🌌 {world.title}
                                            </button>
                                          );
                                        })}
                                        {nestedWorlds.length === 0 && (
                                          <div className="text-[9px] text-stone-600 italic pl-1.5 py-0.5 font-sans">No worlds aligned.</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* Standard Flat Subcategories child list for other categories */}
                  {group.value !== "world" && isExpanded && (
                    <div className="pl-6 border-l border-border/30 space-y-1 pt-0.5 animate-in slide-in-from-top-1 duration-150">
                      {group.subcategories.map((sub) => {
                        const isSubSelected = selectedSubcategory === sub.value;
                        
                        // Count notes matching this subcategory AND search term
                        const matchingSubnotes = codexNotes.filter(n => n.subcategory === sub.value && isNoteVisible(n));
                        
                        return (
                          <div key={sub.value} className="space-y-0.5">
                            <button
                              onClick={() => { setSelectedCategory(group.value); setSelectedSubcategory(sub.value); }}
                              className={`w-full text-left py-1 px-2 text-xs font-serif transition-all cursor-pointer flex justify-between items-center ${
                                isSubSelected 
                                  ? "text-primary font-bold border-l-2 border-primary pl-1.5 bg-primary/5" 
                                  : "text-stone-400 hover:text-primary"
                              }`}
                            >
                              <span className="truncate">{sub.label}</span>
                              <span className="text-[8px] font-mono text-stone-600 font-normal">({matchingSubnotes.length})</span>
                            </button>

                            {/* List matching notes directly under subcategory folder for non-world categories */}
                            {isSubSelected && (
                              <div className="pl-3.5 space-y-0.5 border-l border-border/20">
                                {matchingSubnotes.map(note => {
                                  const isSelectedNote = selectedNote?.id === note.id;
                                  return (
                                    <button
                                      key={note.id}
                                      onClick={() => { setSelectedNoteId(note.id); setIsEditing(false); setIsAdding(false); }}
                                      className={`w-full text-left py-0.5 px-1.5 text-[11px] font-serif truncate cursor-pointer block border-l ${
                                        isSelectedNote 
                                          ? "text-primary font-bold border-primary bg-primary/5 pl-1.5" 
                                          : "text-stone-500 border-transparent hover:text-primary"
                                      }`}
                                    >
                                      • {note.title}
                                    </button>
                                  );
                                })}
                                {matchingSubnotes.length === 0 && (
                                  <div className="text-[9px] text-stone-600 italic pl-1.5 py-0.5 font-sans">No entries.</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Decrypted Keys List display */}
          {unlockedPasswords.length > 0 && (
            <div className="space-y-2 border-t border-border/25 pt-4 mt-2">
              <span className="text-[9px] font-mono uppercase tracking-widest text-stone-500 font-bold block mb-1">
                Decrypted Seals
              </span>
              <div className="flex flex-wrap gap-1.5">
                {unlockedPasswords.map((pw) => (
                  <span 
                    key={pw}
                    className="text-[9px] font-mono bg-primary/5 border border-primary/20 text-primary px-2 py-0.5 flex items-center gap-1.5"
                  >
                    🔑 {pw}
                    <button 
                      onClick={() => {
                        if (confirm(`Do you want to re-lock the "${pw}" archives?`)) {
                          lockPassword.mutate(pw);
                        }
                      }}
                      className="text-stone-600 hover:text-red-400 cursor-pointer font-sans text-xs font-bold leading-none pl-1 transition-colors"
                      title="Re-lock this passphrase"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DRAGGABLE DIVIDER (Drag left/right to resize sidebar index) */}
        <div 
          onMouseDown={startResizing}
          onTouchStart={(e) => {
            isResizingRef.current = true;
            const handleTouchMove = (evt: TouchEvent) => {
              const touch = evt.touches[0];
              const newW = Math.max(180, Math.min(450, touch.clientX - 20));
              setSidebarWidth(newW);
            };
            const handleTouchEnd = () => {
              isResizingRef.current = false;
              document.removeEventListener("touchmove", handleTouchMove);
              document.removeEventListener("touchend", handleTouchEnd);
            };
            document.addEventListener("touchmove", handleTouchMove);
            document.addEventListener("touchend", handleTouchEnd);
          }}
          className="w-1 hover:w-1.5 bg-card hover:bg-primary/20 border-l border-r border-border/40 hover:border-primary/20 cursor-col-resize self-stretch transition-all z-20 flex-shrink-0"
          title="Drag to resize directory index"
        />

        {/* RIGHT COLUMN: Themed Card View (Flexible remainder width) */}
        <div className="flex-grow flex flex-col min-h-[480px]">
          {selectedNote ? (
            /* Themed Read Card (Transforms color scheme dynamically with theme classes) */
            <div className="flex-1 bg-card/75 border border-border shadow-2xl p-4 sm:p-7 relative flex flex-col justify-between backdrop-blur-md w-full max-w-3xl mx-auto animate-in fade-in duration-300">
              {/* Decorative border overlays */}
              <div className="absolute inset-1.5 border border-border/30 pointer-events-none" />
              <div className="absolute top-3.5 left-3.5 right-3.5 bottom-3.5 border border-dashed border-primary/10 pointer-events-none" />

              <div className="flex flex-col flex-1 justify-between z-10">
                {/* Header Title & Tags */}
                <div className="space-y-3 border-b border-border/20 pb-4">
                  <div className="flex justify-between items-baseline flex-wrap gap-2">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-primary tracking-wide leading-tight flex items-center gap-2">
                      {selectedNote.title}
                      {selectedNote.secretPassword && (
                        <Lock className="w-4 h-4 text-primary" title="Decrypted secret entry" />
                      )}
                    </h2>
                    
                    <span className="text-[9px] uppercase font-mono tracking-widest px-2 py-0.5 border border-border/30 rounded bg-primary/10 text-primary">
                      {selectedNote.subcategory ? selectedNote.subcategory.split("-")[1] : selectedNote.category}
                    </span>
                  </div>

                  {selectedNote.tags && selectedNote.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {selectedNote.tags.map((tag, idx) => (
                        <span key={idx} className="text-[9px] font-mono bg-primary/5 border border-primary/20 text-primary px-2 py-0.5 rounded-none font-semibold uppercase tracking-wider">
                          #{tag}
                        </span>
                      ))}
                      {selectedNote.secretPassword && (
                        <span className="text-[9px] font-mono text-primary font-semibold border border-primary/20 px-2 py-0.5 rounded-none bg-primary/5 flex items-center gap-1">
                          Lock: "{selectedNote.secretPassword}"
                        </span>
                      )}
                      {selectedNote.stateId !== undefined && selectedNote.stateId !== null && (
                        <span className="text-[9px] font-mono text-primary font-semibold border border-primary/20 px-2 py-0.5 rounded-none bg-primary/5 flex items-center gap-1.5">
                          Realm: {REALMS_LIST.find(r => r.id === selectedNote.stateId)?.name || "Wildlands"}
                        </span>
                      )}
                      {selectedNote.coordinates && (
                        <span className="text-[9px] font-mono text-teal-400 font-semibold border border-teal-900/40 px-2 py-0.5 rounded-none bg-teal-950/10 flex items-center gap-1.5 ml-auto">
                          <MapPin className="w-3 h-3 text-teal-400" />
                          Coord: X: {selectedNote.coordinates.x.toFixed(0)}, Y: {selectedNote.coordinates.y.toFixed(0)} ({selectedNote.coordinates.label})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Description contents */}
                <div className="flex-1 overflow-y-auto font-serif text-sm sm:text-base leading-relaxed text-foreground/90 py-5 pr-2 whitespace-pre-wrap select-text max-h-[38vh] min-h-[180px]">
                  {selectedNote.content || <em className="text-stone-500">No chronicle description. Click edit to compile.</em>}
                </div>

                {/* Resident Figures & Factions listing at the very bottom */}
                {selectedNote.isState && (() => {
                  const residents = codexNotes.filter(n => n.stateId === selectedNote.stateId && !n.isState && (n.category === "entities" || n.category === "systems") && isNoteVisible(n));
                  if (residents.length === 0) return null;
                  return (
                    <div className="border-t border-border/10 pt-4 mt-4 space-y-1.5 text-left">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-stone-500/80 font-bold block">
                        Resident Figures & Factions Reference:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {residents.map(r => (
                          <button
                            key={r.id}
                            onClick={() => setSelectedNoteId(r.id)}
                            className="text-stone-400 hover:text-primary hover:underline text-[10px] font-serif flex items-center gap-1 cursor-pointer bg-background border border-border/30 px-2 py-0.5 transition-colors"
                          >
                            <span>{r.category === "entities" ? "👤" : "🏛️"}</span>
                            <span>{r.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Actions Bottom Bar */}
              <div className="border-t border-border/20 pt-4 flex justify-between items-center mt-4 z-10">
                <Button
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  variant="ghost" 
                  size="sm" 
                  disabled={selectedNote.id < 0}
                  className="text-stone-500 hover:text-red-400 hover:bg-red-950/10 h-8 rounded-none cursor-pointer font-serif disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Erase
                </Button>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleStartEdit}
                    variant="outline"
                    size="sm"
                    disabled={selectedNote.id < 0}
                    className="h-8 text-xs font-serif border border-border/50 hover:bg-background text-stone-400 hover:text-foreground rounded-none px-3.5 font-bold cursor-pointer disabled:opacity-40"
                  >
                    Edit Note
                  </Button>
                  
                  <Button 
                    onClick={() => handleOpenPushModal(selectedNote)}
                    size="sm" 
                    disabled={selectedNote.id < 0}
                    className="h-8 text-xs font-serif bg-primary hover:bg-primary/90 text-primary-foreground px-4 font-bold rounded-none flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40"
                    title="Push this coordinate/lore note directly to a character notes sheet"
                  >
                    <Send className="w-3.5 h-3.5 text-primary-foreground" /> Push to Character
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 border border-dashed border-border flex flex-col justify-center items-center p-12 text-center max-w-3xl mx-auto w-full rounded-lg bg-card/10">
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
        <DialogContent className="sm:max-w-[420px] bg-card border border-border text-foreground p-6 rounded-none">
          <div className="absolute inset-1 border border-border/10 pointer-events-none" />
          <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

          <DialogHeader className="border-b border-border/20 pb-3">
            <DialogTitle className="font-serif text-lg font-bold text-primary flex items-center gap-2">
              <Send className="w-4 h-4" /> Port Lore to Hero
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-3 text-xs text-muted-foreground font-serif leading-relaxed">
            Copying <strong className="text-foreground">"{noteToPush?.title}"</strong> into the selected character's private **Campaign Notes** log. Choose which active hero receives this registry:
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {characters.length === 0 ? (
              <p className="text-xs italic text-stone-600 text-center py-4 font-serif">No active characters registered in the Grimoire.</p>
            ) : (
              characters.map(char => (
                <button
                  key={char.id}
                  onClick={() => handlePushToCharacter(char.id, char.name)}
                  className="w-full flex items-center justify-between p-2.5 border border-border hover:border-primary/40 bg-background/50 hover:bg-primary/5 transition-all text-stone-300 hover:text-primary text-xs font-serif font-bold text-left rounded-none cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    {char.avatar ? (
                      <img src={char.avatar} alt={char.name} className="w-5 h-5 rounded-full object-cover border border-border" />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-card flex items-center justify-center text-[9px] text-stone-400 uppercase font-mono">
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

          <div className="flex justify-end pt-3 border-t border-border/20 mt-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setIsPushModalOpen(false); setNoteToPush(null); }} 
              className="rounded-none text-stone-500 font-serif hover:bg-background"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Chronicle Modal dialog ── */}
      <Dialog open={isAdding || isEditing} onOpenChange={(open) => { if (!open) { setIsAdding(false); setIsEditing(false); } }}>
        <DialogContent className="sm:max-w-[620px] bg-card border border-border text-foreground p-6 rounded-none max-h-[90vh] overflow-y-auto">
          <div className="absolute inset-1 border border-border/10 pointer-events-none" />
          <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

          <DialogHeader className="border-b border-border/20 pb-3">
            <DialogTitle className="font-serif text-lg font-bold text-primary">
              {isAdding ? "Forge New Chronicle" : `Re-write: ${selectedNote?.title}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={isAdding ? handleSaveNew : handleSaveEdit} className="space-y-4 mt-4 text-xs font-sans">
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-stone-450 block font-bold">Chronicle Title</label>
                  <Input 
                    value={editTitle} 
                    onChange={e => setEditTitle(e.target.value)} 
                    required 
                    placeholder="e.g. Mount Troyzan" 
                    className="bg-background border-border rounded-none h-8 text-xs font-serif text-foreground focus-visible:ring-primary/40"
                  />
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-stone-455 block font-bold">Governing Realm / territory</label>
                  <select
                    value={editStateId !== null ? editStateId : ""}
                    onChange={e => {
                      const val = e.target.value;
                      setEditStateId(val === "" ? null : Number(val));
                    }}
                    className="w-full bg-background border border-border h-8 rounded-none px-2 text-xs font-serif text-foreground focus:outline-none focus:border-primary/45"
                  >
                    <option value="">Wildlands / None</option>
                    {REALMS_LIST.filter(r => r.id !== 0).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-stone-450 block font-bold">Parent Category</label>
                  <select
                    value={editCategory}
                    onChange={e => {
                      const catVal = e.target.value;
                      setEditCategory(catVal);
                      const firstSub = TAXONOMY.find(t => t.value === catVal)?.subcategories[0]?.value || "";
                      setEditSubcategory(firstSub);
                    }}
                    className="w-full bg-background border border-border h-8 rounded-none px-2 text-xs font-serif text-foreground focus:outline-none focus:border-primary/45"
                  >
                    {TAXONOMY.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-stone-450 block font-bold">Subcategory</label>
                  <select
                    value={editSubcategory}
                    onChange={e => setEditSubcategory(e.target.value)}
                    className="w-full bg-background border border-border h-8 rounded-none px-2 text-xs font-serif text-foreground focus:outline-none focus:border-primary/45"
                  >
                    {TAXONOMY.find(t => t.value === editCategory)?.subcategories.map(sub => (
                      <option key={sub.value} value={sub.value}>{sub.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-stone-450 block font-bold">Tags (Comma separated)</label>
                  <Input 
                    value={editTags} 
                    onChange={e => setEditTags(e.target.value)} 
                    placeholder="e.g. POI, VOLCANO, DANGER" 
                    className="bg-background border-border rounded-none h-8 text-xs font-serif text-foreground focus-visible:ring-primary/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-stone-450 block font-bold">Secret Password Lock (Optional)</label>
                  <Input 
                    value={editSecretPassword} 
                    onChange={e => setEditSecretPassword(e.target.value)} 
                    placeholder="e.g. corvustemple" 
                    className="bg-background border-border rounded-none h-8 text-xs font-serif text-foreground focus-visible:ring-primary/40"
                    title="If set, this note is hidden until this passphrase is typed in the bookcase ledge"
                  />
                </div>
              </div>

              <div className="space-y-1 flex flex-col">
                <label className="text-[9px] font-mono uppercase tracking-widest text-stone-450 block font-bold mb-1">Description / Chronicle text</label>
                <Textarea 
                  value={editContent} 
                  onChange={e => setEditContent(e.target.value)} 
                  required 
                  placeholder="Record what is written in the legends, or describe the landmarks..." 
                  className="bg-background border-border rounded-none min-h-[160px] text-xs font-serif leading-relaxed text-foreground focus-visible:ring-primary/40"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border/20 mt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => { setIsEditing(false); setIsAdding(false); }}
                className="rounded-none hover:bg-background text-stone-400 font-serif"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-none font-serif px-4 cursor-pointer"
              >
                Forge Entry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Style overrides
const styleBlock = (
  <style>{`
    .parchment-glow {
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.85),
                  0 0 40px 2px rgba(217, 119, 6, 0.08);
    }
  `}</style>
);
