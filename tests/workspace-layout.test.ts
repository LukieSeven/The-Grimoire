import test from "node:test";
import assert from "node:assert/strict";
import { gridRemovalReason, removeGridTrack } from "../src/lib/workspace-layout.ts";
import { workspaceFrameSizes } from "../src/lib/workspace-layout.ts";
import { originalLayout, defaultWorkspaceLayout, centeredLayout, normalizeWorkspaceLayout, moveWorkspaceTool, gridFrames, GRID_SIZES, normalizeShape, TOOL_IDS, resizeGridShape, moveGridShape, setWorkspaceFrameShape, workspaceGridGuides, type ResizeEdge } from "../src/lib/workspace-layout.ts";

test("grid expansion persists without changing existing card shapes or positions", () => {
  const original = originalLayout();
  assert.equal(original.rows, 8); assert.equal(original.columns, 4);
  const expanded = normalizeWorkspaceLayout({ ...original, columns: 6, rows: 10 });
  assert.deepEqual(expanded.tools, original.tools);
  assert.deepEqual(expanded.groups, original.groups);
  assert.equal(expanded.rows, 10); assert.equal(expanded.columns, 6);
  const shape = moveGridShape({ width: 1, height: 2, column: 4, row: 1 }, 2, 7, 10, 6);
  assert.equal(shape.column, 6); assert.equal(shape.row, 8);
  const moved = normalizeWorkspaceLayout(setWorkspaceFrameShape(expanded, "resources", shape));
  assert.equal(moved.tools.find(tool => tool.id === "resources")?.column, 6);
  assert.equal(workspaceGridGuides(gridFrames(moved), 6, 10).length, 60);
  const legacy = { ...original }; delete legacy.rows; delete legacy.columns;
  assert.equal(normalizeWorkspaceLayout(legacy).rows, 8);
});

test("Belt and Favorites support whole-grid custom sizes beyond four cells", () => {
  const layout = { ...originalLayout(), columns: 6, rows: 10 };
  for (const id of ["belt", "favorites"] as const) {
    const sizes = workspaceFrameSizes(id, layout);
    assert.equal(sizes.length, 60);
    const shape = resizeGridShape({ width: 2, height: 4, row: 1, column: 1 }, "se", 3, 3, 6, 10, sizes);
    assert.deepEqual(shape, { width: 5, height: 7, row: 1, column: 1 });
    const restored = normalizeWorkspaceLayout(setWorkspaceFrameShape(layout, id, shape));
    const savedShape = id === "belt" ? restored.groups.belt : restored.tools.find(tool => tool.id === id)!;
    assert.equal(savedShape.width, 5); assert.equal(savedShape.height, 7);
    assert.equal(resizeGridShape(shape, "s", 0, -2, 6, 10, sizes).height, 5);
    assert.equal(moveGridShape(shape, 1, 2, 10, 6).height, 7);
  }
  assert.equal(workspaceFrameSizes("resources", layout), GRID_SIZES, "Other cards retain their dedicated layouts");
});

test("tabs detached at a flexible Belt footprint retain their exact dimensions after reload", () => {
  const layout = { ...originalLayout(), columns: 6, rows: 10 };
  for (const [width, height] of [[2, 6], [5, 4], [5, 7]]) {
    const detached = { ...layout, tools: layout.tools.map(tool => tool.id === "dice" ? { ...tool, dock: "left" as const, width, height, column: 1, row: 1, inheritedShape: true as const } : tool) };
    const restored = normalizeWorkspaceLayout(JSON.parse(JSON.stringify(detached)));
    const tool = restored.tools.find(tool => tool.id === "dice")!;
    assert.equal(tool.width, width); assert.equal(tool.height, height);
    assert.equal(tool.inheritedShape, true);
    assert.deepEqual(normalizeWorkspaceLayout(restored), restored, "Inherited footprints are normalization-stable");
    const resized = resizeGridShape(tool, "e", -1, 0, 6, 10, workspaceFrameSizes("dice", restored));
    assert.equal(resized.width, width - 1); assert.equal(resized.height, height, "An inherited edge resize does not alter the other axis");
  }
});

test("valid extended footprints saved before inherited-shape metadata are preserved", () => {
  const layout = originalLayout();
  const legacy = { ...layout, tools: layout.tools.map(tool => tool.id === "history" ? { ...tool, dock: "left" as const, width: 2, height: 6 } : tool) };
  const restored = normalizeWorkspaceLayout(legacy).tools.find(tool => tool.id === "history")!;
  assert.equal(restored.width, 2); assert.equal(restored.height, 6);
  assert.equal(restored.inheritedShape, true);
  assert.equal(workspaceFrameSizes("resources", normalizeWorkspaceLayout(legacy)), GRID_SIZES, "Unchanged tools do not acquire flexible sizing");
});

test("only empty outer tracks can be removed, and smaller row counts persist", () => {
  const original = originalLayout();
  assert.ok(gridRemovalReason(original, "column"));
  assert.equal(removeGridTrack(original, "column"), original);
  const expanded = { ...original, columns: 5, rows: 9 };
  const reduced = removeGridTrack(removeGridTrack(expanded, "column"), "row");
  assert.deepEqual(reduced, original);
  let compact = original;
  for (let i = 0; i < 4; i++) compact = removeGridTrack(compact, "row");
  assert.equal(compact.rows, 4);
  assert.equal(normalizeWorkspaceLayout(compact).rows, 4);
  assert.ok(gridRemovalReason(compact, "row"));
  assert.equal(removeGridTrack(compact, "row"), compact);
  assert.deepEqual(gridFrames(compact), gridFrames(original));
  const occupied = setWorkspaceFrameShape(expanded, "resources", { width: 1, height: 2, column: 5, row: 8 });
  assert.ok(gridRemovalReason(occupied, "column"));
  assert.ok(gridRemovalReason(occupied, "row"));
});
test("layout defaults preserve every tool once and Settings last on the belt", () => {
  for (const layout of [originalLayout(), centeredLayout(), normalizeWorkspaceLayout(null)]) {
    assert.equal(new Set(layout.tools.map(tool => tool.id)).size, TOOL_IDS.length);
    assert.equal(layout.tools.at(-1)?.id, "settings");
    assert.equal(layout.tools.at(-1)?.dock, "belt");
  }
});
test("malformed and duplicate preferences are normalized without losing tools", () => {
  const layout = normalizeWorkspaceLayout({ version: 1, tools: [{ id: "dice", width: 9, height: 0, row: -2 }, { id: "dice" }, null, { id: "unknown" }, { id: "settings", dock: "right" }] });
  assert.equal(layout.tools.length, TOOL_IDS.length);
  assert.equal(layout.tools.at(-1)?.dock, "belt");
  assert.deepEqual(normalizeWorkspaceLayout({ version: 99 }), defaultWorkspaceLayout());
});
test("all supported shapes stay within the four-column grid", () => {
  for (const [width, height] of GRID_SIZES) {
    const shape = normalizeShape({ width, height, row: 4, column: 4 });
    assert.equal(shape.width, width); assert.equal(shape.height, height);
    assert.ok(shape.column + width <= 5); assert.ok(shape.row >= 1);
  }
});
test("presets fit the initial four-by-four grid with no overlapping cells", () => {
  for (const layout of [originalLayout(), centeredLayout()]) {
    const cells = new Set<string>();
    for (const frame of gridFrames(layout)) {
      assert.ok(frame.row + frame.height <= 5);
      for (let x = frame.column; x < frame.column + frame.width; x++) for (let y = frame.row; y < frame.row + frame.height; y++) { const key = `${x}:${y}`; assert.ok(!cells.has(key)); cells.add(key); }
    }
  }
});
test("docking is immutable, does not duplicate tools, and cannot detach Settings", () => {
  const original = originalLayout();
  const moved = moveWorkspaceTool(original, "combat", "belt");
  assert.equal(moved.tools.find(tool => tool.id === "combat")?.dock, "belt");
  assert.equal(original.tools.find(tool => tool.id === "combat")?.dock, "tracker");
  assert.equal(moved.tools.length, original.tools.length);
  assert.equal(moveWorkspaceTool(original, "settings", "right"), original);
  assert.deepEqual(normalizeWorkspaceLayout(JSON.parse(JSON.stringify(moved))), moved);
});
test("moving to a side uses that column, and resized cards take priority without collisions", () => {
  const right = moveWorkspaceTool(centeredLayout(), "resources", "right", 1);
  assert.equal(gridFrames(right).find(frame => frame.id === "resources")?.column, 4);
  for (const [width, height] of GRID_SIZES) {
    const layout = { ...right, tools: right.tools.map(tool => tool.id === "resources" ? { ...tool, ...normalizeShape({ width, height, column: 1, row: 1 }) } : tool) };
    const frames = gridFrames(layout), cells = new Set<string>();
    for (const frame of frames) for (let x = frame.column; x < frame.column + frame.width; x++) for (let y = frame.row; y < frame.row + frame.height; y++) { const cell = `${x}:${y}`; assert.ok(!cells.has(cell)); cells.add(cell); }
  }
});

test("edge dragging changes only its own axis and anchors the opposite edge", () => {
  const start = { width: 2, height: 2, column: 2, row: 2 } as const;
  assert.deepEqual(resizeGridShape(start, "e", -1, 3), { ...start, width: 1 });
  assert.deepEqual(resizeGridShape(start, "w", 1, 3), { ...start, width: 1, column: 3 });
  assert.deepEqual(resizeGridShape(start, "n", 3, 1), { ...start, height: 1, row: 3 });
  assert.deepEqual(resizeGridShape(start, "s", 3, -1), { ...start, height: 1 });
  assert.deepEqual(resizeGridShape(start, "nw", 1, 1), { width: 1, height: 1, column: 3, row: 3 }, "1×1 is an allowed minimum shape");
});

test("all eight handles stay in bounds and snap to allowed sizes", () => {
  for (const [width, height] of GRID_SIZES) for (const edge of ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as ResizeEdge[]) for (const dx of [-10, -1, 0, 1, 10]) for (const dy of [-10, -1, 0, 1, 10]) {
    const start = { width, height, column: 1, row: 1 };
    const next = resizeGridShape(start, edge, dx, dy);
    assert.ok(GRID_SIZES.some(([w, h]) => w === next.width && h === next.height));
    assert.ok(next.column >= 1 && next.column + next.width <= 5);
    assert.ok(next.row >= 1 && next.row + next.height <= 5);
    if (edge.includes("w")) assert.equal(next.column + next.width, start.column + start.width);
    if (edge.includes("n")) assert.equal(next.row + next.height, start.row + start.height);
  }
});

test("corner resizing supports every requested shape and group changes stay immutable", () => {
  const start = { width: 2, height: 2, column: 1, row: 1 } as const;
  for (const [width, height] of GRID_SIZES) assert.deepEqual(resizeGridShape(start, "se", width - 2, height - 2), { ...start, width, height });
  const layout = originalLayout(), next = setWorkspaceFrameShape(layout, "belt", { width: 2, height: 4, column: 2, row: 1 });
  assert.equal(next.groups.belt.width, 2); assert.equal(layout.groups.belt.width, 4);
  assert.equal(next.priority, "belt"); assert.equal(next.tools, layout.tools);
});

test("empty-cell guides exactly match packed card occupancy, including extended rows", () => {
  const frames = [{ width: 2, height: 2, column: 1, row: 1 }, { width: 1, height: 2, column: 4, row: 5 }] as const;
  const guides = workspaceGridGuides([...frames]);
  assert.equal(guides.length, 32); assert.equal(guides.filter(cell => !cell.empty).length, 6);
  assert.equal(guides.find(cell => cell.column === 3 && cell.row === 1)?.empty, true);
  assert.equal(workspaceGridGuides(gridFrames(originalLayout())).filter(cell => cell.empty).length, 16);
});

test("header movement preserves dimensions and stays inside the available grid", () => {
  for (const [width, height] of GRID_SIZES) for (const dx of [-20, -1, 0, 1, 20]) for (const dy of [-20, -1, 0, 1, 20]) {
    const moved = moveGridShape({ width, height, column: 1, row: 1 }, dx, dy, 8);
    assert.equal(moved.width, width); assert.equal(moved.height, height);
    assert.ok(moved.column >= 1 && moved.column + width <= 5);
    assert.ok(moved.row >= 1 && moved.row + height <= 9);
  }
});
test("positions in rollover rows survive layout save normalization", () => {
  const layout = setWorkspaceFrameShape(originalLayout(), "resources", { width: 2, height: 2, column: 2, row: 6 });
  assert.equal(normalizeWorkspaceLayout(layout).tools.find(tool => tool.id === "resources")?.row, 6);
});
