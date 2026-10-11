export const CARD_FRAMES = ["OG Theme", "Iron", "Bronze", "Silver", "Gold", "Diamond"] as const;
const materials: Record<string, { edge: string; highlight: string; description: string }> = {
  Iron: { edge: "#737d88", highlight: "#b5bec8", description: "Forged steel · angular corner marks" },
  Bronze: { edge: "#a66d42", highlight: "#e0aa75", description: "Antique bronze · engraved scrollwork" },
  Silver: { edge: "#9daabb", highlight: "#e2eaf4", description: "Polished silver · delicate engraving" },
  Gold: { edge: "#b28c3e", highlight: "#f1d68b", description: "Warm gold · ornamental flourishes" },
  Diamond: { edge: "#80b7cd", highlight: "#e2fbff", description: "Crystal edges · faceted corner jewels" },
};

export function cardFrame(name: string) {
  const material = materials[name];
  if (!material) return { edge: "hsl(var(--border))", highlight: "hsl(var(--primary))", ornaments: "none", description: "Original theme border" };
  const motifs: Record<string, string> = {
    Iron: '<path d="M2 46V14L14 2h32M7 39V17L17 7h22M2 22h5M22 2v5"/><path fill="url(#metal)" d="M11 11h10v4h-6v6h-4Z"/><circle cx="7" cy="7" r="2" fill="url(#metal)"/>',
    Bronze: '<path d="M2 46V15Q2 2 15 2h31M7 41V18Q7 7 18 7h23M3 30q13-1 13-12T30 3M12 12q18-9 18 3t-13 7q-8-4-3-9q4-3 7 1"/><path fill="url(#metal)" d="M8 8l5-3 4 4-4 4Z"/>',
    Silver: '<path d="M2 46V14Q2 2 14 2h32M6 40V17Q6 6 17 6h23M9 32Q25 25 32 9M12 25Q11 11 25 12M8 18q15-5 10-10"/><path d="M18 18l5-8 2 2-7 6 6 2-4 2Z" fill="url(#metal)"/>',
    Gold: '<path d="M2 46V16Q2 2 16 2h30M7 40V19Q7 7 19 7h21M2 33q17-1 17-15T33 2M13 13q21-9 21 5t-17 5q-8-6-1-10q7-3 9 3M12 29q4 6 10 1"/><path d="M8 8l5-4 5 5-5 5Z" fill="url(#metal)"/><circle cx="28" cy="10" r="1.2" fill="url(#metal)"/>',
    Diamond: '<path d="M2 46V16L16 2h30M7 40V19L19 7h21M2 30l5-5M30 2l-5 5"/><path d="M10 18l8-8 10 8-10 10Z" fill="url(#metal)"/><path d="M10 18h18M18 10v18M13 15l10 8M23 15l-10 8" stroke="#ffffff" opacity=".75"/>',
  };
  const ornaments = [0, 90, 270, 180].map(angle => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="metal" x2="1" y2="1"><stop stop-color="${material.highlight}"/><stop offset=".45" stop-color="${material.edge}"/><stop offset=".65" stop-color="${material.highlight}"/><stop offset="1" stop-color="${material.edge}"/></linearGradient></defs><g transform="rotate(${angle} 24 24)" fill="none" stroke="url(#metal)" stroke-width=".9" stroke-linejoin="round">${motifs[name]}</g></svg>`)}")`).join(", ");
  return { ...material, ornaments };
}

export function applyCardAppearance(scope: string) {
  const saved = localStorage.getItem(`aetherborne_card_frame_${scope}`) ?? "OG Theme";
  const name = CARD_FRAMES.includes(saved as typeof CARD_FRAMES[number]) ? saved : "OG Theme";
  const frame = cardFrame(name);
  document.documentElement.dataset.cardFrame = name;
  document.documentElement.style.setProperty("--card-frame-edge", frame.edge);
  document.documentElement.style.setProperty("--card-frame-highlight", frame.highlight);
  document.documentElement.style.setProperty("--card-frame-ornaments", frame.ornaments);
}
