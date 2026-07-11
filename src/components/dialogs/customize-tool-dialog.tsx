import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";
import { useLocation } from "wouter";

const THEMES = [
  { id: "theme-grimoire", name: "The Archive", bg: "bg-[#0c0806]", primary: "bg-[#d4af37]", label: "Book Texture & Gold Outline" },
  { id: "theme-obsidian", name: "Obsidian", bg: "bg-[#0c0f12]", primary: "bg-[#10b981]", label: "Default Dark & Green" },
  { id: "theme-sea", name: "Deep Sea", bg: "bg-[#070b13]", primary: "bg-[#00b0ff]", label: "Midnight Blue & Cyan" },
  { id: "theme-emerald", name: "Emerald Vault", bg: "bg-[#05110d]", primary: "bg-[#10b981]", label: "Deep Forest & Mint" },
  { id: "theme-alchemist", name: "Alchemist", bg: "bg-[#0e0714]", primary: "bg-[#ab47bc]", label: "Royal Violet & Amethyst" },
  { id: "theme-bloodstone", name: "Bloodstone", bg: "bg-[#12070c]", primary: "bg-[#e53935]", label: "Dark Crimson & Coral" },
  { id: "theme-abyss", name: "Abyss", bg: "bg-[#050607]", primary: "bg-[#d4af37]", label: "Charcoal Black & Gold" },
  { id: "theme-chaos", name: "Chaos", bg: "bg-[#0a0512]", primary: "bg-[#ffd700]", label: "Golds & Purples in Unison" },
  { id: "theme-rot", name: "Rot & Decay", bg: "bg-[#080906]", primary: "bg-[#8ebd43]", label: "Putrid Green & Moss" },
  { id: "theme-structure", name: "Structure", bg: "bg-[#05080c]", primary: "bg-[#00e5ff]", label: "Cyber Teals & Purples" },
  { id: "theme-emberborn", name: "Emberborn", bg: "bg-[#0a0605]", primary: "bg-[#ff6d00]", label: "ITS ON FIRE" },
];

export function CustomizeToolDialog() {
  const [location] = useLocation();
  const [activeTheme, setActiveTheme] = useState("theme-grimoire");
  const [activeRadius, setActiveRadius] = useState("0px");
  const [isOpen, setIsOpen] = useState(false);

  // Determine current scope based on url path
  let scope = "bookshelf";
  if (location.startsWith("/grimoire") || location.match(/^\/characters\/\d+/)) {
    scope = "grimoire";
  } else if (location.startsWith("/codex")) {
    scope = "codex";
  } else if (location.startsWith("/chronicle")) {
    scope = "chronicle";
  }

  useEffect(() => {
    if (isOpen) {
      const savedTheme = localStorage.getItem(`aetherborne_theme_${scope}`) || "theme-grimoire";
      const savedRadius = localStorage.getItem(`aetherborne_radius_${scope}`) || "0px";
      setActiveTheme(savedTheme);
      setActiveRadius(savedRadius);
    }
  }, [isOpen, scope]);

  const handleSelectTheme = (themeId: string) => {
    setActiveTheme(themeId);
    localStorage.setItem(`aetherborne_theme_${scope}`, themeId);
    document.documentElement.className = themeId;
  };

  const handleSelectRadius = (radiusVal: string) => {
    setActiveRadius(radiusVal);
    localStorage.setItem(`aetherborne_radius_${scope}`, radiusVal);
    document.documentElement.style.setProperty("--radius", radiusVal);
  };

  const sanitize = (str: string) => 
    (str || "")
      .trim()
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“]/g, "")
      .replace(/\s+/g, " ");

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer font-bold font-serif">
          <Palette className="w-3.5 h-3.5 mr-1.5" /> Customize Tool
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] bg-card border border-border shadow-2xl rounded-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="absolute inset-1 border border-border/10 pointer-events-none" />
        <div className="absolute top-2 left-2 right-2 bottom-2 border border-dashed border-border/5 pointer-events-none" />

        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-primary font-bold flex items-center gap-2 border-b border-border/30 pb-2 z-10 relative">
            <Palette className="w-5 h-5" /> Customize Book Theme
          </DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-5 font-serif z-10 relative">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Active Book Profile</span>
            <span className="block text-xs font-mono font-bold text-primary uppercase bg-primary/5 border border-primary/10 px-2 py-1">
              {scope === "bookshelf" ? "Bookshelf Landing" : scope === "grimoire" ? "The Grimoire" : scope === "codex" ? "Veridia Codex" : "Chronicle of the Creator"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed font-sans">
            Customize the colors and card corners for this book specifically. Other books will retain their own unique styles.
          </p>

          <div className="space-y-2">
            <span className="text-xs font-bold text-foreground">Color Presets</span>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  className={`w-full flex items-center justify-between p-2 border transition-all cursor-pointer rounded-md ${
                    activeTheme === t.id 
                      ? "border-primary bg-primary/10" 
                      : "border-border/50 bg-background/30 hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded border border-border/50 flex items-center justify-center ${t.bg}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${t.primary}`} />
                    </div>
                    <div className="text-left font-sans">
                      <div className="text-xs font-bold text-foreground">{t.name}</div>
                      <div className="text-[9px] text-muted-foreground">{t.label}</div>
                    </div>
                  </div>
                  {activeTheme === t.id && (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Corner Style Section */}
          <div className="pt-3 space-y-2 border-t border-border/30">
            <span className="text-xs font-bold text-foreground">Corner Style</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "0px", label: "Square" },
                { value: "12px", label: "Curved" },
                { value: "32px", label: "Oval" }
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => handleSelectRadius(r.value)}
                  className={`p-2 border text-center text-xs font-sans rounded transition-all cursor-pointer ${
                    activeRadius === r.value
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border/50 bg-background/30 hover:bg-accent/40 text-stone-400"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-3 border-t border-border/30 z-10 relative">
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="rounded-md font-bold text-xs">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
