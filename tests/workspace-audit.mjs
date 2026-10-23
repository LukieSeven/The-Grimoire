// Read-only-to-user-data visual geometry audit in a fresh isolated browser context.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(12000);
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://127.0.0.1:3000/");
  const fixture = process.env.CHARACTER_FIXTURE ? (await readFile(process.env.CHARACTER_FIXTURE, "utf8")).replace(/^\uFEFF/, "") : JSON.stringify({ character: { name: "Layout audit", rank: "Iron" } });
  const id = await page.evaluate(async fixture => {
    const { importCharacterJSON } = await import("/src/lib/storage.ts");
    const model = await import("/src/lib/workspace-layout.ts");
    const data = JSON.parse(fixture);
    const character = data.character ?? data;
    character.uiPreferences = { ...character.uiPreferences, layout: model.originalLayout(), layoutPresets: model.TOOL_IDS.flatMap(tool => model.GRID_SIZES.map(([width, height]) => {
      const layout = model.originalLayout();
      if (tool === "settings") layout.groups.belt = { width, height, row: 1, column: 1 };
      else layout.tools = layout.tools.map(entry => entry.id === tool ? { ...entry, dock: "left", width, height, row: 1, column: 1 } : entry);
      layout.priority = tool === "settings" ? "belt" : tool;
      return { id: `audit-${tool}-${width}x${height}`, name: `Audit ${tool} ${width}x${height}`, layout };
    })) };
    return importCharacterJSON(JSON.stringify(data)).id;
  }, fixture);
  page.on("dialog", dialog => dialog.accept());
  await page.goto(`http://127.0.0.1:3000/characters/${id}`);
  await page.getByRole("button", { name: "Customize Tool", exact: true }).click();
  await page.getByRole("button", { name: "Customize Layout", exact: true }).click();
  const editor = page.getByRole("region", { name: "Layout editor" });
  const { TOOL_IDS, GRID_SIZES } = await page.evaluate(async () => { const model = await import("/src/lib/workspace-layout.ts"); return { TOOL_IDS: model.TOOL_IDS, GRID_SIZES: model.GRID_SIZES }; });
  const cases = [];
  for (const viewport of [{ width: 1595, height: 884 }, { width: 1280, height: 720 }, { width: 827, height: 884 }]) {
    await page.setViewportSize(viewport);
    for (const tool of TOOL_IDS) {
      for (const [width, height] of GRID_SIZES) {
        await editor.getByRole("group", { name: "Saved layouts" }).getByRole("button", { name: `Audit ${tool} ${width}x${height}`, exact: true }).dispatchEvent("click");
        if (tool === "settings") await page.getByRole("tab", { name: "Settings", exact: true }).dispatchEvent("click");
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const metrics = await page.evaluate(({ tool, frameId }) => {
          const frame = document.querySelector(`[data-frame-id="${frameId}"]`), content = frame?.querySelector(`[data-tool="${tool}"]`);
          if (frame?.querySelector('.workspace-unavailable')) return { unavailable: true };
          if (!frame || !content) return { missing: true };
          const bounds = frame.getBoundingClientRect();
          const out = [];
          for (const node of [content, ...content.querySelectorAll("*")]) {
            if (!node.getClientRects().length || node.closest("[data-belt-scroll]")) continue;
            const exception = node.closest("[data-tracker-scroll], [data-history-scroll]"); if (exception && exception !== node) continue;
            const rect = node.getBoundingClientRect(); if (!rect.width || !rect.height) continue;
            const bottom = rect.bottom - bounds.bottom, right = rect.right - bounds.right;
            if (bottom > 2 || right > 2) out.push({ node: node.tagName, label: (node.getAttribute("aria-label") || node.textContent || "").trim().slice(0, 45), bottom: Math.round(bottom), right: Math.round(right) });
          }
          return { bottom: Math.max(0, ...out.map(item => item.bottom)), right: Math.max(0, ...out.map(item => item.right)), samples: out.sort((a, b) => b.bottom - a.bottom).slice(0, 3) };
        }, { tool, frameId: tool === "settings" ? "belt" : tool });
        cases.push({ tool, size: `${width}x${height}`, viewport: `${viewport.width}x${viewport.height}`, ...metrics });
      }
    }
    console.log(`Completed viewport ${viewport.width}×${viewport.height}`);
  }
  const summary = TOOL_IDS.map(tool => { const subset = cases.filter(item => item.tool === tool); return { tool, checked: subset.length, fitting: subset.filter(item => !item.unavailable && !item.missing && !item.bottom && !item.right).length, failures: subset.filter(item => item.bottom || item.right || item.missing).map(({ size, viewport, bottom, right }) => ({ size, viewport, bottom, right })) }; });
  if (process.env.AUDIT_REPORT) await writeFile(process.env.AUDIT_REPORT, JSON.stringify({ summary, errors, cases }, null, 2));
  console.log(JSON.stringify({ checked: cases.length, unavailable: cases.filter(item => item.unavailable).length, fitting: cases.filter(item => !item.unavailable && !item.missing && !item.bottom && !item.right).length, summary: summary.map(item => ({ tool: item.tool, checked: item.checked, fitting: item.fitting, worst: cases.filter(entry => entry.tool === item.tool).sort((a, b) => (b.bottom ?? 0) - (a.bottom ?? 0))[0] })), errors }));
} finally { await browser.close(); }
