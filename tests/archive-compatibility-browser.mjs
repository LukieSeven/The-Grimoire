// Browser-level archive compatibility after the Zod upgrade. Synthetic isolated data only.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true });
const collections = ["characters", "equipment", "currencies", "inventory", "essences", "abilities", "skills", "notes", "rolls"];
try {
  const page = await browser.newPage({ viewport: { width: 1480, height: 764 }, acceptDownloads: true });
  page.setDefaultTimeout(20000);
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
  const fixture = await page.evaluate(async () => {
    const { defaultWorkspacePresets } = await import("/src/lib/workspace-presets.ts");
    const presets = defaultWorkspacePresets();
    return {
      backup: true,
      characters: [{ id: 10, name: "Legacy archive hero", rank: "Iron", futureEntity: { nested: ["retain", { enabled: true }] },
        uiPreferences: { autoScrollRolls: false, layout: presets[1].layout, layoutPresets: presets, deletedLayoutPresetIds: ["deleted-personal-layout"], unknownPreference: "preserve" },
        familiars: [{ id: "familiar-uuid", name: "Legacy familiar", className: "Iron", power: 6, abilities: [{ id: 51, name: "Nested action", customDefinition: { deeply: [1, 2] } }], effectApplications: [{ id: "pet-effect", abilityId: 51, effectId: "pet-definition", targetId: "self" }], unknownCreatureField: "preserve" }],
        effectApplications: [{ id: "hero-effect", abilityId: 50, effectId: "legacy-result", targetId: "self" }],
        favorites: [{ type: "weapon", targetId: 20 }, { type: "ability", targetId: 50 }],
        trackerEncounter: { combatants: [{ id: "b", name: "B", initiative: 17, statuses: [] }, { id: "a", name: "A", initiative: 17, statuses: ["Prone"] }], turn: 1 },
      }],
      equipment: [{ id: 20, characterId: 10, name: "Legacy weapon", unknownWeapon: { formula: "POWr" } }],
      currencies: [{ id: 80, characterId: 10, name: "Marks", amount: 71, legacyCurrency: "retain" }],
      inventory: [{ id: 30, characterId: 10, name: "Legacy item", quantity: 2, unknownItem: ["retain"] }],
      essences: [{ id: 40, characterId: 10, name: "Legacy essence", slot: 1, unknownEssence: true }],
      abilities: [{ id: 50, characterId: 10, name: "Linked legacy action", equipmentId: 20, inventoryItemId: 30, essenceId: 40, unknownAbility: { child: ["retain"] } }],
      skills: [{ id: 60, characterId: 10, name: "Legacy skill", value: 3, unknownSkill: "retain" }],
      notes: [{ id: 70, characterId: 10, title: "Legacy note", content: "Synthetic reference", unknownNote: { retain: true } }],
      rolls: [{ id: 90, characterId: 10, diceType: "6+6", result: 12, modifier: 2, total: 14, isCrit: true, criticalDice: [{ sides: 6 }, { sides: 6, target: 5 }], unknownRoll: "retain" }],
      codex: [{ id: 100, title: "Synthetic Codex", content: "Legacy lore", unknownCodex: { retain: [true] } }],
      unlockedPasswords: ["synthetic-unlock"],
    };
  });
  const importArchive = (method, data) => page.evaluate(async ({ method, data }) => {
    const api = await import("/src/lib/storage.ts");
    return api[method](JSON.stringify(data));
  }, { method, data });
  const downloadArchive = async method => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.evaluate(async method => { const api = await import("/src/lib/storage.ts"); api[method](); }, method),
    ]);
    return JSON.parse(await readFile(await download.path(), "utf8"));
  };
  const rawState = () => page.evaluate(() => Object.fromEntries([
    "characters", "equipment", "currencies", "inventory", "essences", "abilities", "skills", "notes", "rolls", "codex", "unlocked_passwords",
  ].map(key => [key, localStorage.getItem(`aetherborne_${key}`)])));
  assert.deepEqual(await importArchive("importFullBackup", fixture), { count: 1 });
  const full = await downloadArchive("exportFullBackup");
  assert.equal(full.fullArchive, true);
  assert.equal(full.schemaVersion, 1);
  for (const key of [...collections, "codex", "unlockedPasswords"]) assert.deepEqual(full[key], fixture[key], `Full archive preserves ${key}`);
  await importArchive("importFullBackup", full);
  assert.deepEqual((await downloadArchive("exportFullBackup")).characters, full.characters, "Canonical full archive round-trips without nested-field loss");
  console.log("PASS: legacy/full archive downloads preserve unknown fields, nested familiars/effects, layouts, links and critical dice");

  const roster = structuredClone(fixture);
  roster.characters[0].name = "Roster-only replacement";
  roster.codex = [{ id: 999, title: "Must not replace Codex" }];
  roster.unlockedPasswords = ["must-not-replace-unlocks"];
  const beforeRoster = await rawState();
  await importArchive("importGrimoireBackup", roster);
  const afterRoster = await rawState();
  assert.equal(afterRoster.codex, beforeRoster.codex);
  assert.equal(afterRoster.unlocked_passwords, beforeRoster.unlocked_passwords);
  const grimoire = await downloadArchive("exportGrimoireBackup");
  assert.equal(grimoire.grimoireBackup, true);
  assert.equal(grimoire.schemaVersion, 1);
  assert.equal(grimoire.codex, undefined);
  for (const key of collections) assert.deepEqual(grimoire[key], roster[key], `Roster archive preserves ${key}`);
  await importArchive("importGrimoireBackup", grimoire);
  console.log("PASS: legacy/Grimoire roster import-export retains sheet data without touching Codex or unlocks");

  const codex = { backup: true, codex: [{ id: 101, title: "Codex replacement", nestedUnknown: { retain: ["yes"] } }], unlockedPasswords: ["synthetic-second-unlock"] };
  const beforeCodex = await rawState();
  await importArchive("importCodexBackup", codex);
  const afterCodex = await rawState();
  for (const key of collections) assert.equal(afterCodex[key], beforeCodex[key], `Codex import leaves ${key} untouched`);
  const registry = await downloadArchive("exportCodexBackup");
  assert.equal(registry.codexBackup, true);
  assert.equal(registry.schemaVersion, 1);
  assert.deepEqual(registry.codex, codex.codex);
  assert.deepEqual(registry.unlockedPasswords, codex.unlockedPasswords);
  await importArchive("importCodexBackup", registry);
  console.log("PASS: legacy/Codex registry round-trip preserves custom data and never overwrites the roster");

  const saved = await rawState();
  const invalid = [
    ["importFullBackup", { backup: true, characters: [{ id: 1, name: "" }] }],
    ["importFullBackup", { backup: true, schemaVersion: 2, characters: [] }],
    ["importGrimoireBackup", { backup: true, characters: [{ id: 1, name: "Hero" }], abilities: [{ id: 2, characterId: 1, equipmentId: 999 }] }],
    ["importCodexBackup", { backup: true, codex: [{ id: "invalid", title: "Invalid" }] }],
  ];
  for (const [method, data] of invalid) {
    const error = await page.evaluate(async ({ method, data }) => {
      const api = await import("/src/lib/storage.ts");
      try { api[method](JSON.stringify(data)); return null; } catch (error) { return String(error); }
    }, { method, data });
    assert.ok(error, `${method} rejects invalid input`);
    assert.deepEqual(await rawState(), saved, `${method} rejection preserves all existing collections`);
  }
  await importArchive("importFullBackup", { backup: true, characters: [{ id: 1, name: "Minimal legacy" }] });
  const minimal = await downloadArchive("exportFullBackup");
  for (const key of [...collections.filter(key => key !== "characters"), "codex", "unlockedPasswords"]) assert.deepEqual(minimal[key], [], `Missing legacy collection ${key} defaults safely`);
  console.log("PASS: malformed/newer archives cannot overwrite storage; omitted legacy collections still receive safe defaults");
} finally { await browser.close(); }
