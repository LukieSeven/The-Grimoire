// Exercise the built release at its deployment base using isolated browser storage.
// Never imports development TypeScript modules or uses a persistent user profile.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const base = process.env.PRODUCTION_URL || "http://127.0.0.1:3100/The-Grimoire/";
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1595, height: 884 } });
  await context.addInitScript(() => {
    if (localStorage.getItem("production-smoke-seeded")) return;
    const character = {
      id: 41, name: "Publish Smoke Hero", rank: "Iron", race: "Human", level: 1,
      power: 8, vitality: 6, spirit: 7, agility: 6, endurance: 6, precision: 6, willpower: 6, charisma: 6,
      powerTraining: 0, vitalityTraining: 0, spiritTraining: 0, agilityTraining: 0,
      enduranceTraining: 0, precisionTraining: 0, willpowerTraining: 0, charismaTraining: 0,
      maxHp: 49, currentHp: 49, currentMana: 35, currentDt: 6, dtBonus: 0, speed: 30,
      hpFormula: "Vitality * 8", manaFormula: "Spirit * 5", dtFormula: "Endurance",
      speedFormula: "Agility * 5", familiars: [], favorites: Array(20).fill(null),
      resistances: "", immunities: "", background: null, backstory: null,
      createdAt: "2026-10-23T00:00:00.000Z", updatedAt: "2026-10-23T00:00:00.000Z",
      uiPreferences: { autoScrollRolls: false },
    };
    localStorage.setItem("aetherborne_characters", JSON.stringify([character]));
    for (const collection of ["equipment", "currencies", "inventory", "essences", "abilities", "skills", "rolls", "notes", "recaps"]) {
      localStorage.setItem(`aetherborne_${collection}`, "[]");
    }
    localStorage.setItem("aetherborne_initialized", "true");
    localStorage.setItem("production-smoke-seeded", "true");
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const runtimeErrors = [], badResponses = [], failedRequests = [], devRequests = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  page.on("request", request => {
    if (/\/(?:src\/|tmp\/|@vite\/|@react-refresh)/.test(new URL(request.url()).pathname)) devRequests.push(request.url());
  });
  page.on("response", response => {
    if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", request => failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`));

  await page.goto(base);
  try {
    await page.getByRole("heading", { name: "Publish Smoke Hero", exact: true }).waitFor();
  } catch (error) {
    console.error(JSON.stringify({ url: page.url(), body: (await page.locator("body").innerText()).slice(0, 2000), runtimeErrors, badResponses, failedRequests }));
    throw error;
  }
  await page.getByText("Lovingly crafted by LukieSeven · V1.2", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/The-Grimoire/");
  assert.ok(await page.locator('script[src*="/The-Grimoire/assets/"]').count(), "The deployed entry loads hashed built assets");

  await page.goto(new URL("characters/41", base).href);
  await page.getByRole("heading", { name: "Publish Smoke Hero", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/The-Grimoire/characters/41", "Character routing respects the production base");

  const beginEditing = async () => {
    await page.getByRole("button", { name: "Customize Tool", exact: true }).click();
    await page.getByRole("button", { name: "Customize Layout", exact: true }).click();
  };
  await beginEditing();
  const editor = page.getByRole("region", { name: "Layout editor", exact: true });
  const saved = editor.getByRole("group", { name: "Saved layouts", exact: true });
  assert.deepEqual(await saved.getByRole("button").allTextContents(), ["OG Layout", "New Layout"], "The release preloads both global layouts");
  assert.equal(await saved.getByRole("button", { name: "OG Layout", exact: true }).getAttribute("aria-pressed"), "true", "OG is the default without modifying character data");
  assert.equal(await page.locator('[data-frame-id="belt"]').getAttribute("data-height"), "4");

  await editor.getByRole("button", { name: "Delete Layout", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Delete Layout", exact: true });
  await confirmation.getByLabel("Layout to delete", { exact: true }).selectOption({ label: "New Layout" });
  await confirmation.getByRole("button", { name: "Keep layout", exact: true }).click();
  assert.equal(await saved.getByRole("button", { name: "New Layout", exact: true }).count(), 1, "Canceling deletion keeps the saved layout");
  await editor.getByRole("button", { name: "Delete Layout", exact: true }).click();
  await confirmation.getByLabel("Layout to delete", { exact: true }).selectOption({ label: "New Layout" });
  await confirmation.getByRole("button", { name: "Delete selected layout", exact: true }).click();
  await confirmation.waitFor({ state: "hidden" });
  assert.deepEqual(await saved.getByRole("button").allTextContents(), ["OG Layout"]);
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await page.getByRole("heading", { name: "Publish Smoke Hero", exact: true }).waitFor();
  await beginEditing();
  assert.deepEqual(await saved.getByRole("button").allTextContents(), ["OG Layout"], "Deleted built-in stays deleted after production reload");
  const storage = await page.evaluate(() => ({
    character: JSON.parse(localStorage.getItem("aetherborne_characters"))[0],
    refreshMarkers: Object.keys(localStorage).filter(key => key.startsWith("grimoire:local-preview-refresh:")),
  }));
  assert.equal(storage.character.currentHp, 49);
  assert.equal(storage.character.currentMana, 35);
  assert.equal(storage.character.currentDt, 6);
  assert.deepEqual(storage.refreshMarkers, [], "The production bundle never applies development fixtures");
  assert.deepEqual(devRequests, [], "No development source, fixture, or Vite-client requests");
  assert.deepEqual(badResponses, [], "No missing built assets or HTTP errors");
  assert.deepEqual(failedRequests, [], "No failed release requests");
  assert.deepEqual(runtimeErrors, [], "No browser runtime errors");
  console.log("PASS: built production bundle, /The-Grimoire/ routes, global OG/New defaults, Delete Layout cancel/confirm/persistence, character preservation, zero DEV requests/markers, missing assets, or runtime errors.");
  await context.close();
} finally {
  await browser.close();
}
