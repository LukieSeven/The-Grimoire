// Manual tie ordering and bounded Combat scrolling; fresh browser storage only.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1480, height: 764 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
  const id = await page.evaluate(async () => {
    const { importCharacterJSON } = await import("/src/lib/storage.ts");
    const { defaultWorkspaceLayout } = await import("/src/lib/workspace-layout.ts");
    const actor = importCharacterJSON(JSON.stringify({ character: {
      name: "Combat manual check", rank: "Iron", power: 8, agility: 6,
      currentHp: 41, currentMana: 24, currentDt: 6,
      uiPreferences: { layout: defaultWorkspaceLayout(), autoScrollRolls: false },
    } }));
    const combatants = [
      { id: "enemy2", name: "Enemy2", initiative: 20, statuses: [] },
      { id: "lucas", name: "Lucas", initiative: 17, statuses: [] },
      { id: "pete", name: "Pete", initiative: 17, statuses: ["Prone"] },
      { id: "lyth", name: "Lyth", initiative: 17, statuses: [] },
      { id: "enemy3", name: "Enemy3", initiative: 5, statuses: [] },
      ...Array.from({ length: 12 }, (_, index) => ({ id: `extra-${index}`, name: `Extra ${index}`, initiative: 4 - index, statuses: [] })),
    ];
    localStorage.setItem(`aetherborne_combatants_${actor.id}`, JSON.stringify(combatants));
    localStorage.setItem(`aetherborne_combatants_turn_${actor.id}`, "2");
    return actor.id;
  });
  await page.goto(`http://127.0.0.1:3000/characters/${id}`, { waitUntil: "domcontentloaded" });
  const combat = page.locator('[data-tool="combat"]');
  const list = combat.locator('[data-tracker-scroll="combat"]');
  const frame = page.locator('[data-frame-id="tracker"]');
  const row = key => list.locator(`[data-combatant-id="${key}"]`);
  await list.waitFor();
  const snapshot = () => page.evaluate(async id => {
    const { storage } = await import("/src/lib/storage.ts");
    const character = storage.getCharacter(id);
    const entries = JSON.parse(localStorage.getItem(`aetherborne_combatants_${id}`));
    const turn = Number(localStorage.getItem(`aetherborne_combatants_turn_${id}`));
    return { entries, active: entries[turn]?.id, hero: { name: character.name, hp: character.currentHp, mana: character.currentMana, dt: character.currentDt, layout: character.uiPreferences.layout } };
  }, id);
  const settled = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const expectOrder = async expected => {
    await page.waitForFunction(({ id, expected }) => {
      const entries = JSON.parse(localStorage.getItem(`aetherborne_combatants_${id}`));
      return entries.slice(0, expected.length).map(entry => entry.id).join(",") === expected.join(",");
    }, { id, expected });
    assert.deepEqual((await snapshot()).entries.slice(0, expected.length).map(entry => entry.id), expected);
  };
  const verifyBounds = async label => {
    await settled();
    const bounds = await combat.evaluate(node => {
      const frame = node.closest('[data-frame-id="tracker"]').getBoundingClientRect();
      const scroll = node.querySelector('[data-tracker-scroll="combat"]');
      const list = scroll.getBoundingClientRect(), footer = node.querySelector("footer").getBoundingClientRect();
      return { frame: { width: frame.width, height: frame.height }, scrolls: scroll.scrollHeight > scroll.clientHeight,
        overflow: getComputedStyle(scroll).overflowY, bounded: list.top >= frame.top - 1 && list.bottom <= footer.top + 1 && footer.bottom <= frame.bottom + 1 };
    });
    assert.ok(bounds.scrolls, `${label}: list scrolls instead of overlaying adjacent cards`);
    assert.equal(bounds.overflow, "auto");
    assert.ok(bounds.bounded, `${label}: scrollport and footer remain inside the fixed frame`);
    return bounds.frame;
  };
  const before = await snapshot();
  const originalBounds = await verifyBounds("desktop");
  await expectOrder(["enemy2", "lucas", "pete", "lyth", "enemy3"]);
  assert.equal(before.active, "pete");
  assert.equal(await row("lyth").locator('[aria-label="Move Lyth up"]').isVisible(), false, "Reorder controls are hidden until the combatant is expanded");
  await row("lyth").locator("summary").click();
  assert.ok(await row("lyth").getByRole("button", { name: "Move Lyth up", exact: true }).isEnabled());
  assert.ok(await row("lyth").getByRole("button", { name: "Move Lyth down", exact: true }).isDisabled(), "Cannot cross into another initiative value");
  assert.deepEqual(await verifyBounds("expanded desktop"), originalBounds);
  await row("lyth").getByRole("button", { name: "Move Lyth up", exact: true }).click();
  await expectOrder(["enemy2", "lucas", "lyth", "pete", "enemy3"]);
  let after = await snapshot();
  assert.equal(after.active, "pete", "Moving a tied combatant preserves the current actor");
  assert.deepEqual(after.entries.map(entry => [entry.id, entry.initiative, entry.statuses]).sort(), before.entries.map(entry => [entry.id, entry.initiative, entry.statuses]).sort());
  await combat.getByRole("button", { name: "Undo", exact: true }).click();
  await expectOrder(["enemy2", "lucas", "pete", "lyth", "enemy3"]);
  assert.equal((await snapshot()).active, "pete");
  await row("lyth").getByRole("button", { name: "Move Lyth up", exact: true }).click();
  await row("lyth").getByRole("button", { name: "Move Lyth up", exact: true }).click();
  await expectOrder(["enemy2", "lyth", "lucas", "pete", "enemy3"]);
  assert.ok(await row("lyth").getByRole("button", { name: "Move Lyth up", exact: true }).isDisabled());
  await row("lyth").getByRole("button", { name: "Move Lyth down", exact: true }).click();
  await expectOrder(["enemy2", "lucas", "lyth", "pete", "enemy3"]);
  await row("lyth").getByRole("textbox", { name: "Name", exact: true }).fill("Lyth renamed");
  await row("lyth").getByRole("textbox", { name: "Name", exact: true }).blur();
  await expectOrder(["enemy2", "lucas", "lyth", "pete", "enemy3"]);
  assert.equal(await combat.getByRole("textbox", { name: /agility/i }).count(), 0, "No Agility input or automatic Agility sorting was added");
  await page.reload({ waitUntil: "domcontentloaded" });
  await list.waitFor();
  await expectOrder(["enemy2", "lucas", "lyth", "pete", "enemy3"]);
  after = await snapshot();
  assert.equal(after.active, "pete");
  assert.deepEqual(after.hero, before.hero);
  assert.equal(await row("lyth").locator('[aria-label="Move Lyth renamed up"]').isVisible(), false);
  assert.deepEqual(await verifyBounds("reloaded desktop"), originalBounds);
  await page.setViewportSize({ width: 630, height: 764 });
  await row("lyth").locator("summary").click();
  const narrowBounds = await verifyBounds("expanded narrow preview");
  const persisted = await snapshot();
  assert.deepEqual(persisted.hero, before.hero);
  assert.equal(persisted.active, "pete");
  await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
  assert.ok(await list.evaluate(node => node.scrollTop > 0));
  assert.deepEqual(await verifyBounds("scrolled narrow preview"), narrowBounds);
  assert.deepEqual(errors, []);
  console.log("PASS: bounded Combat scrolling, hidden manual tie controls, Undo, active-turn identity and reload persistence; no stat automation");
  await context.close();
} finally { await browser.close(); }
