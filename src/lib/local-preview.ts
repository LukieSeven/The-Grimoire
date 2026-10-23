/** Optional, ignored development fixture. Never applies to a published build. */
export async function refreshLocalPreview(): Promise<void> {
  if (!import.meta.env.DEV || !["127.0.0.1", "localhost"].includes(location.hostname)) return;
  const response = await fetch("/tmp/preview-refresh.json", { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
  const config: { targetCharacterId?: number; source?: string; expectedExistingName?: string } = await response.json();
  if (!Number.isSafeInteger(config.targetCharacterId) || !config.source?.startsWith("/tmp/")) return;
  if (location.pathname !== `/characters/${config.targetCharacterId}`) return;
  const fixture = await fetch(config.source, { cache: "no-store" });
  if (!fixture.ok) throw new Error("The local preview character file could not be loaded.");
  const text = await fixture.text();
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const marker = `grimoire:local-preview-refresh:${config.targetCharacterId}:${digest}`;
  if (localStorage.getItem(marker)) return;
  const { storage, refreshCharacterJSON } = await import("./storage");
  const previous = storage.getCharacter(config.targetCharacterId!);
  const bundle = JSON.parse(text);
  // Never seed or overwrite a different character in a fresh/test browser.
  const expectedNames = [config.expectedExistingName, bundle.character?.name].filter((name): name is string => typeof name === "string").map(name => name.toLowerCase());
  if (!previous || !expectedNames.includes(previous.name.toLowerCase())) return;
  refreshCharacterJSON(previous.id, text);
  localStorage.setItem(marker, new Date().toISOString());
}
