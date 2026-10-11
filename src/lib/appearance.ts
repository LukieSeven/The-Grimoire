export const TEXTURES = ["None", "Fine grain", "Slate / stone", "Leather", "Parchment", "Brushed metal", "Woven cloth"] as const;
export function applyTexture(scope: string) {
  const texture = localStorage.getItem(`aetherborne_texture_${scope}`) ?? "Slate / stone";
  const saved = Number(localStorage.getItem(`aetherborne_texture_intensity_${scope}`) ?? "25");
  document.documentElement.dataset.texture = TEXTURES.includes(texture as typeof TEXTURES[number]) ? texture : "None";
  document.documentElement.style.setProperty("--texture-opacity", String(Number.isFinite(saved) ? Math.max(0, Math.min(100, saved)) / 100 : .25));
}
