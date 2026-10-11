export const FONT_CHOICES = [
  { name: "Classic", font: "Cinzel", description: "Original Grimoire lettering · Cinzel with Spectral fallback" },
  { name: "Fancy", font: "Cormorant Garamond", description: "Elegant, literary headings" },
  { name: "Runic", font: "Uncial Antiqua", description: "Celtic-inspired lettering · familiar alphabet, not rune symbols" },
  { name: "Modern", font: "Inter", description: "Clean, compact, and straightforward" },
  { name: "Scribe", font: "Alegreya", description: "Warm manuscript-inspired serif" },
] as const;
export function applyFontAppearance(scope: string) {
  const selected = localStorage.getItem(`aetherborne_font_${scope}`) ?? "Classic";
  const choice = FONT_CHOICES.find(option => option.name === selected) ?? FONT_CHOICES[0];
  document.documentElement.style.setProperty("--app-font-serif", choice.name === "Classic" ? "'Cinzel', 'Spectral', Georgia, serif" : `'${choice.font}', Georgia, serif`);
  // Decorative selections affect headings/labels, never numerical readouts or input text.
  document.documentElement.style.setProperty("--app-font-sans", "'Inter', sans-serif");
  document.documentElement.style.setProperty("--app-font-mono", "'Space Mono', monospace");
}
