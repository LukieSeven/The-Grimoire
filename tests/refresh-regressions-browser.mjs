// Focused final-evaluation regressions. Never uses a persistent browser/profile.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = 'http://127.0.0.1:3000';
const latest = JSON.parse(await readFile('tmp/preview-character.soul', 'utf8'));
try {
  const context = await browser.newContext({ viewport: { width: 1595, height: 884 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  const before = await page.evaluate(async latest => {
    const { importCharacterJSON, storage } = await import('/src/lib/storage.ts');
    const { defaultWorkspacePresets } = await import('/src/lib/workspace-presets.ts');
    const other = importCharacterJSON(JSON.stringify({ character: { name: 'Unrelated existing actor', power: 13 } }));
    const layoutPresets = defaultWorkspacePresets();
    const layout = structuredClone(layoutPresets[1].layout);
    layout.rows = 12;
    const uiPreferences = { layout, layoutPresets, localMarker: 'keep personal preferences' };
    const old = structuredClone(latest);
    old.character.name = 'Lucas';
    old.character.power = -77;
    old.character.uiPreferences = uiPreferences;
    const actor = importCharacterJSON(JSON.stringify(old));
    if (actor.id !== 2) throw new Error(`Expected isolated existing Lucas id 2, got ${actor.id}`);
    storage.addRoll({ characterId: actor.id, diceType: 'd6', result: 3, modifier: 0, total: 3, label: 'Existing history survives refresh', isCrit: false, critBonus: null });
    return { uiPreferences, other: storage.getCharacter(other.id), history: storage.getRolls(actor.id), actorId: actor.id };
  }, latest);
  await page.goto(`${base}/characters/2`);
  await page.locator('[data-tool="resources"]').waitFor();
  const refreshed = await page.evaluate(() => ({ characters: JSON.parse(localStorage.getItem('aetherborne_characters')), history: JSON.parse(localStorage.getItem('aetherborne_rolls')), markers: Object.keys(localStorage).filter(key => key.startsWith('grimoire:local-preview-refresh:2:')) }));
  const lucas = refreshed.characters.find(actor => actor.id === 2);
  assert.equal(lucas.power, latest.character.power, 'Development preview bootstrap applies latest supplied character values');
  assert.deepEqual(lucas.uiPreferences, before.uiPreferences, 'Preview refresh preserves exact personal layout, presets and other preferences');
  assert.deepEqual(refreshed.characters.find(actor => actor.id === 1), before.other, 'Preview refresh leaves unrelated character untouched');
  assert.deepEqual(refreshed.history.filter(roll => roll.characterId === 2), before.history, 'Preview refresh preserves existing history');
  assert.equal(refreshed.markers.length, 1, 'Development refresh is marked once for this exact file digest');
  const firstRefreshDate = lucas.updatedAt;
  await page.reload();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('aetherborne_characters')).find(actor => actor.id === 2).updatedAt), firstRefreshDate, 'Reload does not repeatedly reset refreshed character');
  assert.deepEqual(errors, []);
  console.log('PASS: local preview refresh updates supplied character and preserves layouts, history and peers');
  await context.close();

  const checks = await browser.newContext({ viewport: { width: 1595, height: 884 } });
  const test = await checks.newPage();
  const runtimeErrors = [];
  test.on('pageerror', error => runtimeErrors.push(error.message));
  test.on('dialog', dialog => dialog.accept());
  await test.goto(base);
  const id = await test.evaluate(async () => {
    const { importCharacterJSON } = await import('/src/lib/storage.ts');
    const { defaultWorkspacePresets } = await import('/src/lib/workspace-presets.ts');
    const layoutPresets = defaultWorkspacePresets();
    return importCharacterJSON(JSON.stringify({ character: { name: 'Focused regression fixture', rank: 'Iron', power: 8, vitality: 8, spirit: 8, agility: 8, endurance: 8, precision: 8, willpower: 8, charisma: 8, currentHp: 40, currentMana: 70, currentDt: 8, tempMana: 10, manaFormula: 'SPI*20', uiPreferences: { layout: layoutPresets[1].layout, layoutPresets }, favorites: [{ type: 'ability', targetId: 31, label: 'Unaffordable rechargeable' }, { type: 'ability', targetId: 32, label: 'Unaffordable consumable' }, { type: 'weapon', targetId: 5, label: 'Flat-modifier blade' }, ...Array(17).fill(null)] }, equipment: [{ id: 5, name: 'Flat-modifier blade', diceType: 'd6', modifier: 7, equipped: true }], inventory: [{ id: 51, name: 'Limited potion', quantity: 2 }], abilities: [{ id: 31, name: 'Unaffordable rechargeable', cost: 1000, usageType: 'rechargeable', maxCharges: 3, currentCharges: 3, rollFormula: 'd6' }, { id: 32, name: 'Unaffordable consumable', cost: 1000, usageType: 'one-time', inventoryItemId: 51, rollFormula: 'd6' }] })).id;
  });
  await test.goto(`${base}/characters/${id}`);
  await test.locator('.compact-resource-choice:visible').first().waitFor();
  const mana = test.locator('.compact-resource-choice:visible').filter({ has: test.locator('.compact-resource-name', { hasText: 'MP' }) });
  await mana.click();
  for (const [temporary, total] of [[5, 75], [0, 70]]) {
    await test.locator('[data-tool="resources"] .compact-resources:visible').getByPlaceholder('Amount', { exact: true }).fill('5');
    await test.locator('.compact-resources:visible').getByRole('button', { name: 'Use', exact: true }).click();
    await test.waitForFunction(({ id, temporary }) => { const actor = JSON.parse(localStorage.getItem('aetherborne_characters')).find(actor => actor.id === id); return actor.currentMana === 70 && actor.tempMana === temporary; }, { id, temporary });
    await mana.locator('.compact-resource-total').filter({ hasText: String(total) }).waitFor();
    assert.equal(await mana.locator('.compact-resource-total').textContent(), String(total));
  }
  console.log('PASS: repeated temporary mana spending keeps canonical and displayed values synchronized');
  const usageBefore = await test.evaluate(() => ({ abilities: JSON.parse(localStorage.getItem('aetherborne_abilities')), inventory: JSON.parse(localStorage.getItem('aetherborne_inventory')) }));
  await test.locator('[title="Favorite #1: Unaffordable rechargeable"]').click();
  await test.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await test.locator('[title="Favorite #2: Unaffordable consumable"]').click();
  await test.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const usageAfter = await test.evaluate(() => ({ abilities: JSON.parse(localStorage.getItem('aetherborne_abilities')), inventory: JSON.parse(localStorage.getItem('aetherborne_inventory')) }));
  assert.deepEqual(usageAfter, usageBefore, 'Mana failure must not consume legacy charge or inventory quantity');
  console.log('PASS: unaffordable legacy rechargeable and one-time abilities preserve charges/items');

  await test.getByRole('tab', { name: 'Dice', exact: true }).click();
  const dice = test.locator('[data-tool="dice"]');
  for (const [random, expected] of [[0, 20], [0.99999, 120]]) {
    await test.evaluate(random => { Math.random = () => random; }, random);
    await dice.locator('input').fill('20D6');
    await dice.getByRole('button', { name: 'Roll', exact: true }).click();
    await test.waitForFunction(({ id, expected }) => { const rolls = JSON.parse(localStorage.getItem('aetherborne_rolls')).filter(roll => roll.characterId === id); return rolls.at(-1)?.label === 'Custom Roll (20D6)' && rolls.at(-1)?.total === expected; }, { id, expected });
    await test.waitForFunction(expected => { const readout = document.querySelector('[data-tool="dice"] .dice-readout'); return readout?.querySelector('.dice-screen-content') && [...readout.querySelectorAll('span,div')].some(node => node.textContent?.trim() === String(expected)); }, expected);
    const bounds = await dice.locator('.dice-readout').evaluate(node => {
      const frame = node.getBoundingClientRect(), content = node.querySelector('.dice-screen-content').getBoundingClientRect();
      return { expected: null, overflow: content.top < frame.top - 1 || content.bottom > frame.bottom + 1 || content.left < frame.left - 1 || content.right > frame.right + 1, frameHeight: frame.height, contentHeight: content.height };
    });
    if (bounds.overflow) console.warn(`FLAG: ${expected}-point 20D6 content overflows unchanged readout: ${JSON.stringify(bounds)}`);
  }
  console.log('PASS: 20D6 minimum 20 and maximum 120 are consistent in LCD and stored History');
  await test.evaluate(() => { Math.random = () => 0; });
  await test.locator('[title="Favorite #3: Flat-modifier blade"]').click();
  await test.waitForFunction(id => JSON.parse(localStorage.getItem('aetherborne_rolls')).filter(roll => roll.characterId === id).at(-1)?.label === 'Flat-modifier blade Strike', id);
  await test.waitForFunction(() => [...document.querySelectorAll('.dice-readout .dice-screen-content')].some(node => node.textContent?.includes('Flat-modifier blade Strike')));
  const weaponRoll = await test.evaluate(id => JSON.parse(localStorage.getItem('aetherborne_rolls')).filter(roll => roll.characterId === id).at(-1), id);
  assert.equal(weaponRoll.modifier, 7);
  assert.equal(weaponRoll.total, 8);
  assert.match(await test.locator('.dice-readout:visible').textContent(), /\+ 7/);
  assert.equal(await test.locator('.dice-readout:visible .text-6xl').textContent(), '8');
  assert.deepEqual(runtimeErrors, []);
  console.log('PASS: flat weapon modifier is retained in History and LCD');
  await checks.close();
} finally {
  await browser.close();
}
