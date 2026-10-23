import test from "node:test";
import assert from "node:assert/strict";
import { defaultWorkspacePresets, deleteWorkspacePreset, normalizeDeletedPresetIds, normalizeWorkspacePresets, saveWorkspacePreset } from "../src/lib/workspace-presets.ts";
import { centeredLayout, defaultWorkspaceLayout, originalLayout, normalizeWorkspaceLayout } from "../src/lib/workspace-layout.ts";

test("OG and New are global layout-only defaults independent of the current character", () => {
  const current = centeredLayout();
  current.tools.find(tool => tool.id === "favorites")!.column = 3;
  const presets = normalizeWorkspacePresets(undefined, current);
  assert.deepEqual(presets.map(preset => preset.name), ["OG Layout", "New Layout"]);
  assert.deepEqual(presets[0].layout, defaultWorkspaceLayout());
  assert.deepEqual(presets, defaultWorkspacePresets());
  assert.deepEqual(normalizeWorkspaceLayout(undefined), presets[0].layout);
  assert.deepEqual(presets[0].layout.groups.belt, { width: 4, height: 4, column: 1, row: 4 });
  assert.deepEqual(presets[1].layout.groups.belt, { width: 2, height: 6, column: 2, row: 1 });
  assert.equal(presets[1].layout.tools.find(tool => tool.id === "favorites")!.column, 4);
  current.groups.belt.column = 1;
  assert.equal(presets[1].layout.groups.belt.column, 2);
  presets[0].layout.groups.belt.height = 8;
  assert.equal(defaultWorkspacePresets()[0].layout.groups.belt.height, 4);
});

test("named layouts restore independent snapshots and overwrite by name without duplicates", () => {
  const presets = normalizeWorkspacePresets(undefined, originalLayout());
  const snapshot = centeredLayout(); snapshot.groups.belt.width = 3; snapshot.groups.belt.height = 2;
  const added = saveWorkspacePreset(presets, " My setup ", snapshot);
  assert.equal(added.length, 3); assert.equal(presets.length, 2);
  snapshot.groups.belt.width = 1;
  assert.equal(added[2].layout.groups.belt.width, 3);
  const updated = saveWorkspacePreset(added, "MY SETUP", originalLayout());
  assert.equal(updated.length, 3); assert.equal(updated[2].id, added[2].id);
  assert.deepEqual(normalizeWorkspacePresets(updated, originalLayout()), updated);
  assert.equal(saveWorkspacePreset(updated, " ", snapshot), updated);
});

test("deleting a personal layout removes only that snapshot without changing defaults", () => {
  const defaults = defaultWorkspacePresets();
  const presets = saveWorkspacePreset(defaults, "Combat", centeredLayout());
  const selected = presets.find(preset => preset.name === "Combat")!;
  const result = deleteWorkspacePreset(presets, selected.id);
  assert.deepEqual(result.presets, defaults);
  assert.deepEqual(result.deletedPresetIds, [selected.id]);
  assert.equal(presets.length, 3);
  assert.equal(presets[2], selected);
  assert.deepEqual(defaultWorkspacePresets(), defaults);
  assert.deepEqual(normalizeWorkspacePresets(presets, undefined, result.deletedPresetIds), defaults);
});

test("deleted built-in layouts stay deleted after reload without affecting fresh characters", () => {
  const presets = defaultWorkspacePresets();
  const withoutOg = deleteWorkspacePreset(presets, "og-layout");
  assert.deepEqual(withoutOg.presets.map(preset => preset.id), ["new-layout"]);
  const reloaded = JSON.parse(JSON.stringify(withoutOg));
  assert.deepEqual(normalizeWorkspacePresets(reloaded.presets, undefined, reloaded.deletedPresetIds), withoutOg.presets);
  assert.deepEqual(normalizeWorkspacePresets(undefined, undefined, withoutOg.deletedPresetIds), withoutOg.presets);
  const withoutEither = deleteWorkspacePreset(withoutOg.presets, "new-layout", withoutOg.deletedPresetIds);
  assert.deepEqual(normalizeWorkspacePresets(withoutEither.presets, undefined, withoutEither.deletedPresetIds), []);
  assert.deepEqual(normalizeWorkspacePresets(undefined).map(preset => preset.id), ["og-layout", "new-layout"]);
  assert.deepEqual(defaultWorkspacePresets(), presets);
});

test("unknown deletion IDs do not create tombstones or modify saved layouts", () => {
  const presets = defaultWorkspacePresets();
  const result = deleteWorkspacePreset(presets, "not-a-layout", ["previously-deleted"]);
  assert.equal(result.presets, presets);
  assert.deepEqual(result.deletedPresetIds, ["previously-deleted"]);
  assert.deepEqual(normalizeWorkspacePresets(result.presets, undefined, result.deletedPresetIds), presets);
});

test("deleted layout IDs reject invalid values and remove duplicates", () => {
  assert.deepEqual(normalizeDeletedPresetIds(undefined), []);
  assert.deepEqual(normalizeDeletedPresetIds("og-layout"), []);
  assert.deepEqual(normalizeDeletedPresetIds([null, false, 0, {}, [], "", "   ", "og-layout", "new-layout", "og-layout"]), ["og-layout", "new-layout"]);
  const result = deleteWorkspacePreset(defaultWorkspacePresets(), "og-layout", [null, "og-layout", "og-layout"]);
  assert.deepEqual(result.deletedPresetIds, ["og-layout"]);
});

test("a deleted layout name can be saved again with a fresh identity", () => {
  const deleted = deleteWorkspacePreset(defaultWorkspacePresets(), "og-layout");
  const layout = centeredLayout();
  const saved = saveWorkspacePreset(deleted.presets, "OG Layout", layout);
  const restored = saved.find(preset => preset.name === "OG Layout")!;
  assert.notEqual(restored.id, "og-layout");
  assert.deepEqual(restored.layout, normalizeWorkspaceLayout(layout));
  const normalized = normalizeWorkspacePresets(saved, undefined, deleted.deletedPresetIds);
  assert.deepEqual(normalized, saved);
  assert.equal(normalized.filter(preset => preset.name === "OG Layout").length, 1);
  assert.deepEqual(deleted.deletedPresetIds, ["og-layout"]);
});
