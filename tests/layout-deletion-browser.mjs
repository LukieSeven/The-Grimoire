// Final-evaluation regression. Uses only synthetic data in a fresh browser context.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true });
const base = "http://127.0.0.1:3000";

try {
  const context = await browser.newContext({ viewport: { width: 1595, height: 884 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.goto(base);
  const fixture = await page.evaluate(async () => {
    const { importCharacterJSON, storage } = await import("/src/lib/storage.ts");
    const { defaultWorkspacePresets } = await import("/src/lib/workspace-presets.ts");
    const defaults = defaultWorkspacePresets();
    const layout = structuredClone(defaults[0].layout);
    layout.rows = 9;
    const custom = { id: "deletion-regression-custom", name: "Unwanted custom layout", layout };
    const actor = importCharacterJSON(JSON.stringify({
      character: {
        name: "Layout deletion fixture", rank: "Iron", power: 8, vitality: 6,
        agility: 6, endurance: 6, spirit: 7, precision: 6, willpower: 6, charisma: 6,
        currentHp: 30, currentMana: 40, currentDt: 6, tempMana: 3,
        favorites: [{ type: "ability", targetId: 41, label: "Preserved action" }, ...Array(19).fill(null)],
        uiPreferences: { layout, layoutPresets: [...defaults, custom], autoScrollRolls: false },
      },
      abilities: [{ id: 41, name: "Preserved action", rollFormula: "POW", cost: 0 }],
      equipment: [{ id: 51, name: "Preserved equipment", diceType: "d6", modifier: 2, equipped: true }],
      inventory: [{ id: 61, name: "Preserved item", quantity: 3 }],
    }));
    const peer = importCharacterJSON(JSON.stringify({ character: { name: "Untouched layout peer", power: 11 } }));
    storage.addRoll({ characterId: actor.id, diceType: "d6", result: 4, modifier: 0, total: 4, label: "Preserved history", isCrit: false, critBonus: null });
    return { id: actor.id, peerId: peer.id, layout, customId: custom.id };
  });
  await page.goto(`${base}/characters/${fixture.id}`);
  await page.locator('[data-tool="resources"]').waitFor();
  const combatInput = page.locator('[data-tool="combat"]').getByRole("textbox", { name: "Combatant", exact: true });
  await combatInput.fill("Unsaved combatant survives");
  const editor = page.getByRole("region", { name: "Layout editor", exact: true });
  const savedButtons = () => editor.getByRole("group", { name: "Saved layouts", exact: true }).getByRole("button");
  const edit = async () => {
    await page.getByRole("button", { name: "Customize Tool", exact: true }).click();
    await page.getByRole("button", { name: "Customize Layout", exact: true }).click();
    await editor.waitFor();
    await settle();
  };
  const infoSnapshot = () => page.evaluate(id => {
    const collections = {};
    for (const key of Object.keys(localStorage).filter(key => key.startsWith("aetherborne_")).sort()) {
      const raw = localStorage.getItem(key);
      let value;
      try { value = JSON.parse(raw); } catch { value = raw; }
      if (key === "aetherborne_characters") value = value.map(actor => {
        if (actor.id !== id) return actor;
        const clean = structuredClone(actor);
        delete clean.updatedAt;
        delete clean.uiPreferences.layoutPresets;
        delete clean.uiPreferences.deletedLayoutPresetIds;
        return clean;
      });
      collections[key] = value;
    }
    return collections;
  }, fixture.id);
  const preferences = () => page.evaluate(id => JSON.parse(localStorage.getItem("aetherborne_characters")).find(actor => actor.id === id).uiPreferences, fixture.id);
  const frames = () => page.locator(".workspace-grid-cell").evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    return { id: node.dataset.frameId, width: node.dataset.width, height: node.dataset.height, pixelWidth: box.width, pixelHeight: box.height };
  }));
  const openDelete = async id => {
    await editor.getByRole("button", { name: "Delete Layout", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete Layout", exact: true });
    await dialog.waitFor();
    await dialog.getByLabel("Layout to delete", { exact: true }).selectOption(id);
    return dialog;
  };
  const deletePreset = async id => {
    const dialog = await openDelete(id);
    await dialog.getByRole("button", { name: "Delete selected layout", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    await settle();
    await page.waitForFunction(({ actorId, id }) => {
      const preferences = JSON.parse(localStorage.getItem("aetherborne_characters")).find(actor => actor.id === actorId).uiPreferences;
      return preferences.deletedLayoutPresetIds?.includes(id) && !preferences.layoutPresets.some(preset => preset.id === id);
    }, { actorId: fixture.id, id });
  };

  await edit();
  assert.deepEqual(await savedButtons().allTextContents(), ["OG Layout", "New Layout", "Unwanted custom layout"]);
  await editor.getByRole("button", { name: "Add row", exact: true }).click();
  await settle();
  const originalInfo = await infoSnapshot();
  const originalPreferences = await preferences();
  const draftFrames = await frames();
  assert.match(await editor.textContent(), /4 columns × 10 rows/);
  const cancelDialog = await openDelete(fixture.customId);
  assert.deepEqual(await cancelDialog.getByLabel("Layout to delete", { exact: true }).locator("option").allTextContents(), ["OG Layout", "New Layout", "Unwanted custom layout"]);
  await cancelDialog.getByRole("button", { name: "Keep layout", exact: true }).click();
  await cancelDialog.waitFor({ state: "detached" });
  assert.deepEqual(await preferences(), originalPreferences, "Canceling the confirmation must not change saved layouts");
  assert.deepEqual(await frames(), draftFrames, "Canceling must preserve the current draft footprint");

  await deletePreset(fixture.customId);
  assert.equal(await editor.isVisible(), true, "Deleting a snapshot keeps the layout editor open");
  assert.deepEqual(await savedButtons().allTextContents(), ["OG Layout", "New Layout"]);
  assert.match(await editor.textContent(), /4 columns × 10 rows/, "Deleting must not discard the unsaved added row");
  assert.deepEqual(await frames(), draftFrames, "Deleting never changes card geometry or placement");
  assert.equal(await combatInput.inputValue(), "Unsaved combatant survives", "Tool form state remains mounted");
  assert.deepEqual((await preferences()).layout, fixture.layout, "Deleting must not apply the unsaved arrangement");
  assert.deepEqual(await infoSnapshot(), originalInfo, "Deleting must not modify character information, peers, equipment, inventory, abilities, or history");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  await edit();
  assert.deepEqual(await savedButtons().allTextContents(), ["OG Layout", "New Layout"], "Confirmed deletion survives editor cancellation and reload");
  assert.match(await editor.textContent(), /4 columns × 9 rows/, "Cancel restores only the unsaved layout draft");
  console.log("PASS: layout deletion confirms/cancels safely, preserves character and draft data, and survives reload");

  await deletePreset("og-layout");
  await page.reload();
  await edit();
  assert.deepEqual(await savedButtons().allTextContents(), ["New Layout"], "A removed built-in OG layout must not be silently restored");
  assert.deepEqual((await preferences()).layout, fixture.layout, "Deleting the active preset does not remove its applied arrangement");
  await deletePreset("new-layout");
  assert.equal(await savedButtons().count(), 0);
  assert.equal(await editor.getByRole("button", { name: "Delete Layout", exact: true }).isDisabled(), true, "Delete is disabled when there are no saved layouts");
  await page.reload();
  await edit();
  assert.equal(await savedButtons().count(), 0, "Deleting every preset persists across reload");
  assert.deepEqual(await infoSnapshot(), originalInfo, "Repeated deletion leaves all non-preset data unchanged");
  console.log("PASS: built-in presets can be removed per character without changing the current layout or returning on reload");

  await page.goto(`${base}/characters/${fixture.peerId}`);
  await edit();
  assert.deepEqual(await savedButtons().allTextContents(), ["OG Layout", "New Layout"], "Deleting defaults for one character does not remove another character's presets");
  const created = await page.evaluate(async () => {
    const { importCharacterJSON } = await import("/src/lib/storage.ts");
    return importCharacterJSON(JSON.stringify({ character: { name: "Created after deletion", power: 9 } })).id;
  });
  await page.goto(`${base}/characters/${created}`);
  await edit();
  assert.deepEqual(await savedButtons().allTextContents(), ["OG Layout", "New Layout"], "New characters still receive both global defaults");
  assert.equal(await editor.getByRole("button", { name: "OG Layout", exact: true }).getAttribute("aria-pressed"), "true", "OG remains the default applied arrangement for a new character");
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log("PASS: other and newly created characters retain global OG/New defaults, with OG selected");
  await context.close();
} finally {
  await browser.close();
}
