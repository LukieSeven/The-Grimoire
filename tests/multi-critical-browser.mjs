// Deterministic shared-critical regression; isolated storage, never user profiles.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1595, height: 884 } });
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(45000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
  const id = await page.evaluate(async () => {
    const { importCharacterJSON } = await import("/src/lib/storage.ts");
    return importCharacterJSON(JSON.stringify({ character: {
      name: "Critical queue check", rank: "Bronze", power: 25,
      uiPreferences: { autoScrollRolls: false },
      familiars: [{ id: 42, name: "Critical familiar", race: "Creature", className: "Iron", power: 25, vitality: 6,
        agility: 6, endurance: 6, spirit: 6, precision: 6, willpower: 6, charisma: 6,
        currentHp: 48, currentMana: 30, currentDt: 6, speed: 30, dtBonus: 0,
        hpFormula: "VIT*8", manaFormula: "SPI*5", dtFormula: "END", speedFormula: "AGI*5",
        abilities: [{ id: 91, name: "Dual critical", cost: 0, type: "Attack", range: "Self", speed: "Action", rollFormula: "D4+D12" }] }],
    } })).id;
  });
  await page.goto(`http://127.0.0.1:3000/characters/${id}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Dice", exact: true }).click();
  const screen = page.getByRole("region", { name: "Dice readout", exact: true });
  const frame = page.locator('[data-frame-id="roller"]');
  const originalBounds = await frame.boundingBox();
  const queue = samples => page.evaluate(samples => {
    let index = 0;
    Math.random = () => {
      const sample = samples[index++];
      if (!sample) throw new Error("Unexpected additional die roll");
      return (sample[0] - .5) / sample[1];
    };
  }, samples);
  const heading = text => screen.locator("p").filter({ hasText: text }).waitFor();
  const next = async text => {
    await screen.getByRole("button", { name: "One More!", exact: true }).click();
    if (text) await heading(text);
    else await screen.getByRole("button", { name: "One More!", exact: true }).waitFor({ state: "detached" });
  };
  const custom = async (formula, samples, initial) => {
    await page.getByPlaceholder("e.g. 2d6 + POWr*3").fill(formula);
    await queue(samples);
    await page.locator('[data-tool="dice"]').getByRole("button", { name: "Roll", exact: true }).click();
    await heading(initial);
  };
  const total = () => screen.locator(".text-6xl").textContent().then(Number);
  await custom("3D6+5", [[6,6],[6,6],[6,6],[6,6],[2,6],[1,6],[6,6],[6,6],[3,6]], "Common Crit 1/3");
  await next("Uncommon Crit 1/3");
  await next("Common Crit 2/3");
  await next("Common Crit 3/3");
  await next("Uncommon Crit 3/3");
  await next("Rare Crit 3/3");
  await next();
  assert.equal(await total(), 47, "All three independent chains contribute; the flat bonus appears once");
  assert.match(await screen.textContent(), /Rare Critical/);
  const records = await page.evaluate(async id => {
    const { storage } = await import("/src/lib/storage.ts");
    return storage.getRolls(id).sort((a, b) => a.id - b.id);
  }, id);
  assert.equal(records[0].criticalDice.length, 3, "Initial critical count is persisted");
  assert.deepEqual(records.slice(1).map(roll => roll.result), [6,2,1,6,6,3]);
  console.log("PASS: three criticals resolve sequentially, independently and repeatedly");

  await custom("D4+D12", [[4,4],[12,12],[3,4],[12,12],[5,12]], "Common Crit 1/2");
  await next("Common Crit 2/2");
  await next("Uncommon Crit 2/2");
  await next();
  assert.equal(await total(), 36, "Mixed die criticals retain D4 and D12, not the formula's final die only");
  console.log("PASS: mixed critical dice retain their own sides");

  const expectedModifier = await page.evaluate(async id => {
    const { storage, getModifierForStat } = await import("/src/lib/storage.ts");
    return getModifierForStat(25, storage.getCharacter(id).rank);
  }, id);
  await page.getByRole("tab", { name: "Stats", exact: true }).first().click();
  await queue([[20,20],[5,6],[7,20],[5,6],[2,6]]);
  await page.locator('[data-tool="stats"] button').filter({ hasText: /POW/ }).first().click();
  await heading("Common Crit 1/2");
  await next("Common Crit 2/2");
  await next("Uncommon Crit 2/2");
  await next();
  assert.equal(await total(), 39 + expectedModifier, "Multi-die stats reroll only their critical die, preserving caps and one modifier");
  console.log("PASS: multi-die stat criticals keep their individual critical targets");

  await page.getByRole("tab", { name: "Familiars", exact: true }).click();
  const familiar = page.locator('[id="familiar-card-42"]');
  const familiarModifier = await page.evaluate(async () => {
    const { getModifierForStat } = await import("/src/lib/storage.ts");
    return getModifierForStat(25, "Iron");
  });
  await queue([[20,20],[5,6],[7,20],[2,6]]);
  await familiar.getByRole("button", { name: "Roll Critical familiar POW", exact: true }).click();
  await heading("Common Crit 1/2");
  await next("Common Crit 2/2");
  await next();
  assert.equal(await total(), 34 + familiarModifier, "Familiar stat criticals retain creature rank and modifier");
  await familiar.getByRole("tab", { name: /^Abilities/ }).click();
  await queue([[4,4],[12,12],[2,4],[3,12]]);
  await familiar.getByRole("button", { name: "Activate", exact: true }).click();
  await heading("Common Crit 1/2");
  await next("Common Crit 2/2");
  await next();
  assert.equal(await total(), 21, "Familiar abilities use the same independent critical queue");
  const history = await page.evaluate(async id => {
    const { storage } = await import("/src/lib/storage.ts");
    return storage.getRolls(id).filter(roll => roll.label === "Fam: Dual critical Cast");
  }, id);
  assert.ok(history.every(roll => roll.familiarId === 42));
  const finalBounds = await frame.boundingBox();
  assert.equal(finalBounds.width, originalBounds.width);
  assert.equal(finalBounds.height, originalBounds.height);
  assert.deepEqual(errors, []);
  console.log("PASS: familiar stats/abilities, History ownership and fixed card geometry");
} finally { await browser.close(); }
