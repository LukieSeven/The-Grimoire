// Short-preview regression: isolated browser storage never uses user profiles.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const fixture = await readFile(process.env.CHARACTER_FIXTURE || "C:/Users/shadr/Downloads/luke_sheet.soul", "utf8");
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const preset of ["OG Layout", "New Layout"]) {
    const context = await browser.newContext({ viewport: { width: 1595, height: 884 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(45000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
    const id = await page.evaluate(async ({ fixture, preset }) => {
      const bundle = JSON.parse(fixture.replace(/^\uFEFF/, ""));
      const { defaultWorkspacePresets } = await import("/src/lib/workspace-presets.ts");
      bundle.character.uiPreferences = { ...bundle.character.uiPreferences, layout: defaultWorkspacePresets().find(entry => entry.name === preset).layout, autoScrollRolls: false };
      const { importCharacterJSON } = await import("/src/lib/storage.ts");
      return importCharacterJSON(JSON.stringify(bundle)).id;
    }, { fixture, preset });
    await page.goto(`http://127.0.0.1:3000/characters/${id}`, { waitUntil: "domcontentloaded" });
    const frame = page.locator('[data-frame-id="resources"]');
    const resource = frame.locator('[data-tool="resources"]');
    await resource.waitFor();
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await settle();
    const snapshot = () => page.evaluate(async id => {
      const { storage } = await import("/src/lib/storage.ts");
      const actor = storage.getCharacter(id);
      return {
        name: actor.name, rank: actor.rank, hp: actor.currentHp, mana: actor.currentMana, dt: actor.currentDt,
        power: actor.power, vitality: actor.vitality, spirit: actor.spirit, agility: actor.agility,
        endurance: actor.endurance, precision: actor.precision, willpower: actor.willpower, charisma: actor.charisma,
        layout: actor.uiPreferences.layout,
      };
    }, id);
    const before = await snapshot();
    for (const viewport of [{ width: 630, height: 764 }, { width: 1280, height: 720 }, { width: 1595, height: 700 }]) {
      await page.setViewportSize(viewport);
      await settle();
      assert.equal(await frame.locator('.workspace-unavailable').count(), 0, `${preset}: Resources is not replaced by an unavailable warning`);
      assert.ok(await resource.isVisible(), `${preset}: Resources stays visible`);
      assert.equal(await frame.getAttribute('data-height'), '2', 'Saved two-row footprint is retained');
      assert.equal(await frame.getAttribute('data-width'), preset === 'OG Layout' ? '2' : '1', 'Saved card width is retained');
      const input = resource.locator('input[type="number"]:visible').first();
      await input.fill('3');
      assert.equal(await input.inputValue(), '3', 'Visible resource input remains usable');
      await input.fill('');
      assert.ok(await resource.getByRole('button', { name: 'Long Rest', exact: true }).isVisible());
      const measureMetrics = () => frame.evaluate(frame => {
        const box = frame.getBoundingClientRect();
        const content = frame.querySelector('[data-tool="resources"]');
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const row = Math.max(rem * 11.5, (innerHeight - rem * 9) * 1.15 / 4);
        const span = Number(frame.dataset.height);
        const spills = [...content.querySelectorAll('button, input, .resource-actions, .compact-resource-values, .resource-management > div')].filter(node => {
          if (!node.getClientRects().length) return false;
          const bounds = node.getBoundingClientRect();
          return bounds.left < box.left - 1 || bounds.right > box.right + 1 || bounds.top < box.top - 1 || bounds.bottom > box.bottom + 1;
        }).map(node => ({ tag: node.tagName, label: (node.textContent || node.getAttribute('placeholder') || '').trim().slice(0, 50) }));
        const scrollports = [...content.querySelectorAll('div, section')].filter(node => /auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1).map(node => node.className);
        return { height: box.height, expectedHeight: row * span + rem * .85 * (span - 1), spills, scrollports };
      });
      const metrics = await measureMetrics();
      assert.ok(Math.abs(metrics.height - metrics.expectedHeight) < 2, 'Resources retains the existing grid-unit height instead of auto-growing');
      assert.deepEqual(metrics.spills, [], `${preset} ${viewport.width}×${viewport.height}: resource controls stay inside the card`);
      assert.deepEqual(metrics.scrollports, [], 'Resources does not gain its own scroll area');
      assert.deepEqual(await snapshot(), before, 'Viewport resizing does not modify character information or saved layout');
      results.push({ preset, viewport, height: metrics.height });
      if (viewport.width === 1280) {
        await page.getByRole('button', { name: 'Customize Tool', exact: true }).click();
        await page.getByRole('button', { name: 'Customize Layout', exact: true }).click();
        await settle();
        const editingMetrics = await measureMetrics();
        assert.equal(editingMetrics.height, metrics.height, 'The edit header never grows the fixed Resources card');
        assert.deepEqual(editingMetrics.spills, [], `${preset} 1280×720: controls also fit below the edit header`);
        assert.deepEqual(editingMetrics.scrollports, [], 'Editing does not add a Resources scroll area');
        await page.getByRole('region', { name: 'Layout editor', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
        await settle();
        assert.deepEqual(await snapshot(), before, 'Inspecting the draft does not change character information or saved layout');
        results.push({ preset, viewport, editing: true, height: editingMetrics.height });
      }
    }
    assert.deepEqual(errors, [], 'No browser runtime errors');
    await context.close();
  }
  console.log(JSON.stringify({ passed: true, cases: results.length, results }));
} finally { await browser.close(); }
