import React, { useState } from "react";
import { useLocation } from "wouter";
import { Book, Compass, Lock, KeyRound, Sparkles } from "lucide-react";
import { useListCodexNotes, useUnlockPassword, useListUnlockedPasswords } from "@/hooks/useStorage";
import { toast } from "sonner";

export default function Bookshelf() {
  const [, setLocation] = useLocation();
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);

  // Storage hooks for decryption
  const { data: codexNotes = [] } = useListCodexNotes();
  const { data: unlockedPasswords = [] } = useListUnlockedPasswords();
  const unlockPassword = useUnlockPassword();

  // Decryption input states
  const [passphrase, setPassphrase] = useState("");
  const [isShaking, setIsShaking] = useState(false);
  const [unlockedBook, setUnlockedBook] = useState<string | null>(null);

  const books = [
    {
      id: "grimoire",
      title: "The Grimoire",
      subtitle: "Character Sheet & Spellbook Manager",
      description: "Step into your sanctum to forge heroes, manage character sheets, attune essences, cast spells, and track your active campaign stats.",
      coverImage: `${import.meta.env.BASE_URL}the_grimoire_spine.png`,
      path: "/grimoire",
      style: "from-purple-950 via-indigo-950 to-violet-950 border-purple-500/35",
      accent: "text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
    },
    {
      id: "codex",
      title: "Veridia Codex",
      subtitle: "Campaign World Compendium",
      description: "Consult the global registry of legends, locations, bestiary entries, and campaign facts. Push lore directly to your active heroes.",
      coverImage: `${import.meta.env.BASE_URL}veridia_codex_spine.png`,
      path: "/codex",
      style: "from-amber-950 via-yellow-950 to-orange-950 border-amber-600/35",
      accent: "text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]"
    }
  ];

  // Passphrase Submission Validation
  const handlePassphraseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPw = passphrase.trim().toLowerCase();
    if (!cleanPw) return;

    // Check if passphrase is already unlocked
    if (unlockedPasswords.includes(cleanPw)) {
      toast.info("This secret has already been decrypted.");
      setPassphrase("");
      return;
    }

    // 1. Scan Codex entries for matching locks
    const matchingNotes = codexNotes.filter(n => n.secretPassword && n.secretPassword.trim().toLowerCase() === cleanPw);

    // (In the future, we can add locks on characters or campaigns here)

    if (matchingNotes.length > 0) {
      unlockPassword.mutate(cleanPw, {
        onSuccess: () => {
          setPassphrase("");
          toast.success(`A seal breaks! Decrypted ${matchingNotes.length} secret chronicles.`);
          
          // Trigger magical book spine glow animation for 5 seconds
          setUnlockedBook("codex");
          setTimeout(() => {
            setUnlockedBook(null);
          }, 5000);
        }
      });
    } else {
      // Play shaking feedback on incorrect input
      setIsShaking(true);
      toast.error("The words echo in silence...");
      setTimeout(() => {
        setIsShaking(false);
      }, 700);
    }
  };

  const isCodexGlowing = unlockedBook === "codex";
  const isGrimoireGlowing = unlockedBook === "grimoire";

  return (
    <div className="relative min-h-[92vh] flex flex-col justify-between overflow-hidden bg-[#0a0705] py-12 px-4 select-none">
      
      {/* ── Custom Ethereal Styling ── */}
      <style>{`
        .spotlight {
          background: radial-gradient(circle 500px at 50% 30%, rgba(217, 119, 6, 0.08), transparent 70%);
        }
        .wood-grain {
          background-color: #1c130d;
          background-image: repeating-linear-gradient(90deg, rgba(255,255,255,.01) 0px, rgba(255,255,255,.01) 4px, transparent 4px, transparent 12px),
                            linear-gradient(to bottom, #251a12 0%, #150f0b 100%);
        }
        .book-container {
          perspective: 1200px;
        }
        .book-3d {
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.6s ease;
        }
        .book-3d:hover {
          transform: rotateY(-22deg) translateZ(35px) translateY(-15px);
        }
        .book-spine {
          transform: rotateY(-90deg) translateZ(10px);
          transform-origin: left;
        }
        .book-page-edges {
          transform: rotateY(90deg) translateZ(110px);
          transform-origin: right;
          background: linear-gradient(to right, #fcf8f2 0%, #e0d5c3 100%);
        }
        .parchment-glow {
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.8),
                      0 0 40px 5px rgba(217, 119, 6, 0.15);
        }

        /* ── Magical Glow Pulse Animations ── */
        @keyframes codex-magical-glow {
          0%, 100% { 
            box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.75), 0 0 12px 1px rgba(245, 158, 11, 0.2); 
          }
          50% { 
            box-shadow: 0 0 45px 12px rgba(245, 158, 11, 0.85); 
            transform: translateY(-15px) rotateY(-22deg) scale(1.05);
          }
        }
        .animate-codex-magical-glow {
          animation: codex-magical-glow 1.5s infinite ease-in-out;
        }

        @keyframes grimoire-magical-glow {
          0%, 100% { 
            box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.75), 0 0 12px 1px rgba(168, 85, 247, 0.2); 
          }
          50% { 
            box-shadow: 0 0 45px 12px rgba(168, 85, 247, 0.85); 
            transform: translateY(-15px) rotateY(-22deg) scale(1.05);
          }
        }
        .animate-grimoire-magical-glow {
          animation: grimoire-magical-glow 1.5s infinite ease-in-out;
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

      {/* Passphrase Input Bar centered right above the ledge */}
      <form 
        onSubmit={handlePassphraseSubmit}
        className="max-w-xs mx-auto w-full text-center space-y-2 mt-6 z-10"
      >
        <label className="text-[10px] font-mono tracking-[0.35em] text-stone-500 uppercase font-bold block">
          Speak your mind
        </label>
        <div className="relative">
          <input
            type="text"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Speak the hidden words..."
            className={`w-full bg-[#120e0a]/90 border border-amber-900/30 rounded-none h-8 text-center text-xs font-serif text-amber-200 placeholder:text-stone-700 focus:outline-none focus:border-amber-600/60 focus:ring-1 focus:ring-amber-600/20 transition-all ${
              isShaking ? "animate-shake border-red-900" : ""
            }`}
          />
          <KeyRound className="w-3.5 h-3.5 text-amber-900/40 absolute right-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </form>

      {/* Main Bookshelf Area */}
      <div className="w-full max-w-4xl mx-auto z-10 my-4 space-y-1">
        
        {/* Books Stand Area */}
        <div className="grid grid-cols-6 gap-3 sm:gap-6 px-4 items-end justify-center min-h-[320px] pb-1">
          {books.map((book) => {
            const isGlow = book.id === "codex" ? isCodexGlowing : isGrimoireGlowing;
            return (
              <div 
                key={book.id}
                className="col-span-3 sm:col-span-1 flex flex-col items-center gap-2 cursor-pointer group h-[300px] justify-end"
                onMouseEnter={() => setHoveredBook(book.id)}
                onMouseLeave={() => setHoveredBook(null)}
                onClick={() => setLocation(book.path)}
              >
                {/* 3D Book Container */}
                <div className="book-container h-[260px] flex items-end">
                  <div 
                    className={`book-3d w-[96px] sm:w-[86px] h-[260px] rounded-r-md relative border border-t-2 border-b-2 shadow-[5px_25px_35px_rgba(0,0,0,0.7)] ${book.style} overflow-hidden ${
                      isGlow ? (book.id === "codex" ? "animate-codex-magical-glow" : "animate-grimoire-magical-glow") : ""
                    }`}
                    style={{
                      backgroundImage: `linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.25)), url(${book.coverImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  >
                    {/* 3D Gold Leaf Foil Overlay border */}
                    <div className="absolute inset-1.5 border border-amber-500/10 pointer-events-none group-hover:border-amber-500/35 transition-colors duration-500" />
                    
                    {/* Glowing Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Subtle Book Spine shadow overlay */}
                    <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/60 via-black/10 to-transparent" />
                  </div>
                </div>

                {/* Spine Text Label BELOW the book (resting just above the shelf) */}
                <div className="text-center pb-1">
                  <span className="font-serif text-xs font-bold uppercase tracking-[0.25em] text-stone-400 group-hover:text-amber-400 transition-colors duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
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
          {/* Ledge front face */}
          <div className="wood-grain w-full h-7 border-t border-amber-700/30 rounded-t-sm shadow-[0_15px_30px_rgba(0,0,0,0.85)] relative">
            {/* Specular highlighting line on shelf edge */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-600/45 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black/60" />
          </div>
          {/* Ledge depth shadow underneath */}
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
              <div className="w-full bg-[#18130f] border border-amber-900/45 p-6 rounded-none relative text-center shadow-2xl parchment-glow animate-in fade-in zoom-in-95 duration-300">
                {/* Decorative border overlays */}
                <div className="absolute inset-1 border border-amber-950/20" />
                <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-amber-900/20" />
                
                <h3 className="font-serif text-xl font-bold text-amber-500 tracking-wider">
                  {currentBook.title}
                </h3>
                <h4 className="text-[10px] font-mono tracking-widest text-stone-400 uppercase mt-0.5 mb-3">
                  {currentBook.subtitle}
                </h4>
                <p className="text-stone-300 font-serif text-sm leading-relaxed max-w-md mx-auto">
                  {currentBook.description}
                </p>
              </div>
            );
          })()
        ) : (
          <div className="text-center font-serif text-stone-500/70 text-xs italic tracking-wider py-8">
            Hover over a chronicle on the ledge to inspect its contents...
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="text-center z-10 text-[9px] font-mono tracking-[0.25em] text-stone-600 uppercase pt-6">
        AEtherborne &copy; {new Date().getFullYear()} · Core Campaign System
      </div>
    </div>
  );
}
