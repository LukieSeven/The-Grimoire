import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Book, Compass, Lock, MessageSquare, Sparkles, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListCodexNotes, useUnlockPassword, useListUnlockedPasswords } from "@/hooks/useStorage";
import { CustomizeToolDialog } from "@/components/dialogs/customize-tool-dialog";
import { exportFullBackup, importFullBackup } from "@/lib/storage";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Bookshelf() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);

  // Storage hooks for decryption
  const { data: codexNotes = [] } = useListCodexNotes();
  const { data: unlockedPasswords = [] } = useListUnlockedPasswords();
  const unlockPassword = useUnlockPassword();

  // Decryption input states
  const [passphrase, setPassphrase] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [unlockedBook, setUnlockedBook] = useState<string | null>(null);

  // Smoldering Rune target state
  const [smolderTarget, setSmolderTarget] = useState<"grimoire" | "codex" | "all" | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bookshelf definitions
  const books = [
    {
      id: "grimoire",
      title: "The Grimoire",
      subtitle: "Character & campaign manager",
      coverImage: "the_grimoire_spine.png",
      path: "/grimoire",
      style: "bg-[#18110a] border-amber-900/35"
    },
    {
      id: "codex",
      title: "Veridia Codex",
      subtitle: "World lore and land archives",
      coverImage: "veridia_codex_spine.png",
      path: "/codex",
      style: "bg-[#1f1610] border-amber-950/40"
    }
  ];

  // Sanitizer matches letters only, case and punctuation insensitive
  const sanitize = (str: string) => 
    (str || "")
      .trim()
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“]/g, "")
      .replace(/\s+/g, " ");

  const handlePassphraseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;

    const cleanInput = sanitize(passphrase);

    // Easter Egg test passphrase
    if (cleanInput === "i accept the form i am given") {
      setUnlockedBook("all");
      setSmolderTarget("all");
      toast.success("The form has been accepted. The Archive listens.");
      setPassphrase("");
      
      // Stop smoldering after 5 seconds
      setTimeout(() => {
        setSmolderTarget(null);
        setUnlockedBook(null);
      }, 5000);
      return;
    }

    // Try finding matching secret lock inside codexNotes
    const matchedNote = codexNotes.find(n => n.secretPassword && sanitize(n.secretPassword) === cleanInput);

    if (matchedNote) {
      // Unlock the note via React Query mutation
      const targetGroup = (matchedNote.category === "bestiary" || matchedNote.subcategory === "bestiary-monsters") 
        ? "grimoire" 
        : "codex";

      unlockPassword.mutate(matchedNote.secretPassword!, {
        onSuccess: () => {
          setUnlockedBook(targetGroup);
          setSmolderTarget(targetGroup);
          toast.success(`Seal broken! Unlocked compendium note: "${matchedNote.title}"`);
          setPassphrase("");
          
          setTimeout(() => {
            setSmolderTarget(null);
            setUnlockedBook(null);
          }, 5000);
        }
      });
    } else {
      // Trigger shake feedback on incorrect password input
      setIsShaking(true);
      toast.error("The hidden words ring hollow. The Archive remains silent.");
      setTimeout(() => setIsShaking(false), 600);
    }
  };

  const handleExportBackup = () => {
    try {
      exportFullBackup();
      toast.success("Campaign archive exported successfully!");
    } catch {
      toast.error("Failed to export archive.");
    }
  };

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
        importFullBackup(JSON.stringify(parsed));
        await queryClient.invalidateQueries();
        toast.success("Campaign archive restored successfully!");
      } catch (err) {
        toast.error("Invalid file format. Import requires a valid campaign archive.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-[92vh] bg-[#050302] text-stone-100 flex flex-col justify-between p-6 relative font-serif select-none max-w-7xl mx-auto overflow-hidden">
      
      {/* 3D, shadows, sheens, and wood smoldering animations */}
      <style>{`
        .spotlight {
          background: radial-gradient(circle at 50% 30%, rgba(217, 119, 6, 0.04) 0%, rgba(0, 0, 0, 0.85) 75%);
        }
        .book-container {
          perspective: 1000px;
        }
        .wood-grain {
          background: linear-gradient(180deg, #1c130d 0%, #100a06 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .wood-grain::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(90deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 40px, rgba(0,0,0,0.15) 45px, rgba(0,0,0,0) 50px);
          opacity: 0.4;
          pointer-events: none;
        }
        .parchment-glow {
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.8),
                      0 0 40px 5px rgba(217, 119, 6, 0.15);
        }

        /* ── Metallic Gold Foil Sheen sweep keyframe ── */
        @keyframes foil-shine {
          0% { transform: translateX(-100%) rotate(25deg); }
          100% { transform: translateX(200%) rotate(25deg); }
        }
        .foil-shine-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 215, 0, 0.12) 30%,
            rgba(255, 255, 255, 0.35) 50%,
            rgba(255, 215, 0, 0.12) 70%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: translateX(-100%) rotate(25deg);
          pointer-events: none;
          z-index: 5;
        }
        .group:hover .foil-shine-overlay {
          animation: foil-shine 1.5s cubic-bezier(0.25, 1, 0.25, 1) forwards;
        }

        /* ── Realistic 3D Depth Shadows ── */
        .book-shadow {
          box-shadow: 5px 25px 35px rgba(0,0,0,0.7);
          transition: box-shadow 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .group:hover .book-shadow {
          transform: scale(1.025);
          box-shadow: 12px 35px 50px rgba(0, 0, 0, 0.85);
        }

        /* ── Smoldering Rune Glowing Fire Keyframes ── */
        @keyframes rune-smolder {
          0%, 100% {
            text-shadow: 0 0 5px rgba(239, 68, 68, 0.35), 0 0 12px rgba(245, 158, 11, 0.2);
            color: rgba(120, 53, 4, 0.35);
          }
          50% {
            text-shadow: 0 0 10px rgba(239, 68, 68, 0.95), 0 0 25px rgba(245, 158, 11, 0.98), 0 0 35px rgba(251, 146, 60, 0.85);
            color: rgba(254, 215, 170, 0.98);
          }
        }
        .animate-rune-smolder {
          animation: rune-smolder 2.2s infinite ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.6s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>

      {/* Background Elements */}
      <div className="absolute inset-0 spotlight pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-950/5 via-[#0d0907] to-[#050302] pointer-events-none" />

      {/* Header Slot Title */}
      <div className="text-center space-y-3 z-10 max-w-2xl mx-auto mt-2">
        <h1 className="text-4xl sm:text-5xl font-serif font-extrabold tracking-[0.3em] uppercase bg-gradient-to-r from-amber-600 via-stone-200 to-amber-600 bg-clip-text text-transparent drop-shadow-md">
          The Archive
        </h1>
        <div className="h-[1px] w-48 bg-gradient-to-r from-transparent via-amber-600/50 to-transparent mx-auto" />
        <p className="text-stone-400 font-serif text-sm tracking-wider italic">
          “What is stored here is more than power. The books are listening—and they remember every word.”
        </p>
      </div>

      {/* ── Unified Base Scheme Utility Control Bar ── */}
      <div className="bg-card/45 backdrop-blur-md border border-border/40 p-3 max-w-2xl mx-auto flex items-center justify-between gap-4 rounded-lg shadow-sm mt-4 z-10 w-full">
        <div className="flex items-center gap-2.5 flex-wrap">
          <CustomizeToolDialog />
        </div>
        <div className="flex items-center gap-2.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".archive,.json"
            className="hidden"
          />
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleImportClick}
            className="h-8 text-xs font-serif border border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all"
            title="Restore campaign archive (.archive, .json)"
          >
            <Upload className="w-3.5 h-3.5" /> Import Backup
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportBackup}
            className="h-8 text-xs font-serif border border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all"
            title="Export campaign archive (.archive)"
          >
            <Download className="w-3.5 h-3.5" /> Export Backup
          </Button>
        </div>
      </div>

      {/* Passphrase Input Bar centered right above the ledge */}
      <form 
        onSubmit={handlePassphraseSubmit}
        className="max-w-xs mx-auto w-full text-center mt-6 z-10"
      >
        <div className="relative">
          <input
            type="text"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Speak your mind"
            className={`w-full bg-[#120e0a]/90 border border-amber-900/30 rounded-none h-8 text-center text-xs font-serif text-amber-200 placeholder:text-stone-700 placeholder:italic focus:outline-none focus:border-amber-600/60 focus:ring-1 focus:ring-amber-600/20 transition-all ${
              isShaking ? "animate-shake border-red-900" : ""
            }`}
          />
          <MessageSquare className="w-3.5 h-3.5 text-stone-300/80 absolute right-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </form>

      {/* Main Bookshelf Area */}
      <div className="w-full max-w-4xl mx-auto z-10 my-4 space-y-1">
        
        {/* Books Stand Area (Optimized grid for mobile and split screen) */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-6 px-4 items-end justify-center min-h-[320px] pb-1 max-w-md sm:max-w-none mx-auto">
          {books.map((book) => {
            return (
              <div 
                key={book.id}
                className="col-span-1 flex flex-col items-center gap-2 cursor-pointer group h-[300px] justify-end"
                onMouseEnter={() => setHoveredBook(book.id)}
                onMouseLeave={() => setHoveredBook(null)}
                onClick={() => setLocation(book.path)}
              >
                {/* 3D Book Container */}
                <div className="book-container h-[260px] flex items-end">
                  <div 
                    className={`book-shadow w-[96px] sm:w-[86px] h-[260px] rounded-r-md relative border border-t-2 border-b-2 ${book.style} overflow-hidden`}
                    style={{
                      backgroundImage: `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.25)), url(${book.coverImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  >
                    {/* Metallic Gold Foil Sheen Overlay */}
                    <div className="foil-shine-overlay" />

                    {/* 3D Gold Leaf Foil Overlay border */}
                    <div className="absolute inset-1.5 border border-amber-500/10 pointer-events-none group-hover:border-amber-500/25 transition-colors duration-500" />
                    
                    {/* Subtle Book Spine shadow overlay */}
                    <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/60 via-black/10 to-transparent" />
                  </div>
                </div>

                {/* Spine Text Label BELOW the book */}
                <div className="text-center pb-1">
                  <span className="font-serif text-xs font-bold uppercase tracking-[0.25em] text-stone-500 group-hover:text-amber-500 transition-colors duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                    {book.id === "grimoire" ? "Grimoire" : "Codex"}
                  </span>
                </div>
              </div>
            );
          })}

          {/* 4 Empty Outlined placeholders representing future expansions */}
          {Array(4).fill(null).map((_, idx) => (
            <div 
              key={`empty-${idx}`}
              className="col-span-1 hidden sm:flex justify-center h-[300px] items-end pb-7 pointer-events-none"
            >
              <div className="w-[110px] h-[230px] border border-dashed border-stone-800/40 rounded-sm flex flex-col items-center justify-center text-center gap-1.5 opacity-40 bg-stone-950/10">
                <Lock className="w-4.5 h-4.5 text-stone-700" />
                <span className="text-[8px] font-mono tracking-widest text-stone-700 uppercase">Locked</span>
              </div>
            </div>
          ))}
        </div>

        {/* The Wooden Shelf Ledge */}
        <div className="relative z-20">
          <div className="wood-grain w-full h-8 border-t border-amber-700/30 rounded-t-sm shadow-[0_15px_30px_rgba(0,0,0,0.85)] relative flex items-center justify-between px-4">
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-600/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black/60" />
            
            {/* Smoldering Wood-Carved Runes (Centered on the Ledge Ledge) */}
            <div className="flex-1 flex justify-center items-center gap-6 font-mono text-sm tracking-widest text-[#2c1d12] select-none pointer-events-none">
              <span className={smolderTarget === "grimoire" || smolderTarget === "all" ? "animate-rune-smolder" : ""}>᚛</span>
              <span className={smolderTarget === "grimoire" || smolderTarget === "all" ? "animate-rune-smolder" : ""}>ᚠ</span>
              <span className={smolderTarget === "grimoire" || smolderTarget === "all" ? "animate-rune-smolder" : ""}>ᚢ</span>
              <span className={smolderTarget === "all" ? "animate-rune-smolder" : ""}>ᚦ</span>
              <span className={smolderTarget === "codex" || smolderTarget === "all" ? "animate-rune-smolder" : ""}>ᚨ</span>
              <span className={smolderTarget === "codex" || smolderTarget === "all" ? "animate-rune-smolder" : ""}>ᚱ</span>
              <span className={smolderTarget === "codex" || smolderTarget === "all" ? "animate-rune-smolder" : ""}>᚜</span>
            </div>

            {/* Faint engraving watermark signature on the right of the wooden ledge */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-mono text-amber-950/30 select-none uppercase tracking-widest pointer-events-none">
              Crafted by Lukie Seven · Mark 57
            </div>
          </div>
          <div className="wood-grain w-full h-4 bg-gradient-to-b from-black/80 to-transparent" />
        </div>
      </div>

      {/* Description Panel Area (Parchment Card) */}
      <div className="w-full max-w-xl mx-auto z-10 min-h-[140px] flex items-center justify-center transition-all duration-500">
        {hoveredBook ? (
          (() => {
            const currentBook = books.find(b => b.id === hoveredBook);
            if (!currentBook) return null;
            return (
              <div className="w-full bg-[#16110c] border border-amber-900/45 p-6 shadow-2xl relative parchment-glow animate-in fade-in duration-200">
                {/* Decorative border overlays */}
                <div className="absolute inset-1 border border-amber-950/20 pointer-events-none" />
                <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-amber-900/15 pointer-events-none" />
                
                <div className="text-center space-y-2 z-10 relative">
                  <h3 className="text-amber-500 text-lg font-bold uppercase tracking-wider">{currentBook.title}</h3>
                  <span className="text-[10px] font-mono uppercase text-stone-500 tracking-widest block">{currentBook.subtitle}</span>
                  <div className="h-[1px] w-24 bg-amber-900/20 mx-auto my-2" />
                  <p className="text-stone-300 text-xs leading-relaxed max-w-sm mx-auto">
                    {currentBook.id === "grimoire" 
                      ? "Consult the codices of active heroes. Track character stats, customize attributes, manage spell inventories, calculate Crit Chains, and roll active campaign D20 checks." 
                      : "Chronicle the world map of Cormant. Filter taxonomy directories for cities, settlements, dungeons, monster bestiaries, and push lore items directly to character logs."
                    }
                  </p>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="text-center max-w-xs mx-auto py-8">
            <span className="text-stone-600 text-[10px] font-mono uppercase tracking-[0.25em] block animate-pulse">Select a chronicle from the bookcase</span>
          </div>
        )}
      </div>

      {/* Tucked away footer */}
      <footer className="mt-12 mb-4 border-t border-stone-900/45 pt-4 text-center z-10 w-full max-w-xl mx-auto">
        <p className="text-[10px] font-mono text-stone-600/35 hover:text-stone-400/80 transition-colors tracking-widest uppercase">
          Lovingly crafted by LukieSeven — Mark 57
        </p>
      </footer>
    </div>
  );
}
