import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { 
  useListUnlockedPasswords, 
  useLockPassword 
} from "@/hooks/useStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomizeToolDialog } from "@/components/dialogs/customize-tool-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Search, BookOpen, Sparkles, Trash2, 
  Plus, Upload, ArrowLeft, ChevronDown, ChevronRight, Lock, 
  User, Shield, Heart, Activity, Dice5, Volume2, Save, Move, Copy, PlusCircle
} from "lucide-react";
import { toast } from "sonner";

// Rules Database for quick cheatsheet reference
const RULES_CODEX = [
  {
    category: "Combat",
    title: "Action Economy",
    details: "Each combatant gets 1 Major Action, 1 Minor Action, and 1 Reaction per round. Movement is governed by speed (standard 30ft)."
  },
  {
    category: "Combat",
    title: "Critical success chains",
    details: "Rolling a natural 20 on an attack roll triggers a Critical Chain. The attacker can expend 1 Essence or 5 Mana to execute a shaped Critical Strike. Roll subsequent checks to continue chain hits."
  },
  {
    category: "Hazards",
    title: "Environmental Conditions",
    details: "Extreme Heat/Cold: Constitution checks every hour or take 1d6 vital fire/cold damage. Heavy Rain: Disadvantage on ranged weapon attacks and precision checks."
  },
  {
    category: "Mechanics",
    title: "Resting & Recoveries",
    details: "Short Rest (1 hour): Roll Hit Dice to recover HP. Spend up to 10 Mana to recover equal spell level charges. Long Rest (8 hours): Fully restores all HP, Mana, and DT. Clears standard status conditions."
  },
  {
    category: "Magic",
    title: "God-Language Runes",
    details: "Casting god-rune scriptures requires spell slots or direct mana cost deductions. Runes: FEH (Fire, cost 3 MP), URZ (Shield, cost 4 MP), THUR (Force, cost 5 MP)."
  }
];

// Generator Tables
const NPC_NAMES = ["Garrick", "Eldrin", "Vesper", "Saffron", "Thorne", "Zael", "Lyra", "Kaelen", "Morrigan", "Dorian"];
const NPC_TRAITS = ["Greedy", "Honorable", "Paranoid", "Mischievous", "Highly intelligent", "Cowardly", "Obsessive", "Stoic"];
const NPC_FACTIONS = ["Veridia Guild", "Cormant Rangers", "Shadow Cabal", "Emberdeep Alchemists", "The Iron Keep"];

export default function Chronicle() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Storage hooks for route protection
  const { data: unlockedPasswords = [], isLoading: loadingPasswords } = useListUnlockedPasswords();

  const sanitize = (str: string) => 
    (str || "")
      .trim()
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“]/g, "")
      .replace(/\s+/g, " ");

  const isChronicleUnlocked = unlockedPasswords.some(pw => sanitize(pw) === "please show me the way");

  // Protection Redirect
  useEffect(() => {
    if (!loadingPasswords && !isChronicleUnlocked) {
      setLocation("/");
    }
  }, [loadingPasswords, isChronicleUnlocked, setLocation]);

  // Main UI Screen View toggle: "dashboard" or "info-tool"
  const [activeView, setActiveView] = useState<"dashboard" | "info-tool">("dashboard");

  // Roster Store state
  const [chronicleRoster, setChronicleRoster] = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("aetherborne_chronicle_characters");
    if (raw) {
      try {
        setChronicleRoster(JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveChronicleRoster = (newRoster: any[]) => {
    setChronicleRoster(newRoster);
    localStorage.setItem("aetherborne_chronicle_characters", JSON.stringify(newRoster));
  };

  // ───── DASHBOARD SUB-VIEWS STATES ─────
  // 1. Rules Search
  const [rulesSearch, setRulesSearch] = useState("");
  
  // 2. Initiative Tracker
  const [combatants, setCombatants] = useState<any[]>([]);
  const [initName, setInitName] = useState("");
  const [initScore, setInitScore] = useState("");
  const [initHp, setInitHp] = useState("");
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [roundCount, setRoundCount] = useState(1);

  // 3. Soundscape simulation mixer
  const [soundscapeVolume, setSoundscapeVolume] = useState({
    cave: 30,
    rain: 50,
    tavern: 10,
    drums: 0,
    spell: 20
  });
  const [soundActive, setSoundActive] = useState({
    cave: true,
    rain: true,
    tavern: false,
    drums: false,
    spell: true
  });

  // 4. Generator Output
  const [generatedNpc, setGeneratedNpc] = useState<any>(null);
  const [generatedLoot, setGeneratedLoot] = useState<string>("");

  // 5. DM secret notes
  const [dmNotes, setDmNotes] = useState("");
  useEffect(() => {
    const saved = localStorage.getItem("aetherborne_dm_secrets") || "";
    setDmNotes(saved);
  }, []);

  const saveDmNotes = (txt: string) => {
    setDmNotes(txt);
    localStorage.setItem("aetherborne_dm_secrets", txt);
  };

  // ───── CHARACTER INFO TOOL (WORKSPACE CANVAS) STATES ─────
  const [boards, setBoards] = useState<any[]>([
    { id: "board-1", name: "Active Encounters" }
  ]);
  const [activeBoardId, setActiveBoardId] = useState("board-1");
  const [placements, setPlacements] = useState<any[]>([]); // Array of { characterId, boardId, col, row }
  const [isNewBoardDialogOpen, setIsNewBoardDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  // Bulk Import dialog
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedGrimoireChars, setSelectedGrimoireChars] = useState<number[]>([]);
  const [grimoireCharacters, setGrimoireCharacters] = useState<any[]>([]);

  useEffect(() => {
    // Load Grimoire character list for bulk select checkboxes
    const raw = localStorage.getItem("aetherborne_characters") || "[]";
    try {
      setGrimoireCharacters(JSON.parse(raw));
    } catch (e) {
      console.error(e);
    }
  }, [isBulkImportOpen]);

  // Load board configurations
  useEffect(() => {
    const savedBoards = localStorage.getItem("aetherborne_chronicle_boards");
    const savedPlacements = localStorage.getItem("aetherborne_chronicle_placements");
    if (savedBoards) {
      try { setBoards(JSON.parse(savedBoards)); } catch (e) { console.error(e); }
    }
    if (savedPlacements) {
      try { setPlacements(JSON.parse(savedPlacements)); } catch (e) { console.error(e); }
    }
  }, []);

  const saveBoards = (bList: any[]) => {
    setBoards(bList);
    localStorage.setItem("aetherborne_chronicle_boards", JSON.stringify(bList));
  };

  const savePlacements = (pList: any[]) => {
    setPlacements(pList);
    localStorage.setItem("aetherborne_chronicle_placements", JSON.stringify(pList));
  };

  // Drag state
  const [draggedCharId, setDraggedCharId] = useState<number | string | null>(null);

  // Inspector Dialog state
  const [inspectingChar, setInspectingChar] = useState<any | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"stats" | "abilities" | "equipment" | "essences" | "familiars">("stats");

  // Roster search state inside sidebar
  const [rosterSearch, setRosterSearch] = useState("");

  // ───── ACTION HANDLERS ─────

  // Initiative Tracker actions
  const handleAddCombatant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!initName.trim()) return;
    const score = parseInt(initScore) || 0;
    const hp = parseInt(initHp) || 10;
    setCombatants(prev => [...prev, {
      id: Date.now() + Math.random(),
      name: initName,
      score,
      hp,
      maxHp: hp,
      active: true
    }].sort((a,b) => b.score - a.score));
    setInitName("");
    setInitScore("");
    setInitHp("");
  };

  const stepTurn = (direction: number) => {
    if (combatants.length === 0) return;
    let nextIdx = currentTurnIdx + direction;
    if (nextIdx >= combatants.length) {
      nextIdx = 0;
      setRoundCount(prev => prev + 1);
    } else if (nextIdx < 0) {
      nextIdx = combatants.length - 1;
      setRoundCount(prev => Math.max(1, prev - 1));
    }
    setCurrentTurnIdx(nextIdx);
  };

  // Roll NPC Profile generator
  const handleGenerateNpc = () => {
    const name = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
    const trait = NPC_TRAITS[Math.floor(Math.random() * NPC_TRAITS.length)];
    const faction = NPC_FACTIONS[Math.floor(Math.random() * NPC_FACTIONS.length)];
    const roll = Math.floor(Math.random() * 20) + 1;
    setGeneratedNpc({ name, trait, faction, roll });
  };

  // Roll D20 loot check
  const handleGenerateLoot = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    let desc = "";
    if (roll === 20) desc = "Roll twice: Legendary Artifact of Veridia + 500 gold";
    else if (roll >= 15) desc = "Rare Alchemical Potion / Eldritch Spellscroll (Tier III)";
    else if (roll >= 10) desc = "Uncommon weapon with +1 Precision modifier + 100 gold";
    else if (roll >= 5) desc = "Common iron dagger / health poultice + 20 gold";
    else desc = "Rusty key / moldy bread / copper crumbs";
    setGeneratedLoot(`[D20 Roll: ${roll}] - ${desc}`);
  };

  // Workspace board creation
  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    const bId = `board-${Date.now()}`;
    const newList = [...boards, { id: bId, name: newBoardName }];
    saveBoards(newList);
    setActiveBoardId(bId);
    setNewBoardName("");
    setIsNewBoardDialogOpen(false);
    toast.success(`Board "${newBoardName}" created.`);
  };

  const handleDeleteBoard = (bId: string) => {
    if (boards.length <= 1) {
      toast.error("You must keep at least one board active.");
      return;
    }
    if (confirm("Delete this workspace board? Placements inside will be removed.")) {
      const newList = boards.filter(b => b.id !== bId);
      saveBoards(newList);
      const newPlacements = placements.filter(p => p.boardId !== bId);
      savePlacements(newPlacements);
      setActiveBoardId(newList[0].id);
      toast.success("Board deleted.");
    }
  };

  // Bulk clone select checkbox import from Grimoire roster
  const handleBulkImport = () => {
    if (selectedGrimoireChars.length === 0) return;
    try {
      const grimoireChars = JSON.parse(localStorage.getItem("aetherborne_characters") || "[]");
      const grimoireEquip = JSON.parse(localStorage.getItem("aetherborne_equipment") || "[]");
      const grimoireCurr = JSON.parse(localStorage.getItem("aetherborne_currencies") || "[]");
      const grimoireInv = JSON.parse(localStorage.getItem("aetherborne_inventory") || "[]");
      const grimoireEss = JSON.parse(localStorage.getItem("aetherborne_essences") || "[]");
      const grimoireAbils = JSON.parse(localStorage.getItem("aetherborne_abilities") || "[]");
      const grimoireSkills = JSON.parse(localStorage.getItem("aetherborne_skills") || "[]");

      const activeRoster = [...chronicleRoster];

      selectedGrimoireChars.forEach(id => {
        const char = grimoireChars.find((c: any) => c.id === id);
        if (!char) return;

        const newId = Date.now() + Math.floor(Math.random() * 10000);

        const bundle = {
          character: { ...char, id: newId },
          equipment: grimoireEquip.filter((e: any) => e.characterId === id).map((e: any) => ({ ...e, characterId: newId })),
          currencies: grimoireCurr.filter((c: any) => c.characterId === id).map((c: any) => ({ ...c, characterId: newId })),
          inventory: grimoireInv.filter((inv: any) => inv.characterId === id).map((i: any) => ({ ...i, characterId: newId })),
          essences: grimoireEss.filter((ess: any) => ess.characterId === id).map((e: any) => ({ ...e, characterId: newId })),
          abilities: grimoireAbils.filter((ab: any) => ab.characterId === id).map((a: any) => ({ ...a, characterId: newId })),
          skills: grimoireSkills.filter((sk: any) => sk.characterId === id).map((s: any) => ({ ...s, characterId: newId })),
        };

        activeRoster.push(bundle);
      });

      saveChronicleRoster(activeRoster);
      setIsBulkImportOpen(false);
      setSelectedGrimoireChars([]);
      toast.success(`Cloned ${selectedGrimoireChars.length} characters into the Chronicle roster.`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to import characters.");
    }
  };

  const handleToggleSelectGrimoire = (id: number) => {
    setSelectedGrimoireChars(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Add character from Chronicle roster database onto active board grid
  const handlePlaceOnBoard = (charId: number) => {
    // Check if already placed on active board
    const exists = placements.some(p => p.characterId === charId && p.boardId === activeBoardId);
    if (exists) {
      toast.info("Character is already placed on this board.");
      return;
    }

    // Find first empty cell on grid (10 columns, 8 rows)
    let placed = false;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 10; col++) {
        const hasCard = placements.some(p => p.boardId === activeBoardId && p.col === col && p.row === row);
        if (!hasCard) {
          const newP = [...placements, { characterId: charId, boardId: activeBoardId, col, row }];
          savePlacements(newP);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) toast.error("No empty grid cells remaining on board.");
  };

  // Drag and Drop Snapping Event Handlers
  const handleDragStart = (charId: number | string) => {
    setDraggedCharId(charId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (col: number, row: number) => {
    if (draggedCharId === null) return;

    // Check if target slot is occupied
    const occupied = placements.some(p => p.boardId === activeBoardId && p.col === col && p.row === row);
    if (occupied) {
      toast.info("Grid slot is occupied.");
      return;
    }

    // Find placement and move it
    const index = placements.findIndex(p => p.characterId === draggedCharId && p.boardId === activeBoardId);
    if (index !== -1) {
      const newList = [...placements];
      newList[index] = { ...newList[index], col, row };
      savePlacements(newList);
    } else {
      // Placing from roster list via drag
      const newList = [...placements, { characterId: draggedCharId, boardId: activeBoardId, col, row }];
      savePlacements(newList);
    }
    setDraggedCharId(null);
  };

  const handleRemoveFromBoard = (charId: number) => {
    const newList = placements.filter(p => !(p.characterId === charId && p.boardId === activeBoardId));
    savePlacements(newList);
  };

  // Sync Resource trackers updates back to roster storage
  const updateResource = (charId: number, type: "hp" | "mana" | "dt", val: number) => {
    const updated = chronicleRoster.map(item => {
      if (item.character.id === charId) {
        const char = item.character;
        if (type === "hp") {
          const current = Math.max(0, Math.min(char.maxHp, char.currentHp + val));
          return { ...item, character: { ...char, currentHp: current } };
        } else if (type === "mana") {
          const maxMana = char.spirit * 3 + char.level * 2; // general mana ceiling formula
          const current = Math.max(0, Math.min(maxMana, char.currentMana + val));
          return { ...item, character: { ...char, currentMana: current } };
        } else if (type === "dt") {
          const current = Math.max(0, char.currentDt + val);
          return { ...item, character: { ...char, currentDt: current } };
        }
      }
      return item;
    });
    saveChronicleRoster(updated);
  };

  // Roll checks inside DM screen
  const triggerD20Check = (charName: string, statLabel: string, mod: number) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + mod;
    toast.success(`${charName} rolled ${statLabel} check: [D20: ${roll} + Mod: ${mod}] = ${total}!`);
  };

  return (
    <div className="min-h-screen text-stone-100 py-6 px-4 sm:px-6 relative flex flex-col font-serif">
      <style>{`
        .glass-panel {
          background-color: rgba(22, 17, 12, 0.45);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(139, 92, 26, 0.25);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }
        .text-glow {
          text-shadow: 0 0 10px rgba(14, 165, 233, 0.4);
        }
      `}</style>

      {/* Background spotlights */}
      <div className="absolute inset-0 bg-[#06080b] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-950/5 via-[#080b10] to-[#040608] pointer-events-none" />

      {/* Header bar */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between border-b border-sky-950/40 pb-4 z-10 relative">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="border border-sky-900/30 text-sky-500 hover:bg-sky-500/10 rounded-md cursor-pointer h-9 px-3 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Bookshelf
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-wider bg-gradient-to-r from-sky-400 via-stone-200 to-sky-400 bg-clip-text text-transparent">
              Chronicle of the Creator
            </h1>
            <span className="text-[9px] font-mono tracking-widest text-sky-600 uppercase block">Dungeon Master Screen & Roster Tool</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeView === "dashboard" ? (
            <Button
              onClick={() => setActiveView("info-tool")}
              className="bg-sky-950/80 border border-sky-600/40 text-sky-400 hover:bg-sky-500/15 rounded-md text-xs font-bold font-serif flex items-center gap-1.5 h-9 cursor-pointer"
            >
              <Move className="w-4 h-4" /> Open Character Info Tool
            </Button>
          ) : (
            <Button
              onClick={() => setActiveView("dashboard")}
              className="bg-stone-900 border border-border/40 text-stone-300 hover:bg-accent/40 rounded-md text-xs font-bold font-serif flex items-center gap-1.5 h-9 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" /> Return to DM Screen
            </Button>
          )}
          <CustomizeToolDialog />
        </div>
      </header>

      {/* View 1: DM Screen Dashboard */}
      {activeView === "dashboard" && (
        <main className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 z-10 relative flex-1">
          {/* Column 1: Rules Codex & NPCs */}
          <div className="space-y-6">
            {/* Rules Reference Cheatsheet */}
            <div className="glass-panel p-5 rounded-lg space-y-4">
              <h2 className="text-sm font-bold text-sky-500 uppercase tracking-widest border-b border-sky-950/40 pb-1.5 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Rules Reference
              </h2>
              <div className="relative">
                <Input
                  value={rulesSearch}
                  onChange={e => setRulesSearch(e.target.value)}
                  placeholder="Search rules, spells, combat..."
                  className="bg-stone-950/50 border-stone-800 rounded-md h-8 text-xs pl-8 font-sans"
                />
                <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {RULES_CODEX.filter(r => r.title.toLowerCase().includes(rulesSearch.toLowerCase()) || r.details.toLowerCase().includes(rulesSearch.toLowerCase()))
                  .map((rule, idx) => (
                    <div key={idx} className="border border-sky-950/30 p-3 bg-stone-950/20 rounded-md space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] text-sky-600 uppercase font-bold tracking-wider">{rule.category}</span>
                        <span className="font-bold text-stone-300">{rule.title}</span>
                      </div>
                      <p className="text-stone-400 font-sans leading-relaxed">{rule.details}</p>
                    </div>
                  ))}
              </div>
            </div>

            {/* NPC & Loot Rollers */}
            <div className="glass-panel p-5 rounded-lg space-y-4">
              <h2 className="text-sm font-bold text-sky-500 uppercase tracking-widest border-b border-sky-950/40 pb-1.5 flex items-center gap-2">
                <Dice5 className="w-4 h-4" /> Random Roll Generators
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={handleGenerateNpc}
                  className="bg-sky-950/45 border border-sky-900/35 text-sky-400 hover:bg-sky-500/10 text-xs font-serif font-bold rounded-md h-8 cursor-pointer"
                >
                  Generate NPC
                </Button>
                <Button 
                  onClick={handleGenerateLoot}
                  className="bg-sky-950/45 border border-sky-900/35 text-sky-400 hover:bg-sky-500/10 text-xs font-serif font-bold rounded-md h-8 cursor-pointer"
                >
                  Roll Loot Check
                </Button>
              </div>

              {generatedNpc && (
                <div className="border border-sky-900/20 bg-stone-950/30 p-3 rounded-md text-xs space-y-1.5">
                  <div className="font-bold text-sky-400">{generatedNpc.name}</div>
                  <div className="grid grid-cols-2 gap-1 font-sans text-stone-400">
                    <div><span className="font-serif font-bold text-[10px] text-stone-500">Trait:</span> {generatedNpc.trait}</div>
                    <div><span className="font-serif font-bold text-[10px] text-stone-500">Faction:</span> {generatedNpc.faction}</div>
                  </div>
                  <div className="text-[10px] font-mono text-sky-600/80">Calculated Encounter Mood: D20 Roll {generatedNpc.roll}</div>
                </div>
              )}

              {generatedLoot && (
                <div className="border border-sky-900/20 bg-stone-950/30 p-3 rounded-md text-xs font-sans text-stone-300 leading-relaxed">
                  {generatedLoot}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Initiative Turn Tracker */}
          <div className="glass-panel p-5 rounded-lg space-y-4">
            <h2 className="text-sm font-bold text-sky-500 uppercase tracking-widest border-b border-sky-950/40 pb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> Combat Initiative</span>
              <span className="text-xs font-mono bg-sky-950/40 border border-sky-900/25 px-2 py-0.5 text-sky-400 font-bold uppercase">Round {roundCount}</span>
            </h2>

            {/* Add Combatant Form */}
            <form onSubmit={handleAddCombatant} className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-1">
                <label className="text-[9px] font-bold text-stone-500 uppercase block mb-1">Name</label>
                <Input
                  value={initName}
                  onChange={e => setInitName(e.target.value)}
                  placeholder="Garrick..."
                  required
                  className="bg-stone-950/50 border-stone-850 h-8 text-xs font-sans"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-stone-500 uppercase block mb-1">Init Roll</label>
                <Input
                  type="number"
                  value={initScore}
                  onChange={e => setInitScore(e.target.value)}
                  placeholder="18"
                  className="bg-stone-950/50 border-stone-850 h-8 text-xs font-sans"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-stone-500 uppercase block mb-1">Max HP</label>
                <Input
                  type="number"
                  value={initHp}
                  onChange={e => setInitHp(e.target.value)}
                  placeholder="45"
                  className="bg-stone-950/50 border-stone-850 h-8 text-xs font-sans"
                />
              </div>
              <Button type="submit" className="col-span-3 bg-sky-950 text-sky-400 border border-sky-600/40 hover:bg-sky-500/10 text-xs font-bold rounded-md h-8 mt-2 cursor-pointer">
                + Add Combatant
              </Button>
            </form>

            {/* Combatants List */}
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1">
              {combatants.length === 0 ? (
                <div className="text-center py-8 text-stone-600 italic border border-dashed border-border/10 rounded-md text-xs">
                  Combat queue is empty.
                </div>
              ) : (
                combatants.map((c, idx) => {
                  const isActive = idx === currentTurnIdx;
                  return (
                    <div 
                      key={c.id} 
                      className={`flex items-center justify-between p-2.5 border rounded-md transition-all ${
                        isActive 
                          ? "border-sky-500 bg-sky-500/10 shadow-md text-sky-300 font-bold" 
                          : "border-sky-950/45 bg-stone-950/20 text-stone-400"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isActive && <ChevronRight className="w-4 h-4 text-sky-400 animate-pulse" />}
                        <span className="font-sans text-xs">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="font-sans text-[10px] text-stone-500">Init: <span className="font-serif font-bold text-foreground">{c.score}</span></div>
                        <div className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5 text-red-500" />
                          <input
                            type="number"
                            value={c.hp}
                            onChange={(e) => {
                              const v = parseInt(e.target.value) || 0;
                              setCombatants(prev => prev.map(x => x.id === c.id ? { ...x, hp: v } : x));
                            }}
                            className="w-10 h-5 text-center font-mono text-[10px] bg-background/50 border border-border/40 rounded px-0.5 text-foreground"
                          />
                        </div>
                        <button 
                          onClick={() => setCombatants(prev => prev.filter(x => x.id !== c.id))}
                          className="text-stone-700 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Step Turn controls */}
            {combatants.length > 0 && (
              <div className="grid grid-cols-3 gap-2 border-t border-sky-950/30 pt-3">
                <Button 
                  onClick={() => stepTurn(-1)}
                  className="bg-stone-900 border border-border/30 text-stone-400 hover:bg-accent/40 rounded-md h-8 text-xs cursor-pointer font-bold"
                >
                  Prev Turn
                </Button>
                <Button 
                  onClick={() => {
                    setCombatants([]);
                    setCurrentTurnIdx(0);
                    setRoundCount(1);
                  }}
                  className="bg-stone-950 text-red-500/80 border border-red-900/30 hover:bg-red-500/10 rounded-md h-8 text-xs cursor-pointer font-bold"
                >
                  Clear Queue
                </Button>
                <Button 
                  onClick={() => stepTurn(1)}
                  className="bg-sky-950 text-sky-400 border border-sky-600/40 hover:bg-sky-500/10 rounded-md h-8 text-xs cursor-pointer font-bold"
                >
                  Next Turn
                </Button>
              </div>
            )}
          </div>

          {/* Column 3: Soundscape Mixer & Campaign Secrets */}
          <div className="space-y-6">
            {/* Atmospheric soundscape controllers */}
            <div className="glass-panel p-5 rounded-lg space-y-4">
              <h2 className="text-sm font-bold text-sky-500 uppercase tracking-widest border-b border-sky-950/40 pb-1.5 flex items-center gap-2">
                <Volume2 className="w-4 h-4" /> Soundscape Mixer Simulator
              </h2>
              <div className="space-y-3 font-sans text-xs">
                {Object.keys(soundscapeVolume).map((key) => {
                  const name = key.toUpperCase();
                  const isActive = soundActive[key as keyof typeof soundActive];
                  const vol = soundscapeVolume[key as keyof typeof soundscapeVolume];
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold transition-colors ${isActive ? "text-sky-400" : "text-stone-600"}`}>{name}</span>
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setSoundActive(prev => ({ ...prev, [key]: e.target.checked }))}
                          className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={vol}
                          disabled={!isActive}
                          onChange={(e) => setSoundscapeVolume(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                          className="w-full accent-primary h-1 bg-stone-900 rounded-lg cursor-pointer"
                        />
                        <span className="font-mono text-[9px] text-stone-500 w-8 text-right">{isActive ? `${vol}%` : "OFF"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Campaign Secrets Log notes editor */}
            <div className="glass-panel p-5 rounded-lg space-y-3">
              <h2 className="text-sm font-bold text-sky-500 uppercase tracking-widest border-b border-sky-950/40 pb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-2"><Save className="w-4 h-4" /> DM Secret Logs</span>
                <span className="text-[8px] font-mono uppercase text-stone-500 tracking-wider">Syncs Local</span>
              </h2>
              <Textarea
                value={dmNotes}
                onChange={e => saveDmNotes(e.target.value)}
                placeholder="Write secret plot hooks, villain plans, or treasure locations here..."
                className="bg-stone-950/50 border-stone-850 text-xs font-sans min-h-[140px] text-stone-300 leading-relaxed focus:border-sky-600/30"
              />
            </div>
          </div>
        </main>
      )}

      {/* View 2: Character Info Tool (Drag-and-Drop Workspace Canvas) */}
      {activeView === "info-tool" && (
        <main className="flex-1 max-w-[1400px] w-full mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6 z-10 relative items-start">
          
          {/* Left sidebar: Chronicle Roster and Add/Import options */}
          <div className="lg:col-span-1 glass-panel p-5 rounded-lg space-y-6">
            <div>
              <h2 className="text-sm font-bold text-sky-500 uppercase tracking-widest border-b border-sky-950/40 pb-1.5 flex items-center justify-between">
                <span>Chronicle Roster</span>
                <span className="text-[10px] font-mono bg-sky-950/40 border border-sky-900/25 px-2 py-0.5 text-sky-400 font-bold">{chronicleRoster.length} Tomes</span>
              </h2>
              <div className="relative mt-3">
                <Input
                  value={rosterSearch}
                  onChange={e => setRosterSearch(e.target.value)}
                  placeholder="Filter roster..."
                  className="bg-stone-950/50 border-stone-800 rounded-md h-8 text-xs pl-8 font-sans"
                />
                <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Chronicle Roster list directory */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {chronicleRoster.length === 0 ? (
                <div className="text-center py-6 text-stone-600 italic border border-dashed border-border/10 rounded-md text-xs">
                  Chronicle database is empty.
                </div>
              ) : (
                chronicleRoster
                  .filter(item => item.character.name.toLowerCase().includes(rosterSearch.toLowerCase()))
                  .map((item) => {
                    const char = item.character;
                    return (
                      <div 
                        key={char.id}
                        draggable
                        onDragStart={() => handleDragStart(char.id)}
                        className="p-3 border border-sky-950/45 bg-stone-950/20 hover:border-sky-600/30 rounded-md transition-all flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing group"
                      >
                        <div className="font-sans text-xs">
                          <div className="font-serif font-bold text-foreground group-hover:text-sky-400 transition-colors">{char.name}</div>
                          <div className="text-[10px] text-muted-foreground">Level {char.level} · {char.race}</div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handlePlaceOnBoard(char.id)}
                          className="h-6 text-[9px] bg-sky-950 border border-sky-600/30 text-sky-400 hover:bg-sky-500/10 px-2 font-serif font-bold"
                          title="Place on Board Grid"
                        >
                          + Add
                        </Button>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Roster database actions */}
            <div className="border-t border-sky-950/30 pt-4 space-y-2">
              <Button
                onClick={() => setIsBulkImportOpen(true)}
                className="w-full bg-sky-950 border border-sky-600/40 text-sky-400 hover:bg-sky-500/10 text-xs font-bold rounded-md h-9 cursor-pointer flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" /> Import from Grimoire
              </Button>
            </div>
          </div>

          {/* Right canvas board: Workspace Grid and Formation tabs */}
          <div className="lg:col-span-3 space-y-4 flex flex-col h-full min-h-[600px]">
            {/* Formation Tabs bar */}
            <div className="flex items-center justify-between border-b border-sky-950/40 pb-2">
              <div className="flex items-center gap-2 overflow-x-auto pr-2">
                {boards.map(b => {
                  const isActive = b.id === activeBoardId;
                  return (
                    <div key={b.id} className="flex items-center gap-1 bg-stone-950/45 border border-sky-950/40 px-2.5 py-1 rounded-md">
                      <button
                        onClick={() => setActiveBoardId(b.id)}
                        className={`text-xs font-serif tracking-wide transition-colors cursor-pointer ${isActive ? "text-sky-400 font-bold" : "text-stone-500 hover:text-stone-300"}`}
                      >
                        {b.name}
                      </button>
                      <button 
                        onClick={() => handleDeleteBoard(b.id)}
                        className="text-stone-700 hover:text-red-500/80 transition-colors ml-1"
                        title="Delete Board"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <Button 
                  onClick={() => setIsNewBoardDialogOpen(true)}
                  className="bg-sky-950/50 border border-sky-600/30 text-sky-400 hover:bg-sky-500/10 text-[10px] font-bold rounded h-6 px-2 cursor-pointer"
                >
                  + Add Board
                </Button>
              </div>
              <span className="text-[9px] font-mono text-stone-600 uppercase tracking-widest hidden md:inline">Drag cards to custom slots</span>
            </div>

            {/* The Invisible Drag Grid Canvas Board */}
            <div className="flex-1 w-full overflow-x-auto border border-sky-950/30 bg-stone-950/10 rounded-lg min-h-[500px] p-4 relative">
              
              {/* Horizontal grid board sizing */}
              <div className="grid grid-cols-10 gap-4 min-w-[1600px] h-[580px] select-none">
                {Array(8).fill(null).map((_, row) => {
                  return Array(10).fill(null).map((_, col) => {
                    // Check if placement exists at this cell
                    const placement = placements.find(p => p.boardId === activeBoardId && p.col === col && p.row === row);
                    const item = placement ? chronicleRoster.find(r => r.character.id === placement.characterId) : null;
                    
                    return (
                      <div
                        key={`${row}-${col}`}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(col, row)}
                        className={`col-span-1 border border-stone-900/15 rounded-md flex items-center justify-center p-0.5 relative transition-colors ${
                          placement ? "bg-stone-950/45 border-sky-900/25" : "bg-stone-950/5 hover:bg-sky-950/5 border-dashed border-stone-950/30"
                        }`}
                        style={{ height: "260px", width: "150px" }}
                      >
                        {item ? (
                          // Mini Resource Card Component
                          <div 
                            draggable
                            onDragStart={() => handleDragStart(item.character.id)}
                            className="w-full h-full flex flex-col justify-between p-3 font-serif cursor-grab active:cursor-grabbing relative"
                          >
                            {/* Card header details */}
                            <div className="flex justify-between items-start gap-1">
                              <div className="truncate pr-1">
                                <div className="text-[11px] font-bold text-foreground leading-tight truncate">{item.character.name}</div>
                                <span className="text-[8px] font-mono text-stone-500 uppercase tracking-widest">Level {item.character.level}</span>
                              </div>
                              <button 
                                onClick={() => handleRemoveFromBoard(item.character.id)}
                                className="text-stone-700 hover:text-red-500/80 transition-colors text-[10px]"
                                title="Remove from Board"
                              >
                                ×
                              </button>
                            </div>

                            {/* Resource Trackers panel */}
                            <div className="space-y-2 py-2">
                              {/* HP Tracker */}
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="font-bold text-red-500 flex items-center gap-0.5"><Heart className="w-3 h-3" /> HP</span>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => updateResource(item.character.id, "hp", -1)} className="text-[9px] font-mono border border-border/20 px-1 bg-stone-900 text-stone-400 hover:bg-accent/40 rounded">-</button>
                                  <span className="font-mono text-foreground font-bold w-9 text-center">{item.character.currentHp}/{item.character.maxHp}</span>
                                  <button onClick={() => updateResource(item.character.id, "hp", 1)} className="text-[9px] font-mono border border-border/20 px-1 bg-stone-900 text-stone-400 hover:bg-accent/40 rounded">+</button>
                                </div>
                              </div>

                              {/* Mana Tracker */}
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="font-bold text-sky-500 flex items-center gap-0.5"><Activity className="w-3 h-3" /> MP</span>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => updateResource(item.character.id, "mana", -1)} className="text-[9px] font-mono border border-border/20 px-1 bg-stone-900 text-stone-400 hover:bg-accent/40 rounded">-</button>
                                  <span className="font-mono text-foreground font-bold w-9 text-center">
                                    {item.character.currentMana}/{item.character.spirit * 3 + item.character.level * 2}
                                  </span>
                                  <button onClick={() => updateResource(item.character.id, "mana", 1)} className="text-[9px] font-mono border border-border/20 px-1 bg-stone-900 text-stone-400 hover:bg-accent/40 rounded">+</button>
                                </div>
                              </div>

                              {/* DT Tracker */}
                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="font-bold text-amber-500 flex items-center gap-0.5"><Shield className="w-3 h-3" /> DT</span>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => updateResource(item.character.id, "dt", -1)} className="text-[9px] font-mono border border-border/20 px-1 bg-stone-900 text-stone-400 hover:bg-accent/40 rounded">-</button>
                                  <span className="font-mono text-foreground font-bold w-9 text-center">{item.character.currentDt}</span>
                                  <button onClick={() => updateResource(item.character.id, "dt", 1)} className="text-[9px] font-mono border border-border/20 px-1 bg-stone-900 text-stone-400 hover:bg-accent/40 rounded">+</button>
                                </div>
                              </div>
                            </div>

                            {/* Core Stat Quick Roll triggers */}
                            <div className="grid grid-cols-3 gap-1 border-t border-sky-950/20 pt-1.5">
                              {[
                                { key: "pow", label: "POW", val: Math.floor((item.character.power - 10) / 2) },
                                { key: "vit", label: "VIT", val: Math.floor((item.character.vitality - 10) / 2) },
                                { key: "spi", label: "SPI", val: Math.floor((item.character.spirit - 10) / 2) },
                                { key: "agi", label: "AGI", val: Math.floor((item.character.agility - 10) / 2) },
                                { key: "will", label: "WIL", val: Math.floor((item.character.willpower - 10) / 2) },
                                { key: "cha", label: "CHA", val: Math.floor((item.character.charisma - 10) / 2) }
                              ].map(st => (
                                <button
                                  key={st.key}
                                  onClick={() => triggerD20Check(item.character.name, st.label, st.val)}
                                  className="text-[8px] font-sans text-center border border-border/20 py-0.5 rounded hover:bg-accent/30 text-stone-400 font-bold"
                                  title={`${st.label} check: d20 + ${st.val}`}
                                >
                                  {st.label} ({st.val >= 0 ? `+${st.val}` : st.val})
                                </button>
                              ))}
                            </div>

                            <Button 
                              onClick={() => {
                                setInspectingChar(item);
                                setInspectorTab("stats");
                              }}
                              className="w-full bg-sky-950 border border-sky-600/30 text-sky-400 hover:bg-sky-500/10 text-[9px] font-bold rounded h-5 mt-2 cursor-pointer"
                            >
                              Expand Sheet
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* dialog 1: Create Board dialog */}
      <Dialog open={isNewBoardDialogOpen} onOpenChange={setIsNewBoardDialogOpen}>
        <DialogContent className="sm:max-w-[360px] bg-card border border-border shadow-2xl rounded-md p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-primary font-bold border-b border-border/30 pb-2">
              Create Formation Tab
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBoard} className="space-y-4 pt-3 font-sans text-xs">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Board Name</label>
              <Input
                value={newBoardName}
                onChange={e => setNewBoardName(e.target.value)}
                placeholder="e.g. Castle Siege, Faction Roster"
                required
                className="bg-background rounded-md h-8 text-xs font-serif"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsNewBoardDialogOpen(false)} className="rounded-md font-bold text-xs h-8">
                Cancel
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground font-bold text-xs rounded-md h-8 px-4">
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* dialog 2: Bulk import from Grimoire checkboxes checklist dialog */}
      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
          <div className="absolute inset-1 border border-border/10 pointer-events-none" />
          <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-primary font-bold border-b border-border/30 pb-2 flex items-center gap-2 z-10 relative">
              <Upload className="w-5 h-5" /> Bulk Import from Grimoire
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4 font-serif z-10 relative text-xs">
            <p className="text-muted-foreground font-sans leading-relaxed">
              Select one or more characters from your Grimoire roster to duplicate them into the Chronicle of the Creator database.
            </p>

            {grimoireCharacters.length === 0 ? (
              <div className="text-center py-8 text-stone-500 italic border border-dashed border-border/20 bg-background/20 rounded-md">
                No active Grimoire characters found.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {grimoireCharacters.map((char: any) => {
                  const isChecked = selectedGrimoireChars.includes(char.id);
                  return (
                    <div
                      key={char.id}
                      onClick={() => handleToggleSelectGrimoire(char.id)}
                      className={`flex items-center gap-3 p-3 border transition-all cursor-pointer rounded-md ${
                        isChecked 
                          ? "border-primary bg-primary/10" 
                          : "border-border/50 bg-background/30 hover:bg-accent/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Div onClick handles it
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                      />
                      <div className="text-left font-sans flex-1">
                        <div className="text-xs font-bold text-foreground">{char.name}</div>
                        <div className="text-[10px] text-muted-foreground">Level {char.level} · {char.race} {char.rank}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border/30 z-10 relative">
            <Button variant="ghost" size="sm" onClick={() => setIsBulkImportOpen(false)} className="rounded-md font-bold text-xs">
              Cancel
            </Button>
            <Button 
              onClick={handleBulkImport} 
              disabled={selectedGrimoireChars.length === 0} 
              className="bg-primary text-primary-foreground font-bold text-xs rounded-md shadow px-4"
            >
              Import Selected ({selectedGrimoireChars.length})
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* dialog 3: Expand character sheet sheet popup inspector (Notes tab excluded) */}
      {inspectingChar && (
        <Dialog open={inspectingChar !== null} onOpenChange={(open) => { if (!open) setInspectingChar(null); }}>
          <DialogContent className="sm:max-w-[850px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
            <div className="absolute inset-1 border border-border/10 pointer-events-none" />
            <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

            <DialogHeader className="border-b border-border/30 pb-3 z-10 relative">
              <div className="flex items-center justify-between">
                <DialogTitle className="font-serif text-2xl text-primary font-bold">
                  Character Sheet Inspector: {inspectingChar.character.name}
                </DialogTitle>
                <span className="text-xs font-mono bg-primary/10 border border-primary/25 px-2 py-0.5 rounded text-primary">Level {inspectingChar.character.level}</span>
              </div>

              {/* Inspector tabs */}
              <div className="flex gap-2 mt-3 overflow-x-auto py-1">
                {[
                  { id: "stats", label: "Stats & Vitals" },
                  { id: "abilities", label: "Abilities" },
                  { id: "equipment", label: "Equipment" },
                  { id: "essences", label: "Essences" },
                  { id: "familiars", label: "Familiars" }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setInspectorTab(t.id as any)}
                    className={`px-3 py-1 font-serif text-xs rounded transition-all cursor-pointer ${
                      inspectorTab === t.id
                        ? "bg-primary text-primary-foreground font-bold"
                        : "border border-border/40 hover:bg-accent/40 text-stone-400"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </DialogHeader>

            {/* Inspector tab panels */}
            <div className="py-4 font-sans text-xs z-10 relative leading-relaxed">
              {/* Tab 1: Stats & Vitals */}
              {inspectorTab === "stats" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {[
                      { label: "Power", val: inspectingChar.character.power },
                      { label: "Vitality", val: inspectingChar.character.vitality },
                      { label: "Spirit", val: inspectingChar.character.spirit },
                      { label: "Agility", val: inspectingChar.character.agility },
                      { label: "Endurance", val: inspectingChar.character.endurance },
                      { label: "Precision", val: inspectingChar.character.precision },
                      { label: "Willpower", val: inspectingChar.character.willpower },
                      { label: "Charisma", val: inspectingChar.character.charisma }
                    ].map(st => (
                      <div key={st.label} className="border border-border/40 bg-background/30 p-2.5 rounded-md">
                        <div className="text-[10px] font-bold text-stone-500 uppercase">{st.label}</div>
                        <div className="text-lg font-serif font-bold text-foreground mt-0.5">{st.val}</div>
                      </div>
                    ))}
                  </div>

                  <div className="border border-border/30 bg-background/20 p-4 rounded-md space-y-2">
                    <span className="font-serif font-bold text-primary">Metadata Sheet</span>
                    <div className="grid grid-cols-2 gap-2 text-stone-400 font-sans">
                      <div>Race: <span className="text-stone-200">{inspectingChar.character.race}</span></div>
                      <div>Rank: <span className="text-stone-200">{inspectingChar.character.rank}</span></div>
                      <div>Speed: <span className="text-stone-200">{inspectingChar.character.speed} ft</span></div>
                      <div>Max HP Ceiling: <span className="text-stone-200">{inspectingChar.character.maxHp} HP</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Abilities list */}
              {inspectorTab === "abilities" && (
                <div className="space-y-3">
                  {(!inspectingChar.abilities || inspectingChar.abilities.length === 0) ? (
                    <div className="text-center py-8 text-stone-500 italic border border-dashed border-border/10 rounded-md">
                      No shaped abilities mapped.
                    </div>
                  ) : (
                    inspectingChar.abilities.map((ab: any) => (
                      <div key={ab.id} className="border border-border/30 bg-background/20 p-3 rounded-md space-y-1.5">
                        <div className="flex items-center justify-between border-b border-border/15 pb-1">
                          <span className="font-serif font-bold text-primary text-xs">{ab.name}</span>
                          <span className="font-mono text-[9px] uppercase px-1.5 bg-primary/10 text-primary border border-primary/20">{ab.type || "Casting"}</span>
                        </div>
                        <p className="text-stone-400 leading-relaxed font-sans">{ab.description || "No ability description logged."}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: Equipment list */}
              {inspectorTab === "equipment" && (
                <div className="space-y-3">
                  {(!inspectingChar.equipment || inspectingChar.equipment.length === 0) ? (
                    <div className="text-center py-8 text-stone-500 italic border border-dashed border-border/10 rounded-md">
                      No items equipped.
                    </div>
                  ) : (
                    inspectingChar.equipment.map((eq: any) => (
                      <div key={eq.id} className="border border-border/30 bg-background/20 p-3 rounded-md flex justify-between items-center">
                        <div className="space-y-0.5">
                          <div className="font-serif font-bold text-stone-200">{eq.name}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{eq.slot || "Slot Item"}</div>
                        </div>
                        <div className="text-stone-400 font-mono text-[10px]">Rank {eq.rank || "Standard"}</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 4: Essences details */}
              {inspectorTab === "essences" && (
                <div className="space-y-3">
                  {(!inspectingChar.essences || inspectingChar.essences.length === 0) ? (
                    <div className="text-center py-8 text-stone-500 italic border border-dashed border-border/10 rounded-md">
                      No Essence crystals infused.
                    </div>
                  ) : (
                    inspectingChar.essences.map((es: any) => (
                      <div key={es.id} className="border border-border/30 bg-background/20 p-3 rounded-md space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-serif font-bold text-primary">{es.name}</span>
                          <span className="font-mono text-[9px] text-sky-400 uppercase tracking-widest">{es.rarity || "Infused"}</span>
                        </div>
                        <p className="text-stone-400 font-sans">{es.effect || "Core Essence crystal effect details."}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 5: Familiars sheets */}
              {inspectorTab === "familiars" && (
                <div className="space-y-4">
                  {(!inspectingChar.character.familiars || inspectingChar.character.familiars.length === 0) ? (
                    <div className="text-center py-8 text-stone-500 italic border border-dashed border-border/10 rounded-md">
                      No familiars bound to this hero.
                    </div>
                  ) : (
                    inspectingChar.character.familiars.map((fam: any) => (
                      <div key={fam.id} className="border border-border/30 bg-background/20 p-4 rounded-md space-y-3">
                        <div className="flex justify-between items-center border-b border-border/15 pb-1.5">
                          <div>
                            <span className="font-serif font-bold text-primary text-sm">{fam.name}</span>
                            <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider block">Bound Familiar</span>
                          </div>
                          <span className="text-xs font-mono bg-sky-950 border border-sky-900/30 px-2 py-0.5 rounded text-sky-400">Level {fam.level}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px] font-sans">
                          <div><span className="font-serif font-bold text-stone-500">HP:</span> {fam.currentHp}/{fam.currentHp}</div>
                          <div><span className="font-serif font-bold text-stone-500">Mana:</span> {fam.currentMana}</div>
                          <div><span className="font-serif font-bold text-stone-500">Speed:</span> {fam.speed} ft</div>
                          <div><span className="font-serif font-bold text-stone-500">Race:</span> {fam.race}</div>
                        </div>

                        {fam.abilities && fam.abilities.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            <span className="font-serif text-[10px] font-bold text-stone-400 block uppercase tracking-wider">Familiar Actions</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {fam.abilities.map((ab: any, aIdx: number) => (
                                <div key={aIdx} className="border border-border/20 p-2 bg-stone-950/20 rounded text-[11px]">
                                  <div className="font-bold text-stone-200">{ab.name}</div>
                                  <div className="text-[10px] text-stone-500 mt-0.5">{ab.range} · Cost {ab.cost} MP</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border/30 z-10 relative">
              <Button variant="ghost" size="sm" onClick={() => setInspectingChar(null)} className="rounded-md font-bold text-xs h-8">
                Close Inspector
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
