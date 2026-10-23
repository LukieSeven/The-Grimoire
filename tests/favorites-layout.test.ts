import test from "node:test";
import assert from "node:assert/strict";
import { favoritesCapacity } from "../src/lib/favorites-layout.ts";
test("Favorites follow card width before viewport width and keep readable tile widths", () => {
  assert.equal(favoritesCapacity(300, 100, 20, 16).columns, 2);
  assert.equal(favoritesCapacity(1300, 100, 20, 16).columns, 10);
  for (const width of [128, 260, 350, 600, 1400]) {
    const { columns } = favoritesCapacity(width, 100, 20, 16);
    assert.ok((width - (columns - 1) * 12) / columns >= 128);
  }
});

test("wide Favorites retain the original two rows without growing the card", () => {
  const capacity = favoritesCapacity(1400, 114, 20, 16);
  assert.equal(capacity.columns, 10);
  assert.equal(capacity.perPage, 20);
  assert.ok(capacity.tileHeight * 2 + 8 <= 114);
});
test("Favorites use the available grid space without increasing card height", () => {
  for (const height of [94, 200, 600]) {
    const { columns, perPage } = favoritesCapacity(300, height, 20, 16);
    const rows = perPage / columns;
    assert.ok(rows * 72 + (rows - 1) * 12 <= height);
  }
});
test("capacity adapts to page-driven pixel size and larger root fonts without changing assignments", () => {
  assert.ok(favoritesCapacity(600, 200, 20, 16).perPage > favoritesCapacity(300, 100, 20, 16).perPage);
  assert.ok(favoritesCapacity(600, 200, 20, 20).columns < favoritesCapacity(600, 200, 20, 16).columns);
  assert.equal(favoritesCapacity(300, 100, 0, 16).perPage > 0, true);
});
