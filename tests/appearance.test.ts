import test from "node:test";
import assert from "node:assert/strict";
import { applyFontAppearance } from "../src/lib/font-appearance.ts";
import { applyCardAppearance, CARD_FRAMES } from "../src/lib/card-appearance.ts";
import { applyTexture, TEXTURES } from "../src/lib/appearance.ts";

function environment(saved: Record<string, string> = {}) {
  const properties: Record<string, string> = {};
  const dataset: Record<string, string> = {};
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => saved[key] ?? null } });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { dataset, style: { setProperty: (key: string, value: string) => { properties[key] = value; } } } } });
  return { properties, dataset };
}

test("Classic restores the original font stack and keeps numbers readable", () => {
  const env = environment(); applyFontAppearance("grimoire");
  assert.equal(env.properties["--app-font-serif"], "'Cinzel', 'Spectral', Georgia, serif");
  assert.equal(env.properties["--app-font-mono"], "'Space Mono', monospace");
  assert.equal(env.properties["--background"], undefined);
});

test("each card frame restores independently without overriding theme colors", () => {
  for (const name of CARD_FRAMES) {
    const env = environment({ aetherborne_card_frame_grimoire: name }); applyCardAppearance("grimoire");
    assert.equal(env.dataset.cardFrame, name);
    assert.equal(env.properties["--background"], undefined);
    assert.equal(env.properties["--card"], undefined);
    assert.equal(env.properties["--surface-texture"], undefined);
  }
});

test("texture choices restore the page layer only and preserve theme colors", () => {
  for (const name of TEXTURES) {
    const env = environment({ aetherborne_texture_grimoire: name, aetherborne_texture_intensity_grimoire: "65" }); applyTexture("grimoire");
    assert.equal(env.dataset.texture, name);
    assert.equal(env.properties["--texture-opacity"], "0.65");
    assert.equal(env.properties["--background"], undefined);
    assert.equal(env.properties["--card"], undefined);
    assert.equal(env.properties["--surface-texture"] === "none", name === "None");
  }
});
