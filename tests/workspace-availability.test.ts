import test from "node:test";
import assert from "node:assert/strict";
import { unavailableLayout } from "../src/lib/workspace-availability.ts";
import { GRID_SIZES, type ToolId } from "../src/lib/workspace-layout.ts";

const metrics = { width: 1200, row: 200, columnGap: 12, rowGap: 12, grid: true, rem: 16 };
const shape = { width: 1 as const, height: 2 as const, column: 1, row: 1 };
test("unfinished detached forms stay unavailable at every size", () => {
  for (const id of ["attributes", "abilities", "skills", "familiar", "inventory", "notes", "settings"] as ToolId[]) {
    for (const [width, height] of GRID_SIZES) assert.ok(unavailableLayout(id, { ...shape, width, height }, metrics));
  }
});
test("compact designs require sufficient fixed space without changing dimensions", () => {
  assert.equal(unavailableLayout("resources", shape, metrics), undefined);
  assert.ok(unavailableLayout("resources", { ...shape, height: 1 }, metrics));
  assert.ok(unavailableLayout("resources", shape, { ...metrics, row: 160 }));
  assert.ok(unavailableLayout("combat", { ...shape, height: 1 }, metrics));
  assert.equal(unavailableLayout("dice", shape, metrics), undefined);
  assert.equal(unavailableLayout("history", shape, metrics), undefined);
  assert.ok(unavailableLayout("dice", { ...shape, height: 1 }, metrics));
  assert.equal(unavailableLayout("dice", { ...shape, height: 4 }, metrics), undefined);
  assert.deepEqual(shape, { width: 1, height: 2, column: 1, row: 1 });
});
test("audited compact readers and favorites remain available", () => {
  for (const id of ["passive", "triggers", "stats", "favorites"] as ToolId[]) {
    for (const [width, height] of GRID_SIZES) {
      const reason = unavailableLayout(id, { ...shape, width, height }, metrics);
      if (id === "stats" && height === 1) assert.ok(reason, "Stats reserves room for its restored readout");
      else assert.equal(reason, undefined);
    }
  }
});
