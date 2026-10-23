// Focused stat typography/training regression. Fresh browser contexts never use user storage.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const fixture = (await readFile(process.env.CHARACTER_FIXTURE || "C:/Users/shadr/Downloads/luke_sheet.soul", "utf8")).replace(/^\uFEFF/, "");
const browser = await chromium.launch({ headless: true });
const viewports = [{ width: 1595, height: 884 }, { width: 1280, height: 720 }, { width: 827, height: 884 }];
const names = ["Power", "Vitality", "Agility", "Endurance", "Spirit", "Precision", "Willpower", "Charisma"];
const descriptions = ["Physical strength & raw force", "Durability & stamina", "Speed & reflexes", "Resistance to pain & fatigue", "Magical energy & mana", "Accuracy & critical hits", "Mental toughness & focus", "Presence & social ability"];
const results = [];
const errors = [];

function verifyGrid(metrics, label, minHeading = 0, buttonHeight = 20) {
  assert.ok(metrics.length > 0, `${label}: cards exist`);
  for (const card of metrics) {
    assert.ok(card.countLines === 1, `${label}: training count ${card.count} stays on one line`);
    assert.equal(card.countWhiteSpace, "nowrap", `${label}: count cannot wrap`);
    assert.ok(card.headingSize >= minHeading, `${label}: enlarged stat heading`);
    assert.ok(card.spills.length === 0, `${label}: no overlapping or clipped content ${JSON.stringify(card.spills)}`);
    assert.ok(card.labelRight <= card.countLeft - 3, `${label}: training label and count do not collide`);
    assert.ok(Math.abs(card.buttonHeight - buttonHeight) < 1, `${label}: uniform ${buttonHeight}px training controls`);
  }
  const rows = Map.groupBy(metrics, card => Math.round(card.top));
  for (const row of rows.values()) {
    assert.ok(Math.max(...row.map(card => card.height)) - Math.min(...row.map(card => card.height)) < 1, `${label}: equal card heights within each row`);
    assert.ok(Math.max(...row.map(card => card.controlsTop)) - Math.min(...row.map(card => card.controlsTop)) < 1, `${label}: training controls align within each row`);
    assert.ok(Math.max(...row.map(card => card.countTop)) - Math.min(...row.map(card => card.countTop)) < 1, `${label}: training numbers align within each row`);
  }
}

async function gridMetrics(locator) {
  return locator.evaluateAll(cards => cards.map(card => {
    const box = card.getBoundingClientRect();
    const count = card.querySelector('.stat-training-count'), label = card.querySelector('.stat-training-label');
    const heading = card.querySelector('.attribute-stat-name, .stat-input-label');
    const controls = card.querySelector('.stat-training-controls'), buttons = card.querySelector('.stat-training-buttons');
    const countBox = count.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(count);
    const spills = [];
    for (const node of card.querySelectorAll('.attribute-stat-name, .attribute-stat-die, .attribute-stat-roll, .stat-training-count, .stat-training-label, .stat-training-buttons, .stat-training-progress')) {
      if (!node.getClientRects().length) continue;
      const rect = node.getBoundingClientRect();
      if (rect.left < box.left - 1 || rect.right > box.right + 1 || rect.top < box.top - 1 || rect.bottom > box.bottom + 1 || node.scrollWidth > node.clientWidth + 1) spills.push({ text: node.textContent, width: rect.width, scrollWidth: node.scrollWidth, cardWidth: box.width });
    }
    const nameBox = heading.getBoundingClientRect(), dieBox = card.querySelector('.attribute-stat-die')?.getBoundingClientRect();
    if (dieBox && nameBox.right > dieBox.left - 2) spills.push({ text: heading.textContent, reason: 'stat name overlaps die badge' });
    return { top: box.top, height: box.height, count: count.textContent, countTop: countBox.top, countLeft: countBox.left, countLines: new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size, countWhiteSpace: getComputedStyle(count).whiteSpace, labelRight: label.getBoundingClientRect().right, controlsTop: controls.getBoundingClientRect().top, buttonHeight: buttons.querySelector('button').getBoundingClientRect().height, headingSize: parseFloat(getComputedStyle(heading).fontSize), spills };
  }));
}

try {
  for (const viewport of viewports) {
    for (const arrangement of ['original', 'centered']) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:3000/');
      const id = await page.evaluate(async ({ fixture, arrangement }) => {
        const data = JSON.parse(fixture), character = data.character ?? data;
        const { originalLayout, centeredLayout } = await import('/src/lib/workspace-layout.ts');
        const layout = arrangement === 'original' ? originalLayout() : centeredLayout();
        character.uiPreferences = { ...character.uiPreferences, layout, autoScrollRolls: false };
        const { importCharacterJSON } = await import('/src/lib/storage.ts');
        return importCharacterJSON(JSON.stringify(data)).id;
      }, { fixture, arrangement });
      await page.goto(`http://127.0.0.1:3000/characters/${id}`);
      await page.getByRole('tab', { name: 'Stats and Essence', exact: true }).click();
      await page.locator('.attribute-stat-name').first().waitFor();
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const belt = page.locator('[data-frame-id="belt"]');
      const attributes = page.locator('.attribute-stat-section');
      assert.deepEqual(await attributes.locator('.attribute-stat-name').allTextContents(), names);
      const attributeText = await attributes.textContent();
      for (const text of descriptions) assert.ok(!attributeText.includes(text), `Removed description: ${text}`);
      assert.equal(await page.locator('[title]').filter({ hasText: /^$/ }).evaluateAll(nodes => nodes.filter(node => /Physical strength|Durability & stamina|Speed & reflexes/.test(node.title)).length), 0);
      const beltBefore = await belt.boundingBox();
      for (const frame of ['OG Theme', 'Bronze']) {
        await page.evaluate(async frame => { const { applyCardAppearance } = await import('/src/lib/card-appearance.ts'); localStorage.setItem('aetherborne_card_frame_stat_test', frame); applyCardAppearance('stat_test'); }, frame);
        await settle();
        const metrics = await gridMetrics(attributes.locator('.attribute-stat-card'));
        verifyGrid(metrics, `${arrangement} ${viewport.width}×${viewport.height} ${frame}`, 16);
        results.push({ arrangement, viewport: `${viewport.width}×${viewport.height}`, frame, cards: metrics.length, columns: metrics.filter(card => Math.abs(card.top - metrics[0].top) < 1).length });
      }
      const power = attributes.locator('#stat-card-power');
      const oldCount = await power.locator('.stat-training-count').textContent();
      const [training, base] = oldCount.split('/').map(Number);
      const rollCount = () => page.evaluate(async id => { const { storage } = await import('/src/lib/storage.ts'); return storage.getRolls(id).length; }, id);
      const rollsBefore = await rollCount();
      await power.getByRole('button', { name: 'Increase Power training', exact: true }).click();
      await page.waitForFunction(expected => document.querySelector('#stat-card-power .stat-training-count').textContent === expected, training + 1 >= base ? `0/${base + 1}` : `${training + 1}/${base}`);
      await power.getByRole('button', { name: 'Decrease Power training', exact: true }).click();
      await page.waitForFunction(expected => document.querySelector('#stat-card-power .stat-training-count').textContent === expected, oldCount);
      assert.equal(await rollCount(), rollsBefore, 'Training changes do not accidentally roll dice');
      const beltAfter = await belt.boundingBox();
      assert.ok(Math.abs(beltAfter.width - beltBefore.width) < 1 && Math.abs(beltAfter.height - beltBefore.height) < 1, 'Training and appearance changes never resize the Belt');
      if (process.env.STAT_SCREENSHOT_DIR && viewport.width === 1595) {
        await attributes.scrollIntoViewIfNeeded();
        if (arrangement === 'centered') await belt.screenshot({ path: `${process.env.STAT_SCREENSHOT_DIR}/stats-half-width.png` });
        else {
          // A taller explicit full-width saved shape makes every stat visible for the screenshot.
          // This changes only this isolated fixture, not the measured original layout above.
          await page.evaluate(async id => { const { storage } = await import('/src/lib/storage.ts'); const { originalLayout } = await import('/src/lib/workspace-layout.ts'); const character = storage.getCharacter(id); const layout = originalLayout(); layout.groups.belt.height = 4; storage.updateCharacter(id, { uiPreferences: { ...character.uiPreferences, layout } }); }, id);
          await page.reload(); await page.locator('.attribute-stat-name').first().waitFor();
          await page.locator('[data-frame-id="belt"]').screenshot({ path: `${process.env.STAT_SCREENSHOT_DIR}/stats-full-width.png` });
        }
      }
      await page.getByRole('tab', { name: 'Familiars', exact: true }).click();
      const familiarSections = page.locator('.familiar-stat-section');
      await familiarSections.first().waitFor();
      const familiarBeltBefore = await belt.boundingBox();
      for (const section of await familiarSections.all()) {
        assert.equal(await section.locator('.stat-input-label').count(), 8, 'All familiar attribute headers remain present');
        verifyGrid(await gridMetrics(section.locator('.familiar-stat-card')), `Familiar ${arrangement} ${viewport.width}×${viewport.height}`, 12, 16);
      }
      const familiarPower = familiarSections.first().locator('.familiar-stat-card').first();
      const familiarOldCount = await familiarPower.locator('.stat-training-count').textContent();
      const [familiarTraining, familiarBase] = familiarOldCount.split('/').map(Number);
      const familiarRolls = await rollCount();
      await familiarPower.getByRole('button', { name: /^Increase .+ POW training$/ }).click();
      await page.waitForFunction(expected => document.querySelector('.familiar-stat-section .stat-training-count').textContent === expected, familiarTraining + 1 >= familiarBase ? `0/${familiarBase + 1}` : `${familiarTraining + 1}/${familiarBase}`);
      await familiarPower.getByRole('button', { name: /^Decrease .+ POW training$/ }).click();
      await page.waitForFunction(expected => document.querySelector('.familiar-stat-section .stat-training-count').textContent === expected, familiarOldCount);
      assert.equal(await rollCount(), familiarRolls, 'Familiar training controls do not roll dice');
      const familiarBeltAfter = await belt.boundingBox();
      assert.ok(Math.abs(familiarBeltAfter.height - familiarBeltBefore.height) < 1 && Math.abs(familiarBeltAfter.width - familiarBeltBefore.width) < 1, 'Familiar training does not resize the Belt');
      await context.close();
    }
  }
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log(JSON.stringify({ passed: true, cases: results.length, results, errors }));
} finally { await browser.close(); }
