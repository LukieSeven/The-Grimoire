import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  const leftRunes = ["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ", "ᛁ"];
  const rightRunes = ["ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛊ", "ᛏ", "ᛒ", "ᛖ", "ᛗ", "ᛚ", "ᛜ"];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30 relative">
      
      {/* Mystical Runic Margins (Elder Futhark guides - hidden on mobile/split screens to avoid overlap) */}
      <div className="hidden xl:flex flex-col gap-5 absolute left-6 top-1/2 -translate-y-1/2 text-stone-500/25 select-none pointer-events-none animate-pulse duration-[3000ms] text-xs font-mono tracking-widest text-center">
        {leftRunes.map((rune, idx) => (
          <span key={idx} className="hover:text-primary/45 transition-colors duration-500">{rune}</span>
        ))}
      </div>

      <div className="hidden xl:flex flex-col gap-5 absolute right-6 top-1/2 -translate-y-1/2 text-stone-500/25 select-none pointer-events-none animate-pulse duration-[3500ms] text-xs font-mono tracking-widest text-center">
        {rightRunes.map((rune, idx) => (
          <span key={idx} className="hover:text-primary/45 transition-colors duration-500">{rune}</span>
        ))}
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Subtle noise grain filter */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay" 
             style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}>
        </div>
        
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}