// Focused familiar-card check. Isolated storage never touches the user's preview.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const fixture = await readFile(process.env.CHARACTER_FIXTURE || "C:/Users/shadr/Downloads/luke_sheet.soul", "utf8");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1595, height: 884 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:3000/");
  const actor = await page.evaluate(async fixture => {
    const bundle = JSON.parse(fixture.replace(/^\uFEFF/, ""));
    const { defaultWorkspacePresets } = await import("/src/lib/workspace-presets.ts");
    bundle.character.uiPreferences = { ...bundle.character.uiPreferences, layout: defaultWorkspacePresets()[1].layout, autoScrollRolls: false };
    const familiar = bundle.character.familiars[0];
    familiar.currentHp = 0;
    familiar.currentMana = 0;
    familiar.tempHp = 0;
    familiar.tempMana = 3;
    familiar.abilities.push({ id: 987654321, name: "Compact wiring check", cost: 1, range: "Self", speed: "Action", type: "Attack", rollFormula: "2d6 + POW" });
    const { importCharacterJSON } = await import("/src/lib/storage.ts");
    const character = importCharacterJSON(JSON.stringify(bundle));
    return { characterId: character.id, familiarId: familiar.id, familiarName: familiar.name };
  }, fixture);
  await page.goto(`http://127.0.0.1:3000/characters/${actor.characterId}`);
  await page.evaluate(() => { Math.random = () => .4; });
  await page.getByRole("tab", { name: "Familiars", exact: true }).click();
  const card = page.locator(`[id="familiar-card-${actor.familiarId}"]`);
  await card.waitFor();
  const belt = page.locator('[data-frame-id="belt"]');
  const beltBefore = await belt.boundingBox();
  const metrics = await card.evaluate(card => {
    const summary = card.querySelector(".familiar-summary").getBoundingClientRect();
    const panels = card.querySelector(".familiar-panels").getBoundingClientRect();
    const spills = [...card.querySelectorAll(".stat-training-label, .stat-training-count, .stat-training-buttons")].filter(node => {
      if (!node.getClientRects().length) return false;
      const bounds = node.getBoundingClientRect(), parent = node.closest(".familiar-stat-card").getBoundingClientRect();
      return bounds.right > parent.right + 1 || bounds.left < parent.left - 1 || node.scrollWidth > node.clientWidth + 1;
    }).map(node => node.textContent);
    return { width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height, split: summary.right <= panels.left, spills };
  });
  assert.ok(metrics.split, "Resources and stats sit side by side at half-Belt width");
  assert.deepEqual(metrics.spills, [], "Training counts and controls fit the compact cells");
  assert.equal(await card.getByRole("progressbar").count(), 3, "Three shared resource bars remain visible");
  const snapshot = () => page.evaluate(async actor => {
    const { storage } = await import("/src/lib/storage.ts");
    const character = storage.getCharacter(actor.characterId);
    return { familiar: character.familiars.find(familiar => familiar.id === actor.familiarId), hp: character.currentHp, mana: character.currentMana, rolls: storage.getRolls(actor.characterId) };
  }, actor);
  const before = await snapshot();
  const training = card.getByRole("button", { name: `Increase ${actor.familiarName} POW training`, exact: true });
  await training.click();
  await page.waitForFunction(async actor => {
    const { storage } = await import("/src/lib/storage.ts");
    return storage.getCharacter(actor.characterId).familiars.find(f => f.id === actor.familiarId).powerTraining !== actor.previous;
  }, { ...actor, previous: before.familiar.powerTraining ?? 0 });
  await card.getByRole("button", { name: `Decrease ${actor.familiarName} POW training`, exact: true }).click();
  const amount = card.getByPlaceholder("Amount", { exact: true });
  await amount.fill("5");
  await card.getByRole("button", { name: "Temp", exact: true }).click();
  await page.waitForFunction(async actor => {
    const { storage } = await import("/src/lib/storage.ts");
    return storage.getCharacter(actor.characterId).familiars.find(f => f.id === actor.familiarId).tempHp === 5;
  }, actor);
  await amount.fill("2");
  await card.getByRole("button", { name: "Dmg", exact: true }).click();
  await page.waitForFunction(async actor => {
    const { storage } = await import("/src/lib/storage.ts");
    return storage.getCharacter(actor.characterId).familiars.find(f => f.id === actor.familiarId).tempHp === 3;
  }, actor);
  await card.getByRole("tab", { name: /^Abilities/ }).click();
  await card.locator('[id$="-987654321"]').getByRole("button", { name: "Activate", exact: true }).click();
  await page.waitForFunction(async actor => {
    const { storage } = await import("/src/lib/storage.ts");
    return storage.getRolls(actor.characterId).some(roll => roll.label === "Fam: Compact wiring check Cast");
  }, actor);
  const after = await snapshot();
  const roll = after.rolls.find(roll => roll.label === "Fam: Compact wiring check Cast");
  assert.equal(roll.familiarId, actor.familiarId, "Ability roll retains creature ownership");
  const expectedPower = await page.evaluate(async actor => {
    const { storage } = await import("/src/lib/storage.ts");
    const { getFamiliarAdjusted } = await import("/src/lib/familiar-values.ts");
    return getFamiliarAdjusted(storage.getCharacter(actor.characterId).familiars.find(f => f.id === actor.familiarId)).stats.power;
  }, actor);
  assert.equal(roll.total, 6 + expectedPower, "Ability formula uses creature POW, not player POW");
  assert.equal(after.familiar.currentMana, before.familiar.currentMana, "Temporary mana pays the ability cost first");
  assert.equal(after.familiar.tempMana, 2);
  assert.equal(after.familiar.currentHp, before.familiar.currentHp);
  assert.equal(after.rolls.find(roll => roll.label === `Fam: ${actor.familiarName} DMG`).total, -2, "History includes temporary HP spent at zero base HP");
  assert.equal(after.hp, before.hp, "Familiar controls never mutate player HP");
  assert.equal(after.mana, before.mana, "Familiar controls never mutate player mana");
  const beltAfter = await belt.boundingBox();
  assert.equal(beltAfter.width, beltBefore.width);
  assert.equal(beltAfter.height, beltBefore.height);
  await card.getByRole("tab", { name: "Stats", exact: true }).click();
  await card.locator('.compact-resource-choice').filter({ has: page.locator('.compact-resource-name', { hasText: /^MP$/ }) }).click();
  await amount.fill("5");
  await card.getByRole("button", { name: "Use", exact: true }).click();
  await page.waitForFunction(async actor => {
    const { storage } = await import("/src/lib/storage.ts");
    return storage.getCharacter(actor.characterId).familiars.find(f => f.id === actor.familiarId).tempMana === 0;
  }, actor);
  const drained = await snapshot();
  assert.equal(drained.familiar.currentMana, 0);
  assert.equal(drained.rolls.find(roll => roll.label === `Fam: ${actor.familiarName} Spent Mana`).total, -2, "History records actual available mana spent, including temporary points");
  const ids = await page.locator('.compact-resources input[id]').evaluateAll(inputs => inputs.map(input => input.id));
  assert.equal(new Set(ids).size, ids.length, "Shared resource inputs have unique IDs");
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(JSON.stringify({ passed: true, metrics, creatureFormulaTotal: roll.total }));
  await context.close();
} finally { await browser.close(); }
