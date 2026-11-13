// Focused local preview check; all storage lives in a disposable browser context.
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const bundle = JSON.parse((await readFile(process.env.CHARACTER_FIXTURE || "C:/Users/shadr/Downloads/luke_sheet.soul", "utf8")).replace(/^\uFEFF/, ""));
const actorId = bundle.character.id;
assert.ok(Number.isSafeInteger(actorId), "Fixture has its recorded character ID");
const characterAbility = bundle.abilities.find(ability => ability.equipmentId == null && ability.inventoryItemId == null);
const familiar = bundle.character.familiars?.find(entry => entry.abilities?.length);
const ownedItemAbilities = [
  ["equipment", "equipmentId"],
  ["inventory", "inventoryItemId"],
].flatMap(([collection, key]) => {
  const ability = bundle.abilities.find(entry => entry[key] != null && bundle[collection]?.some(item => item.id === entry[key]));
  return ability ? [{ collection, ability, item: bundle[collection].find(item => item.id === ability[key]) }] : [];
});
assert.ok(characterAbility && familiar && ownedItemAbilities.length, "Fixture includes character, item, and familiar abilities");

const base = process.env.PREVIEW_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({ headless: true });
await mkdir("tmp", { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1595, height: 884 } });
  await context.addInitScript(({ bundle, origin }) => {
    if (location.origin !== origin || sessionStorage.getItem("previewFixtureSeeded")) return;
    const character = { ...bundle.character, uiPreferences: { ...bundle.character.uiPreferences, layout: undefined, autoScrollRolls: false } };
    localStorage.setItem("aetherborne_characters", JSON.stringify([character]));
    for (const key of ["equipment", "currencies", "inventory", "essences", "abilities", "skills", "notes"]) {
      localStorage.setItem(`aetherborne_${key}`, JSON.stringify(bundle[key] ?? []));
    }
    sessionStorage.setItem("previewFixtureSeeded", "true");
  }, { bundle, origin: new URL(base).origin });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.goto(`${base}/characters/${actorId}/ability-editor-preview`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(url => url.pathname === `/characters/${actorId}` && url.searchParams.get("ability-editor") === "preview");

  const allPreviews = page.locator("[data-ability-editor-preview]");
  const tab = name => page.getByRole("tab", { name, exact: true });
  const button = (scope, name) => scope.getByRole("button", { name, exact: true });
  const select = (scope, name) => scope.getByRole("combobox", { name, exact: true });
  const nameField = preview => preview.getByLabel("Ability name", { exact: true });
  const snapshot = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith("aetherborne_"))));
  const expectPreview = async (kind, owner, expectedName) => {
    const preview = page.locator(`[data-ability-editor-preview="${kind}"]`);
    await preview.waitFor();
    assert.equal(await allPreviews.count(), 1, "Only the area being edited has an open draft");
    assert.equal(await page.getByRole("dialog").count(), 1, "Draft stays in the area's own dialog, not a nested modal");
    assert.ok((await page.getByRole("dialog").textContent()).includes(owner), "Draft displays its recorded owner");
    assert.equal(await nameField(preview).inputValue(), expectedName, "Create is blank; edit loads the selected ability");
    for (const region of ["Ability", "Activation", "Targeting", "Effects"]) {
      assert.equal(await preview.getByRole("region", { name: region, exact: true }).isVisible(), true, `${region} is visible for ${kind}`);
      assert.equal(await button(preview, `Help: ${region}`).isVisible(), true, `${region} has contextual help for ${kind}`);
    }
    const moreSettings = preview.locator("summary").filter({ hasText: /^More settings$/ });
    assert.equal(await moreSettings.isVisible(), true, "Advanced settings are available");
    assert.equal(await moreSettings.evaluate(summary => summary.parentElement.open), false, "Advanced settings are closed by default");
    assert.equal(await button(preview, "Show preview").getAttribute("aria-expanded"), "false", "Read-only preview is closed by default");
    assert.equal(await preview.getByRole("complementary", { name: "Ability draft preview" }).count(), 0, "Read-only preview takes no space until requested");
    assert.equal(await preview.getByLabel("Result recipient", { exact: true }).count(), 0, "No duplicate recipient picker");
    assert.equal(await preview.getByLabel(/^Source/).and(preview.locator("select")).count(), kind === "character" ? 1 : 0, "Only the character draft allows an editable source");
    assert.equal(await preview.getByLabel(/^(Item context|Familiar context|Load an existing ability as a preview copy)$/).count(), 0, "Owner and record cannot be switched from inside the draft");
    assert.equal(await button(preview, "Save ability").count(), 0, "No live save action is exposed in preview");
    return preview;
  };
  const closePreview = async preview => {
    await button(preview, "Close preview").click();
    await preview.waitFor({ state: "detached" });
  };
  const checkGeometry = async () => {
    const metrics = await page.getByRole("dialog").evaluate(dialog => {
      const bounds = dialog.getBoundingClientRect();
      const spills = [...dialog.querySelectorAll("input, select, textarea, button")].filter(element => {
        if (!element.getClientRects().length || getComputedStyle(element).visibility === "hidden") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1);
      }).map(element => element.getAttribute("aria-label") || element.textContent || element.tagName);
      return { insideViewport: bounds.left >= -1 && bounds.right <= innerWidth + 1, spills };
    });
    assert.equal(metrics.insideViewport, true, "Dialog fits in the viewport");
    assert.deepEqual(metrics.spills, [], "Dialog controls do not overflow horizontally");
  };

  await tab("Abilities").click();
  const before = await snapshot(); // Allow normal character-sheet initialization before comparing.
  await button(page, "Edit Abilities").click();
  await button(page.getByRole("dialog"), "Create ability").click();
  const characterDraft = await expectPreview("character", bundle.character.name, "");
  const effectHelp = button(characterDraft, "Help: Effects");
  const effectTip = page.locator('[role="tooltip"]').filter({ hasText: "An effect is one change" });
  await effectHelp.hover();
  await effectTip.waitFor({ state: "visible" });
  await nameField(characterDraft).focus();
  const moreSettings = characterDraft.locator("summary").filter({ hasText: /^More settings$/ });
  await button(characterDraft, "Help: More settings").click();
  await page.locator('[role="tooltip"]').filter({ hasText: "Optional mechanics such as" }).waitFor({ state: "visible" });
  assert.equal(await moreSettings.evaluate(summary => summary.parentElement.open), false, "Opening help does not expand the section");
  const checkDraftHelp = button(characterDraft, "Help: Check draft");
  await checkDraftHelp.focus();
  await page.locator('[role="tooltip"]').filter({ hasText: "Validates the standard fields only" }).waitFor({ state: "visible" });
  assert.equal(await characterDraft.getByRole("alert").count(), 0, "Focusing help does not validate the draft");
  await button(characterDraft, "Check draft").click();
  assert.match(await characterDraft.getByRole("alert").textContent(), /Name the ability/);
  await nameField(characterDraft).fill("Preview-only strike");
  await characterDraft.getByLabel("MP cost", { exact: true }).fill("2");
  const enemy = characterDraft.getByRole("checkbox", { name: "Enemy", exact: true });
  await enemy.check();
  await characterDraft.getByLabel(/^Range/).and(characterDraft.locator("select")).selectOption("Ranged");
  await characterDraft.getByLabel("Range (ft)", { exact: true }).fill("30");
  const effects = characterDraft.getByRole("region", { name: "Effects", exact: true });
  const addEffectButton = button(effects, "+ Add effect");
  const applyTo = select(effects, "Apply to");
  const effectType = select(effects, "Effect type");
  const addEffect = async (kind, target) => {
    assert.equal(await addEffectButton.count(), 1, "There is one route to add any effect");
    assert.equal(await effectType.count(), 0, "Effect type is hidden outside the chooser");
    assert.equal(await applyTo.count(), 0, "Target selection is hidden outside the chooser");
    await addEffectButton.click();
    assert.equal(await addEffectButton.count(), 0, "The chooser replaces the add button");
    if (target) await applyTo.selectOption(target);
    else assert.equal(await applyTo.count(), 0, "A single target is applied automatically");
    await effectType.selectOption(kind);
  };
  await addEffect("Damage");
  const formula = characterDraft.getByLabel("Damage formula", { exact: true });
  await formula.fill("20D6 + POW");
  assert.equal(await formula.getAttribute("aria-invalid"), null);
  await formula.fill("");
  assert.equal(await formula.count(), 1, "Clearing a formula keeps its input available");
  await formula.fill("2d6 + (");
  assert.equal(await formula.getAttribute("aria-invalid"), "true", "Broken formula gets local feedback");
  await formula.fill("20D6 + POW");
  await enemy.uncheck();
  assert.equal(await formula.count(), 0, "Deselected targets hide their effects");
  await enemy.check();
  assert.equal(await formula.inputValue(), "20D6 + POW", "Re-selecting a target restores its existing damage formula");
  await characterDraft.getByRole("checkbox", { name: "Ally", exact: true }).check();
  await addEffect("Modifier", "Ally");
  const allyEffects = effects.getByRole("region", { name: "Ally effects", exact: true });
  await select(allyEffects, "Modifier type").selectOption("bonusPower");
  const amount = allyEffects.getByLabel("Amount / formula", { exact: true });
  await amount.fill("+2");
  assert.equal(await amount.inputValue(), "+2");
  assert.equal(await button(effects, "Add modifier").count(), 0, "Modifier edits need no second add action");
  await addEffect("Status", "Enemy");
  const enemyEffects = effects.getByRole("region", { name: "Enemy effects", exact: true });
  const status = select(enemyEffects, "Apply status");
  await status.selectOption("common:Stunned");
  const resistance = select(enemyEffects, "Resistance stat");
  assert.equal(await resistance.isVisible(), false, "Resistance inputs are optional for unconditional statuses");
  const when = select(enemyEffects, "When");
  await when.selectOption("failed-save");
  await resistance.selectOption("Endurance");
  await enemyEffects.getByLabel("Resistance difficulty", { exact: true }).fill("POW");
  assert.equal(await status.inputValue(), "common:Stunned");
  assert.equal(await when.inputValue(), "failed-save");
  assert.equal(await button(effects, "Add status").count(), 0, "Status edits need no second add action");
  await status.selectOption("__custom__");
  const customStatus = enemyEffects.getByRole("region", { name: "Create status" });
  await customStatus.getByLabel("Status name", { exact: true }).fill("Pinned by flame");
  await customStatus.getByLabel("Status rules", { exact: true }).fill("The target cannot move until the flames go out.");
  await button(customStatus, "Use this status").click();
  assert.equal(await status.locator("option:checked").textContent(), "Pinned by flame");
  assert.equal(await when.inputValue(), "failed-save", "Changing the status keeps its application condition");
  await button(effects, "Make a roll").click();
  await select(effects, "Roll for").selectOption("Ally");
  const rolls = effects.getByRole("region", { name: "Standalone rolls", exact: true });
  await rolls.getByLabel("Roll formula", { exact: true }).fill("WILr + 1D6");
  await button(characterDraft, "Check draft").click();
  assert.match(await characterDraft.getByRole("status").textContent(), /Nothing was saved/);
  await button(characterDraft, "Show preview").click();
  assert.equal(await characterDraft.getByRole("complementary", { name: "Ability draft preview" }).isVisible(), true);
  await button(characterDraft, "Hide preview").click();
  await checkGeometry();
  await page.screenshot({ path: "tmp/ability-editor-preview-desktop.png" });
  await button(characterDraft, "Reset draft").click();
  assert.equal(await nameField(characterDraft).inputValue(), "");
  await closePreview(characterDraft);
  await button(page.getByRole("dialog"), `Edit: ${characterAbility.name}`).click();
  const characterCopy = await expectPreview("character", bundle.character.name, characterAbility.name);
  await nameField(characterCopy).fill("Changed only in the character preview");
  await closePreview(characterCopy);
  await button(page.getByRole("dialog"), `Edit: ${characterAbility.name}`).click();
  await expectPreview("character", bundle.character.name, characterAbility.name);
  await closePreview(characterCopy);
  await button(page.getByRole("dialog"), "Close").click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  console.log("PASS: single effect chooser, target-specific damage/modifier/status, draft check/reset, and fresh copies");

  await tab("Bag / Gear").click();
  for (const { collection, ability, item } of ownedItemAbilities) {
    const card = page.locator(`[id="${collection}-card-${item.id}"]`);
    const ownerType = collection === "equipment" ? "equipment" : "item";
    await button(card, `Add ability to ${item.name}`).click();
    const directDraft = await expectPreview("item", item.name, "");
    assert.equal(await directDraft.getAttribute("data-ability-preview-owner"), ownerType);
    await closePreview(directDraft);
    await button(page.getByRole("dialog"), "Cancel").click();
    await button(card, `Edit ${ownerType}: ${item.name}`).click();
    const parent = page.getByRole("dialog", { name: `Edit ${ownerType}`, exact: true });
    const parentName = parent.getByLabel("Name", { exact: true });
    const sections = collection === "equipment" ? ["Details", "Weapon roll", "Bonuses while equipped", "Equipment abilities", "Equipment set"] : ["Details", "Item abilities"];
    for (const section of sections) {
      const panel = parent.getByRole("region", { name: section, exact: true });
      assert.equal(await panel.isVisible(), true, `${ownerType}: ${section} is visible`);
      assert.equal(await button(panel, `Help: ${section}`).isVisible(), true, `${section} has its own help`);
    }
    const footer = parent.locator("footer");
    assert.equal(await button(footer, "Cancel").isVisible(), true);
    assert.equal(await button(footer, "Save changes").isVisible(), true);
    const unsaved = `${item.name} (unsaved parent edit)`;
    await parentName.fill(unsaved);
    await button(parent, `Preview new ${ownerType} ability`).click();
    const itemDraft = await expectPreview("item", item.name, "");
    await nameField(itemDraft).fill("Unsaved new item ability");
    await closePreview(itemDraft);
    assert.equal(await parentName.inputValue(), unsaved, "Closing a new item draft restores unsaved parent edits");
    await button(parent, `Preview ${ownerType} ability: ${ability.name}`).click();
    const itemCopy = await expectPreview("item", item.name, ability.name);
    await nameField(itemCopy).fill("Unsaved item copy");
    await closePreview(itemCopy);
    assert.equal(await parentName.inputValue(), unsaved, "Closing an item copy restores unsaved parent edits");
    await button(parent, "Cancel").click();
    await parent.waitFor({ state: "detached" });
  }
  console.log("PASS: item ability drafts stay with the selected gear entry and preserve its unsaved form");

  await tab("Familiars").click();
  await button(page.locator(`[id="familiar-card-${familiar.id}"]`), "Edit").click();
  const familiarParent = page.getByRole("dialog", { name: `Edit Familiar: ${familiar.name}`, exact: true });
  const familiarName = familiarParent.getByRole("textbox").first();
  const unsavedFamiliar = `${familiar.name} (unsaved parent edit)`;
  await familiarName.fill(unsavedFamiliar);
  await button(familiarParent, "+ Preview New Ability").click();
  const familiarDraft = await expectPreview("familiar", familiar.name, "");
  await nameField(familiarDraft).fill("Unsaved new familiar ability");
  await closePreview(familiarDraft);
  assert.equal(await familiarName.inputValue(), unsavedFamiliar);
  await button(familiarParent, `Preview ability: ${familiar.abilities[0].name}`).click();
  const familiarCopy = await expectPreview("familiar", familiar.name, familiar.abilities[0].name);
  await nameField(familiarCopy).fill("Unsaved familiar copy");
  await page.setViewportSize({ width: 630, height: 764 });
  await checkGeometry();
  await page.screenshot({ path: "tmp/ability-editor-preview-narrow.png" });
  await closePreview(familiarCopy);
  assert.equal(await familiarName.inputValue(), unsavedFamiliar, "Closing a familiar copy restores unsaved parent edits");
  await button(familiarParent, "Cancel").click();
  await familiarParent.waitFor({ state: "detached" });
  assert.deepEqual(await snapshot(), before, "Preview edits never write character, item, familiar, or other saved tool data");
  assert.deepEqual(errors, [], "No runtime errors");
  console.log("PASS: familiar-local editing, shared fields in all areas, narrow layout, and unchanged saved data");
  await context.close();
} finally {
  await browser.close();
}
