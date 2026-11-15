// Verify the built app with synthetic data in a disposable browser context.
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const base = process.env.PRODUCTION_URL || "http://127.0.0.1:3100/The-Grimoire/";
const characterId = 410;
const familiarId = 411;
const equipmentId = 412;
const itemId = 413;
const areas = [
  { kind: "character", abilityName: "Trial Hero Strike" },
  { kind: "equipment", abilityName: "Trial Blade Strike", ownerName: "Trial Blade", id: equipmentId },
  { kind: "item", abilityName: "Trial Flask Strike", ownerName: "Trial Flask", id: itemId },
  { kind: "familiar", abilityName: "Trial Lynx Strike", ownerName: "Trial Lynx", id: familiarId },
];

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1595, height: 884 } });
  await context.addInitScript(({ origin, characterId, familiarId, equipmentId, itemId }) => {
    if (location.origin !== origin || localStorage.getItem("live-ability-smoke-seeded")) return;
    const stats = { power: 8, vitality: 6, spirit: 7, agility: 6, endurance: 6, precision: 6, willpower: 6, charisma: 6 };
    const training = Object.fromEntries(Object.keys(stats).map(stat => [`${stat}Training`, 0]));
    const values = { level: 1, currentHp: 48, currentMana: 35, currentDt: 6, dtBonus: 0, speed: 30, hpFormula: "Vitality * 8", manaFormula: "Spirit * 5", dtFormula: "Endurance", speedFormula: "Agility * 5", resistances: "", immunities: "" };
    const familiar = { ...stats, ...training, ...values, id: familiarId, name: "Trial Lynx", className: "Iron", race: "Lynx", abilities: [] };
    const character = {
      ...stats, ...training, ...values, id: characterId, name: "Live Ability Trial Hero", rank: "Iron", race: "Human", maxHp: 48,
      familiars: [familiar], favorites: Array(20).fill(null), background: null, backstory: null,
      createdAt: "2026-10-23T00:00:00.000Z", updatedAt: "2026-10-23T00:00:00.000Z", uiPreferences: { autoScrollRolls: false },
    };
    const equipment = { id: equipmentId, characterId, name: "Trial Blade", description: "", equipped: false, assignedToQuickRolls: false, dtBonus: 0, statModifiers: {}, diceType: "1d6 + POWm", modifier: 0 };
    const item = { id: itemId, characterId, name: "Trial Flask", description: "", quantity: 2 };
    for (const collection of ["currencies", "essences", "abilities", "skills", "rolls", "notes", "recaps"]) localStorage.setItem(`aetherborne_${collection}`, "[]");
    localStorage.setItem("aetherborne_characters", JSON.stringify([character]));
    localStorage.setItem("aetherborne_equipment", JSON.stringify([equipment]));
    localStorage.setItem("aetherborne_inventory", JSON.stringify([item]));
    localStorage.setItem("aetherborne_initialized", "true");
    localStorage.setItem("live-ability-smoke-seeded", "true");
  }, { origin: new URL(base).origin, characterId, familiarId, equipmentId, itemId });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const runtimeErrors = [];
  page.on("pageerror", error => runtimeErrors.push(error.message));
  const button = (scope, name) => scope.getByRole("button", { name, exact: true });
  const tab = name => page.getByRole("tab", { name, exact: true });
  const draft = page.locator("[data-prototype-ability-fields]");
  const dialog = () => page.getByRole("dialog");
  const readSaved = () => page.evaluate(({ characterId, familiarId }) => {
    const read = key => JSON.parse(localStorage.getItem(`aetherborne_${key}`) ?? "[]");
    const owner = read("characters").find(entry => entry.id === characterId);
    return {
      abilities: read("abilities").filter(entry => entry.characterId === characterId),
      familiar: owner.familiars.find(entry => entry.id === familiarId),
      equipment: read("equipment").find(entry => entry.characterId === characterId),
      item: read("inventory").find(entry => entry.characterId === characterId),
    };
  }, { characterId, familiarId });
  const getAbility = (saved, area, name) => (area.kind === "familiar" ? saved.familiar.abilities : saved.abilities).find(ability => ability.name === name);
  const openDraft = async (area, editing) => {
    if (area.kind === "character") {
      await tab("Abilities").click();
      await button(page, "Edit Abilities").click();
      await button(dialog(), editing ? `Edit: ${area.abilityName}` : "Create ability").click();
    } else if (area.kind === "familiar") {
      await tab("Familiars").click();
      await button(page.locator(`[id="familiar-card-${area.id}"]`), "Edit").click();
      await button(dialog(), editing ? `Edit ability: ${area.abilityName}` : "+ Add Ability").click();
    } else {
      await tab("Bag / Gear").click();
      const card = page.locator(`[id="${area.kind === "equipment" ? "equipment" : "inventory"}-card-${area.id}"]`);
      if (editing) {
        await button(card, `Edit ${area.kind}: ${area.ownerName}`).click();
        await button(dialog(), `Edit ${area.kind} ability: ${area.abilityName}`).click();
      } else await button(card, `Add ability to ${area.ownerName}`).click();
    }
    await draft.waitFor();
    assert.equal(await page.locator("[data-ability-editor-preview]").count(), 0, "The release uses the live form, not a preview draft");
  };
  const saveDraft = async area => {
    assert.equal(await button(dialog(), "Check draft").count(), 0);
    await button(dialog(), "Save").click();
    await draft.waitFor({ state: "hidden" });
    await button(dialog(), area.kind === "character" ? "Close" : "Cancel").click();
    await dialog().waitFor({ state: "hidden" });
  };
  const nameField = () => draft.getByLabel("Ability name", { exact: true });
  const formulaField = () => draft.getByLabel("Damage formula", { exact: true });

  await page.goto(new URL(`characters/${characterId}?ability-editor=preview`, base).href);
  await page.getByRole("heading", { name: "Live Ability Trial Hero", exact: true }).waitFor();
  await tab("Familiars").click();
  await button(page.locator(`[id="familiar-card-${familiarId}"]`), "Edit").click();
  const movement = dialog().getByLabel("Movement Speed", { exact: true });
  await movement.fill("Aglity * 5");
  assert.equal(await movement.getAttribute("aria-invalid"), "true");
  await movement.fill("0");
  assert.notEqual(await movement.getAttribute("aria-invalid"), "true");
  await button(dialog(), "Cancel").click();

  const createdIds = new Map();
  for (const area of areas) {
    await openDraft(area, false);
    if (area.kind === "character") {
      const before = await readSaved();
      await button(dialog(), "Save").click();
      assert.match(await dialog().getByRole("alert").textContent(), /Name the ability/);
      assert.deepEqual(await readSaved(), before, "Invalid Save does not write to storage");
    }
    await nameField().fill(area.abilityName);
    if (area.kind === "equipment" || area.kind === "item") {
      await draft.getByLabel("Use type", { exact: true }).selectOption(area.kind === "equipment" ? "rechargeable" : "one-time");
      if (area.kind === "equipment") await draft.getByLabel("Maximum charges", { exact: true }).fill("3");
    }
    await draft.getByRole("checkbox", { name: "Enemy", exact: true }).check();
    await button(draft, "+ Add effect").click();
    await draft.getByRole("combobox", { name: "Effect type", exact: true }).selectOption("Damage");
    if (area.kind === "character") {
      const before = await readSaved();
      await formulaField().fill("2d6 + (");
      await button(dialog(), "Save").click();
      assert.match(await dialog().getByRole("alert").textContent(), /roll formula/i);
      assert.deepEqual(await readSaved(), before, "Invalid roll formula does not write to storage");
    }
    await formulaField().fill("WILr + 1D6");
    await saveDraft(area);
    const created = getAbility(await readSaved(), area, area.abilityName);
    assert.ok(created, `${area.kind} ability saves to its owner`);
    createdIds.set(area.kind, created.id);
    assert.equal(created.definition?.results[0]?.formula, "WILr + 1D6");
  }

  await page.reload();
  for (const area of areas) {
    await openDraft(area, true);
    assert.equal(await nameField().inputValue(), area.abilityName);
    assert.equal(await formulaField().inputValue(), "WILr + 1D6", `${area.kind} formula reloads in the live editor`);
    await nameField().fill(`${area.abilityName} Revised`);
    await formulaField().fill("WILr + 2D6");
    await saveDraft(area);
  }

  await page.reload();
  const saved = await readSaved();
  assert.equal(saved.abilities.length, 3, "The familiar action stays off the character's ability list");
  assert.equal(saved.familiar.abilities.length, 1, "Editing replaces the familiar action in place");
  assert.equal(saved.familiar.name, "Trial Lynx");
  assert.equal(saved.equipment.diceType, "1d6 + POWm", "Editing an ability does not change the weapon strike");
  assert.equal(saved.item.quantity, 2, "Editing an ability does not consume its item");
  for (const area of areas) {
    const ability = getAbility(saved, area, `${area.abilityName} Revised`);
    assert.ok(ability, `${area.kind} edit survives reload`);
    assert.equal(ability.id, createdIds.get(area.kind), `${area.kind} edit keeps the original ability ID`);
    assert.equal(ability.definition?.results[0]?.formula, "WILr + 2D6");
    if (area.kind !== "familiar") {
      assert.equal(ability.equipmentId ?? null, area.kind === "equipment" ? equipmentId : null);
      assert.equal(ability.inventoryItemId ?? null, area.kind === "item" ? itemId : null);
    }
    if (area.kind === "equipment") {
      assert.equal(ability.usageType, "rechargeable");
      assert.equal(ability.maxCharges, 3);
      assert.equal(ability.currentCharges, 3);
    }
    if (area.kind === "item") assert.equal(ability.usageType, "one-time");
  }
  await tab("Bag / Gear").click();
  await button(page, "Edit equipment: Trial Blade").click();
  await button(dialog(), "Open set blueprint").click();
  const blueprint = page.locator("[data-equipment-blueprint-preview]");
  await blueprint.waitFor();
  assert.equal(await button(blueprint, "Load Emberclasp example").count(), 0, "The temporary demo launcher is gone");
  assert.equal(await button(blueprint, "Open equipment file").isVisible(), true);
  assert.deepEqual(runtimeErrors, [], "The live editor runs without browser errors");
  console.log("PASS: live character, equipment, item, and familiar ability creation/editing with owner links and formulas preserved across reloads");
  await context.close();
} finally {
  await browser.close();
}
