import React, { useState, useRef } from "react";
import { useListCharacters, useCreateCharacter, useListRecaps, useCreateRecap, useDeleteRecap, useListUnlockedPasswords } from "@/hooks/useStorage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Loader2, Plus, Trash2, BookOpen, Upload, Download, ChevronDown, Library } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { CustomizeToolDialog } from "@/components/dialogs/customize-tool-dialog";
import { RollGuideDialog } from "@/components/dialogs/roll-guide-dialog";
import { exportGrimoireBackup, importGrimoireBackup } from "@/lib/storage";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export default function Dashboard() {
  const { data: characters, isLoading: loadingChars } = useListCharacters();
  const { data: recaps, isLoading: loadingRecaps } = useListRecaps();
  const createCharacter = useCreateCharacter();
  const createRecap = useCreateRecap();
  const deleteRecap = useDeleteRecap();
  const [, setLocation] = useLocation();
  const { data: unlockedPasswords = [] } = useListUnlockedPasswords();

  const isChronicleUnlocked = unlockedPasswords.some(pw => {
    const sanitize = (str: string) => 
      (str || "")
        .trim()
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“]/g, "")
        .replace(/\s+/g, " ");
    return sanitize(pw) === "please show me the way";
  });

  const [isChronicleImportOpen, setIsChronicleImportOpen] = useState(false);
  const [selectedChronicleChars, setSelectedChronicleChars] = useState<number[]>([]);

  const getChronicleCharacters = () => {
    try {
      const data = localStorage.getItem("aetherborne_chronicle_characters");
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const chronicleChars = getChronicleCharacters();

  const handleImportFromChronicle = () => {
    if (selectedChronicleChars.length === 0) return;
    try {
      const grimoireChars = JSON.parse(localStorage.getItem("aetherborne_characters") || "[]");
      const grimoireEquip = JSON.parse(localStorage.getItem("aetherborne_equipment") || "[]");
      const grimoireCurr = JSON.parse(localStorage.getItem("aetherborne_currencies") || "[]");
      const grimoireInv = JSON.parse(localStorage.getItem("aetherborne_inventory") || "[]");
      const grimoireEss = JSON.parse(localStorage.getItem("aetherborne_essences") || "[]");
      const grimoireAbils = JSON.parse(localStorage.getItem("aetherborne_abilities") || "[]");
      const grimoireSkills = JSON.parse(localStorage.getItem("aetherborne_skills") || "[]");

      const chronicleBundles = getChronicleCharacters();

      selectedChronicleChars.forEach(id => {
        const bundle = chronicleBundles.find((b: any) => b.character.id === id);
        if (!bundle) return;

        const newCharId = grimoireChars.length > 0 ? Math.max(...grimoireChars.map((c: any) => c.id)) + 1 : 1;

        const clonedChar = { ...bundle.character, id: newCharId };
        grimoireChars.push(clonedChar);

        if (Array.isArray(bundle.equipment)) {
          bundle.equipment.forEach((eq: any) => {
            const newEqId = grimoireEquip.length > 0 ? Math.max(...grimoireEquip.map((e: any) => e.id)) + 1 : 1;
            grimoireEquip.push({ ...eq, id: newEqId, characterId: newCharId });
          });
        }
        if (Array.isArray(bundle.currencies)) {
          bundle.currencies.forEach((curr: any) => {
            const newCurrId = grimoireCurr.length > 0 ? Math.max(...grimoireCurr.map((c: any) => c.id)) + 1 : 1;
            grimoireCurr.push({ ...curr, id: newCurrId, characterId: newCharId });
          });
        }
        if (Array.isArray(bundle.inventory)) {
          bundle.inventory.forEach((inv: any) => {
            const newInvId = grimoireInv.length > 0 ? Math.max(...grimoireInv.map((i: any) => i.id)) + 1 : 1;
            grimoireInv.push({ ...inv, id: newInvId, characterId: newCharId });
          });
        }
        if (Array.isArray(bundle.essences)) {
          bundle.essences.forEach((ess: any) => {
            const newEssId = grimoireEss.length > 0 ? Math.max(...grimoireEss.map((e: any) => e.id)) + 1 : 1;
            grimoireEss.push({ ...ess, id: newEssId, characterId: newCharId });
          });
        }
        if (Array.isArray(bundle.abilities)) {
          bundle.abilities.forEach((ab: any) => {
            const newAbId = grimoireAbils.length > 0 ? Math.max(...grimoireAbils.map((a: any) => a.id)) + 1 : 1;
            grimoireAbils.push({ ...ab, id: newAbId, characterId: newCharId });
          });
        }
        if (Array.isArray(bundle.skills)) {
          bundle.skills.forEach((sk: any) => {
            const newSkId = grimoireSkills.length > 0 ? Math.max(...grimoireSkills.map((s: any) => s.id)) + 1 : 1;
            grimoireSkills.push({ ...sk, id: newSkId, characterId: newCharId });
          });
        }
      });

      localStorage.setItem("aetherborne_characters", JSON.stringify(grimoireChars));
      localStorage.setItem("aetherborne_equipment", JSON.stringify(grimoireEquip));
      localStorage.setItem("aetherborne_currencies", JSON.stringify(grimoireCurr));
      localStorage.setItem("aetherborne_inventory", JSON.stringify(grimoireInv));
      localStorage.setItem("aetherborne_essences", JSON.stringify(grimoireEss));
      localStorage.setItem("aetherborne_abilities", JSON.stringify(grimoireAbils));
      localStorage.setItem("aetherborne_skills", JSON.stringify(grimoireSkills));

      queryClient.invalidateQueries();
      toast.success(`Successfully imported ${selectedChronicleChars.length} characters into the Grimoire roster!`);
      setIsChronicleImportOpen(false);
      setSelectedChronicleChars([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to import selected characters.");
    }
  };

  const handleToggleSelectChronicleChar = (id: number) => {
    setSelectedChronicleChars(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = () => {
    try {
      exportGrimoireBackup();
      toast.success("Grimoire character sheets exported successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to export Grimoire data.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const res = importGrimoireBackup(text);
        queryClient.invalidateQueries();
        toast.success(`Successfully restored Grimoire roster! Loaded ${res.count} characters.`);
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse file. Make sure it is a valid backup (.grimoire or .json).");
      }
    };
    reader.readAsText(file);
  };

  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [rank, setRank] = useState("Iron");
  const [race, setRace] = useState("Human");
  const [speed, setSpeed] = useState(30);
  const [resistances, setResistances] = useState("");
  const [immunities, setImmunities] = useState("");
  
  // Base Stats (Default: 10)
  const [power, setPower] = useState(10);
  const [vitality, setVitality] = useState(10);
  const [spirit, setSpirit] = useState(10);
  const [agility, setAgility] = useState(10);
  const [endurance, setEndurance] = useState(10);
  const [precision, setPrecision] = useState(10);
  const [willpower, setWillpower] = useState(10);
  const [charisma, setCharisma] = useState(10);

  const [background, setBackground] = useState("");
  const [backstory, setBackstory] = useState("");

  // Session Recaps Form State
  const [recapTitle, setRecapTitle] = useState("");
  const [recapContent, setRecapContent] = useState("");
  const [isAddingRecap, setIsAddingRecap] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createCharacter.mutate(
      {
        name,
        rank,
        race,
        level: 1, // All characters start at level 1
        speed,
        power,
        vitality,
        spirit,
        agility,
        endurance,
        precision,
        willpower,
        charisma,
        maxHp: vitality * 10 + endurance * 5,
        currentHp: vitality * 10 + endurance * 5,
        currentMana: spirit * 10 + willpower * 5,
        currentDt: endurance * 2,
        dtBonus: 0,
        resistances,
        immunities,
        background: background || null,
        backstory: backstory || null,
        hpFormula: "Vitality * 10 + Endurance * 5",
        manaFormula: "Spirit * 10 + Willpower * 5",
        dtFormula: "Endurance * 2 + dtBonus",
        powerTraining: 0,
        vitalityTraining: 0,
        spiritTraining: 0,
        agilityTraining: 0,
        enduranceTraining: 0,
        precisionTraining: 0,
        willpowerTraining: 0,
        charismaTraining: 0,
        familiars: [],
      },
      {
        onSuccess: (char) => {
          setIsOpen(false);
          // Reset form fields
          setName("");
          setRank("Iron");
          setRace("Human");
          setSpeed(30);
          setResistances("");
          setImmunities("");
          setPower(10);
          setVitality(10);
          setSpirit(10);
          setAgility(10);
          setEndurance(10);
          setPrecision(10);
          setWillpower(10);
          setCharisma(10);
          setBackground("");
          setBackstory("");
          // Navigate to character sheet
          setLocation(`/characters/${char.id}`);
        },
      }
    );
  };

  const handleAddRecapSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recapTitle.trim() || !recapContent.trim()) return;
    createRecap.mutate(
      { title: recapTitle, content: recapContent },
      {
        onSuccess: () => {
          setRecapTitle("");
          setRecapContent("");
          setIsAddingRecap(false);
        },
      }
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <style>{`
        @keyframes ethereal-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
            transform: scale(1);
          }
          50% {
            transform: scale(1.015);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
            transform: scale(1);
          }
        }
        .animate-ethereal-pulse {
          animation: ethereal-pulse 2.2s infinite ease-in-out;
        }
      `}</style>

      {/* Main Header Area */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/20 pb-6 mt-2">
        <div className="flex items-center gap-5 flex-wrap sm:flex-nowrap">
          <img 
            src={`${import.meta.env.BASE_URL}logo.jpg`} 
            alt="The Grimoire Logo" 
            className="w-16 h-16 rounded-lg object-cover border border-primary/30 shadow-[0_0_15px_rgba(59,130,246,0.12)] flex-shrink-0"
          />
          <div className="space-y-1">
            <h1 className="text-4xl sm:text-5xl font-serif font-black tracking-[0.25em] uppercase bg-gradient-to-r from-primary via-foreground to-primary bg-clip-text text-transparent">
              The Grimoire
            </h1>
            <p className="text-sm text-muted-foreground/80 font-serif italic tracking-wide">
              Forge your heroes and manage your campaigns.
            </p>
          </div>
        </div>
      </header>

      {/* Utility Control Panel Bar */}
      <div className="bg-card/45 backdrop-blur-md border border-border/40 p-4 flex flex-wrap items-center justify-between gap-4 rounded-lg shadow-sm">
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
          <div className="h-4 w-px bg-border/30 hidden sm:block" />
          <RollGuideDialog />
          <div className="h-4 w-px bg-border/30 hidden md:block" />

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".grimoire,.json"
            className="hidden"
          />

          <Button 
            variant="outline" 
            onClick={handleImportClick}
            className="h-9 text-xs font-serif border border-border/50 hover:bg-accent/40 hover:text-foreground rounded-md cursor-pointer flex items-center gap-1.5 px-3.5 font-bold text-muted-foreground transition-all"
            title="Import grimoire roster (.grimoire, .json)"
          >
            <Upload className="w-3.5 h-3.5 text-primary" /> Import Data
          </Button>

          <Button 
            variant="outline" 
            onClick={handleExportBackup}
            className="h-9 text-xs font-serif border border-border/50 hover:bg-accent/40 hover:text-foreground rounded-md cursor-pointer flex items-center gap-1.5 px-3.5 font-bold text-muted-foreground transition-all"
            title="Export grimoire roster sheets (.grimoire)"
          >
            <Download className="w-3.5 h-3.5 text-primary" /> Export Backup
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-serif font-bold tracking-wider px-5 py-4 h-9 rounded-md border border-primary/50 shadow-md transition-transform hover:scale-[1.02] cursor-pointer flex items-center gap-1">
              <Plus className="w-4 h-4 mr-1" /> Forge Hero <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border border-border shadow-lg rounded-md min-w-[160px] p-1">
            <DropdownMenuItem onClick={() => setIsOpen(true)} className="cursor-pointer font-serif font-bold text-xs flex items-center gap-2 px-3 py-2 text-foreground hover:bg-accent/40 focus:bg-accent/40">
              <Plus className="w-3.5 h-3.5 text-primary" /> Forge New Hero
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleImportClick} className="cursor-pointer font-serif font-bold text-xs flex items-center gap-2 px-3 py-2 text-foreground hover:bg-accent/40 focus:bg-accent/40">
              <Upload className="w-3.5 h-3.5 text-primary" /> Import Character
            </DropdownMenuItem>
            {isChronicleUnlocked && (
              <DropdownMenuItem onClick={() => setIsChronicleImportOpen(true)} className="cursor-pointer font-serif font-bold text-xs flex items-center gap-2 px-3 py-2 text-foreground hover:bg-accent/40 focus:bg-accent/40 border-t border-border/25">
                <BookOpen className="w-3.5 h-3.5 text-primary" /> Import from Chronicle
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isChronicleImportOpen} onOpenChange={setIsChronicleImportOpen}>
          <DialogContent className="sm:max-w-[480px] max-h-[80vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md p-6">
            <div className="absolute inset-1 border border-border/10 pointer-events-none" />
            <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

            <DialogHeader>
              <DialogTitle className="font-serif text-2xl text-primary font-bold border-b border-border/30 pb-2 flex items-center gap-2 z-10 relative">
                <BookOpen className="w-5 h-5" /> Import from Chronicle
              </DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-4 font-serif z-10 relative text-xs">
              <p className="text-muted-foreground font-sans leading-relaxed">
                Select one or more heroes currently stored in the Chronicle of the Creator database to clone them into the active Grimoire roster.
              </p>

              {chronicleChars.length === 0 ? (
                <div className="text-center py-8 text-stone-500 italic border border-dashed border-border/20 bg-background/20 rounded-md">
                  No characters found in the Chronicle roster.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {chronicleChars.map((item: any) => {
                    const char = item.character;
                    const isChecked = selectedChronicleChars.includes(char.id);
                    return (
                      <div
                        key={char.id}
                        onClick={() => handleToggleSelectChronicleChar(char.id)}
                        className={`flex items-center gap-3 p-3 border transition-all cursor-pointer rounded-md ${
                          isChecked 
                            ? "border-primary bg-primary/10" 
                            : "border-border/50 bg-background/30 hover:bg-accent/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
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
              <Button variant="ghost" size="sm" onClick={() => setIsChronicleImportOpen(false)} className="rounded-md font-bold text-xs">
                Cancel
              </Button>
              <Button 
                onClick={handleImportFromChronicle} 
                disabled={selectedChronicleChars.length === 0} 
                className="bg-primary text-primary-foreground font-bold text-xs rounded-md shadow px-4"
              >
                Import Selected ({selectedChronicleChars.length})
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-md">
            <DialogHeader>
              <DialogTitle className="font-serif text-3xl text-primary font-bold tracking-wide border-b border-border/30 pb-2">
                Forge a Hero
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreate} className="space-y-6 mt-4 font-sans text-sm">
              
              {/* Profile Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Name</label>
                  <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Garrick the Bold" 
                    required 
                    className="bg-background border-border/60 rounded-md h-9 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Rank</label>
                  <select 
                    value={rank} 
                    onChange={e => setRank(e.target.value)} 
                    className="w-full h-9 rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Iron">Iron</option>
                    <option value="Bronze">Bronze</option>
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Diamond">Diamond</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Race</label>
                  <select 
                    value={race} 
                    onChange={e => setRace(e.target.value)} 
                    className="w-full h-9 rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="Human">Human</option>
                    <option value="Elf">Elf</option>
                    <option value="Dwarf">Dwarf</option>
                    <option value="Halfling">Halfling</option>
                    <option value="Dragonborn">Dragonborn</option>
                    <option value="Orc">Orc</option>
                  </select>
                </div>
              </div>

              {/* Speed & Resistances */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/20 pt-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Speed (Feet)</label>
                  <Input 
                    type="number" 
                    min={5} 
                    step={5} 
                    value={speed} 
                    onChange={e => setSpeed(Number(e.target.value))} 
                    required 
                    className="bg-background border-border/60 rounded-md font-mono h-9 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Resistances</label>
                  <Input 
                    value={resistances} 
                    onChange={e => setResistances(e.target.value)} 
                    placeholder="e.g. Fire, Slash" 
                    className="bg-background border-border/60 rounded-md h-9 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Immunities</label>
                  <Input 
                    value={immunities} 
                    onChange={e => setImmunities(e.target.value)} 
                    placeholder="e.g. Poison, Fear" 
                    className="bg-background border-border/60 rounded-md h-9 text-sm" 
                  />
                </div>
              </div>

              {/* Attributes Grid */}
              <div className="border-t border-border/20 pt-4">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Attributes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Power (POW)", val: power, set: setPower },
                    { label: "Vitality (VIT)", val: vitality, set: setVitality },
                    { label: "Spirit (SPI)", val: spirit, set: setSpirit },
                    { label: "Agility (AGI)", val: agility, set: setAgility },
                    { label: "Endurance (END)", val: endurance, set: setEndurance },
                    { label: "Precision (PRE)", val: precision, set: setPrecision },
                    { label: "Willpower (WIL)", val: willpower, set: setWillpower },
                    { label: "Charisma (CHA)", val: charisma, set: setCharisma },
                  ].map(stat => (
                    <div key={stat.label} className="bg-background/40 p-2.5 rounded-md border border-border/40 text-center">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1.5">{stat.label}</label>
                      <Input 
                        type="number" 
                        min={0} 
                        max={30}
                        value={stat.val} 
                        onChange={e => stat.set(Math.min(30, Math.max(0, Number(e.target.value))))} 
                        className="text-center font-mono h-8 bg-background rounded-md text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Background and Lore */}
              <div className="border-t border-border/20 pt-4 space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Character Background / Title</label>
                  <Input 
                    value={background} 
                    onChange={e => setBackground(e.target.value)} 
                    placeholder="e.g. Captain of the Guard" 
                    className="bg-background border-border/60 rounded-md h-9 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Hero Backstory</label>
                  <Textarea 
                    value={backstory} 
                    onChange={e => setBackstory(e.target.value)} 
                    placeholder="Describe their origin, motives, and path..." 
                    className="bg-background border-border/60 rounded-md min-h-[80px] text-sm" 
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 border-t border-border/20 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-md font-serif text-sm">Cancel</Button>
                <Button type="submit" className="bg-primary text-primary-foreground font-serif text-sm rounded-md">Forge Hero</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Two Column Layout: Roster (Left) & Recent Fate (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        
        {/* Roster column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-border/20 pb-2">
            <h2 className="text-2xl font-serif font-bold text-foreground">Active Roster</h2>
          </div>
          
          {loadingChars ? (
            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : characters && characters.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {characters.map(char => (
                <button 
                  key={char.id} 
                  onClick={() => setLocation(`/characters/${char.id}`)}
                  className="w-full text-left rounded-lg border border-border/40 bg-card/45 backdrop-blur-md hover:border-primary/40 hover:shadow-[0_0_15px_rgba(var(--primary),0.05)] hover:scale-[1.01] transition-all duration-300 cursor-pointer group relative overflow-hidden"
                >
                  {/* Subtle top border glow on hover */}
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary/50 transition-all duration-300" />
                  
                  <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Character Avatar Portrait with Rank Gradient fallback */}
                      <div className={`w-12 h-12 rounded-full overflow-hidden border border-border/60 bg-background/40 flex-shrink-0 flex items-center justify-center relative shadow-inner ${
                        !char.avatar ? (
                          char.rank === "Iron" ? "bg-slate-700/20 border-slate-500/20"
                          : char.rank === "Bronze" ? "bg-amber-700/20 border-amber-600/35"
                          : char.rank === "Silver" ? "bg-zinc-500/20 border-zinc-400/30"
                          : "bg-yellow-600/20 border-yellow-500/40"
                        ) : ""
                      }`}>
                        {char.avatar ? (
                          <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className={`text-xs font-bold uppercase tracking-wider ${
                            char.rank === "Gold" ? "text-yellow-400 font-serif" : "text-muted-foreground font-mono"
                          }`}>{char.name.substring(0, 2)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="font-serif text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {char.name}
                        </h3>
                        <p className="text-[10px] text-muted-foreground/80 uppercase tracking-widest font-semibold font-mono truncate">
                          {char.race} · {char.rank}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:text-right min-w-[120px]">
                      <div className="flex justify-between sm:justify-end items-baseline gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sm:hidden">Health</span>
                        <span className="text-xl font-bold font-mono text-foreground leading-none">
                          {char.currentHp}<span className="text-xs text-muted-foreground font-normal">/{char.maxHp}</span>
                        </span>
                      </div>
                      {/* Roster Card HP Progress Bar */}
                      <div className="w-full bg-background/50 h-1.5 rounded-full overflow-hidden border border-border/20">
                        <div 
                          className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(0, Math.min(100, (char.currentHp / char.maxHp) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <Card className="bg-card/30 border-dashed border-border/50 rounded-md">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground/60 mb-3" />
                <p className="text-muted-foreground font-serif italic mb-4">No heroes have joined the party yet.</p>
                <Button 
                  variant="outline" 
                  className="border-primary/50 text-primary rounded-md font-serif text-sm"
                  onClick={() => setIsOpen(true)}
                >
                  Forge a Hero
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Session Recaps Column (1/3 width) - Labeled "Recent Fate" */}
        <div className="space-y-6">
          <h2 className="text-2xl font-serif font-bold text-foreground border-b border-border/20 pb-2">Recent Fate</h2>
          
          <Card className="bg-card/60 backdrop-blur border border-border/50 rounded-md">
            <CardHeader className="pb-3 border-b border-border/30 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-muted-foreground flex items-center uppercase tracking-widest">
                <BookOpen className="w-4 h-4 mr-2 text-primary" /> 
                Session Recaps
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary px-2"
                onClick={() => setIsAddingRecap(!isAddingRecap)}
              >
                {isAddingRecap ? "Cancel" : "Add Recap"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {/* Add recap form inline */}
              {isAddingRecap && (
                <form onSubmit={handleAddRecapSubmit} className="p-4 border-b border-border/30 bg-background/50 space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Recap Title</label>
                    <Input
                      value={recapTitle}
                      onChange={e => setRecapTitle(e.target.value)}
                      placeholder="e.g. Session 14: The Forest Camp"
                      required
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Recap Content</label>
                    <Textarea
                      value={recapContent}
                      onChange={e => setRecapContent(e.target.value)}
                      placeholder="Briefly state what occurred during the session..."
                      required
                      className="min-h-[80px] text-xs bg-background"
                    />
                  </div>
                  <Button type="submit" size="sm" className="w-full text-xs h-8">Save Recap</Button>
                </form>
              )}

              {loadingRecaps ? (
                <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : recaps && recaps.length > 0 ? (
                <div className="divide-y divide-border/20 max-h-[500px] overflow-y-auto pr-1">
                  {recaps.map(recap => (
                    <div key={recap.id} className="p-4 hover:bg-primary/[0.02] border-l-2 border-transparent hover:border-primary/50 transition-all duration-200 group relative">
                      <div className="flex justify-between items-start mb-1.5 pr-6">
                        <span className="font-serif font-bold text-sm text-foreground leading-tight tracking-wide group-hover:text-primary transition-colors">{recap.title}</span>
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap ml-2">
                          {format(new Date(recap.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed font-sans whitespace-pre-wrap">
                        {recap.content}
                      </p>
                      {/* Delete button */}
                      <button
                        onClick={() => {
                          if (confirm("Delete this session recap permanently?")) {
                            deleteRecap.mutate({ id: recap.id });
                          }
                        }}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground font-serif italic">
                  No session recaps have been logged yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>


    </div>
  );
}