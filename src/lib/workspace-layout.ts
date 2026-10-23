export const TOOL_NAMES = {
  resources: "Resources", combat: "Combat", passive: "Passive", triggers: "Triggers",
  stats: "Stats", dice: "Dice", history: "History", favorites: "Favorites",
  attributes: "Stats and Essence", abilities: "Abilities", skills: "Skills",
  familiar: "Familiars", inventory: "Bag / Gear", notes: "Campaign Notes", settings: "Settings",
} as const;
export type ToolId = keyof typeof TOOL_NAMES;
export type ToolDock = "left" | "center" | "right" | "full" | "belt" | "tracker" | "roller";
export interface GridShape { width: number; height: number; column: number; row: number }
export interface ToolPlacement extends GridShape { id: ToolId; dock: ToolDock; inheritedShape?: true }
export type GroupId = "belt" | "tracker" | "roller";
export const GRID_SIZES = [[1, 2], [2, 1], [2, 2], [2, 4], [1, 4], [4, 1], [4, 4], [1, 1], [1, 3], [3, 1], [2, 3], [3, 2]] as const;
export interface WorkspaceLayout { version: 1; columns?: number; rows?: number; mode: "original" | "columns"; tools: ToolPlacement[]; groups: Record<GroupId, GridShape>; priority?: ToolId | GroupId }
export const TOOL_IDS = Object.keys(TOOL_NAMES) as ToolId[];
export function originalLayout(): WorkspaceLayout {
  return { version: 1, columns: 4, rows: 8, mode: "original", groups: { belt: { width: 4, height: 1, column: 1, row: 4 }, tracker: { width: 1, height: 2, column: 3, row: 1 }, roller: { width: 1, height: 2, column: 4, row: 1 } }, tools: TOOL_IDS.map(id => ({ id, dock: id === "resources" ? "left" : ["combat", "passive", "triggers"].includes(id) ? "tracker" : ["stats", "dice", "history"].includes(id) ? "roller" : id === "favorites" ? "full" : "belt", width: id === "resources" ? 2 : id === "favorites" ? 4 : 1, height: id === "favorites" ? 1 : 2, column: 1, row: id === "favorites" ? 3 : 1 })) };
}
/** Shipped OG arrangement, captured from the saved layout—not character data. */
export function defaultWorkspaceLayout(): WorkspaceLayout {
  const layout = originalLayout();
  return { ...layout, rows: 7, groups: { ...layout.groups, belt: { width: 4, height: 4, column: 1, row: 4 } }, priority: "belt" };
}
export function centeredLayout(): WorkspaceLayout {
  const base = originalLayout();
  return { ...base, mode: "columns", groups: { ...base.groups, belt: { width: 2, height: 4, column: 2, row: 1 } }, tools: base.tools.map(tool => ({ ...tool, dock: tool.id === "resources" || tool.id === "combat" ? "left" : tool.id === "dice" ? "right" : "belt", width: 1, height: tool.id === "dice" ? 4 : 2, column: tool.id === "dice" ? 4 : 1, row: tool.id === "combat" ? 3 : 1 })) };
}
export function normalizeWorkspaceLayout(value: unknown): WorkspaceLayout {
  if (!value || typeof value !== "object") return defaultWorkspaceLayout();
  const candidate = value as Partial<WorkspaceLayout>;
  if (candidate.version !== 1 || !Array.isArray(candidate.tools)) return defaultWorkspaceLayout();
  const columns = Math.min(12, Math.max(4, Math.floor(Number(candidate.columns) || 4)));
  const rows = Math.min(128, Math.max(1, Math.floor(Number(candidate.rows) || 8)));
  const seen = new Set<ToolId>();
  const tools: ToolPlacement[] = [];
  for (const tool of candidate.tools) {
    if (!tool || !TOOL_IDS.includes(tool.id) || seen.has(tool.id)) continue;
    seen.add(tool.id);
    const dock = ["left", "center", "right", "full", "belt", "tracker", "roller"].includes(tool.dock) ? tool.dock : "belt";
    // A tab detached from a flexible Belt keeps that exact footprint. Also
    // preserve valid extended footprints saved before this marker existed.
    const canInherit = ["resources", "combat", "passive", "triggers", "stats", "dice", "history"].includes(tool.id);
    const validFootprint = Number.isInteger(tool.width) && tool.width >= 1 && tool.width <= columns && Number.isInteger(tool.height) && tool.height >= 1 && tool.height <= 128;
    const inheritedShape = canInherit && (tool.inheritedShape === true || validFootprint && !GRID_SIZES.some(([width, height]) => width === tool.width && height === tool.height));
    const flexible = tool.id === "favorites" || inheritedShape;
    const width = flexible || [1, 2, 3, 4].includes(tool.width) ? tool.width : 1;
    tools.push({ id: tool.id, dock: tool.id === "settings" ? "belt" : dock, ...normalizeShape({ ...tool, width }, columns, flexible), ...(inheritedShape ? { inheritedShape: true as const } : {}) });
  }
  for (const tool of originalLayout().tools) if (!seen.has(tool.id)) tools.push(tool);
  const settings = tools.find(tool => tool.id === "settings")!;
  return { version: 1, columns, rows, mode: candidate.mode === "columns" ? "columns" : "original", tools: [...tools.filter(tool => tool.id !== "settings"), settings], groups: Object.fromEntries((["belt", "tracker", "roller"] as const).map(id => [id, normalizeShape(candidate.groups?.[id] ?? originalLayout().groups[id], columns, id === "belt")])) as WorkspaceLayout["groups"], ...(candidate.priority && [...TOOL_IDS, "belt", "tracker", "roller"].includes(candidate.priority) ? { priority: candidate.priority } : {}) };
}

export function normalizeShape(value: Partial<GridShape> | null, columns = 4, flexible = false): GridShape {
  value = value ?? {};
  const size: readonly [number, number] = flexible
    ? [Math.min(columns, Math.max(1, Math.floor(Number(value.width) || 1))), Math.min(128, Math.max(1, Math.floor(Number(value.height) || 2)))]
    : GRID_SIZES.find(([width, height]) => width === value.width && height === value.height) ?? GRID_SIZES.find(([width]) => width === value.width) ?? GRID_SIZES[0];
  const requestedRow = Number(value.row);
  return { width: size[0], height: size[1], column: Math.min(columns + 1 - size[0], Math.max(1, Math.floor(Number(value.column) || 1))), row: Math.min(128 - size[1] + 1, Math.max(1, Number.isFinite(requestedRow) ? Math.floor(requestedRow) : 1)) };
}

// Selected frame is placed first; other cards pack into the next available cells without overlap.
export function gridFrames(layout: WorkspaceLayout): Array<GridShape & { id: ToolId | GroupId; group: boolean }> {
  const frames = [...layout.tools.filter(tool => !["belt", "tracker", "roller"].includes(tool.dock)).map(tool => ({ ...tool, group: false })), ...(["belt", "tracker", "roller"] as const).filter(id => layout.tools.some(tool => tool.dock === id)).map(id => ({ id, ...layout.groups[id], group: true }))];
  const occupied = new Set<string>();
  return frames.sort((a, b) => Number(b.id === layout.priority) - Number(a.id === layout.priority)).map(frame => {
    let column = frame.column, row = frame.row;
    const fits = (x: number, y: number) => Array.from({ length: frame.height }, (_, dy) => Array.from({ length: frame.width }, (_, dx) => !occupied.has(`${x + dx}:${y + dy}`))).flat().every(Boolean);
    if (!fits(column, row)) { row = 1; column = 1; while (!fits(column, row)) { column++; if (column + frame.width > (layout.columns ?? 4) + 1) { column = 1; row++; } } }
    for (let y = row; y < row + frame.height; y++) for (let x = column; x < column + frame.width; x++) occupied.add(`${x}:${y}`);
    return { ...frame, column, row };
  });
}
export function moveWorkspaceTool(layout: WorkspaceLayout, id: ToolId, dock: ToolDock, width?: number): WorkspaceLayout {
  if (id === "settings") return layout;
  const target = width ?? layout.tools.find(tool => tool.id === id)?.width ?? 1;
  const effectiveDock = dock;
  return normalizeWorkspaceLayout({ ...layout, priority: id, mode: effectiveDock === "left" || effectiveDock === "center" || effectiveDock === "right" ? "columns" : layout.mode, tools: layout.tools.map(tool => tool.id === id ? { ...tool, dock: effectiveDock, width: target, column: effectiveDock === "right" ? (layout.columns ?? 4) + 1 - target : effectiveDock === "center" ? Math.min(2, 5 - target) : 1 } : tool) });
}

export type ResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

/** Reading belts and uniform favorite tiles can use every whole-grid shape. */
export function workspaceFrameSizes(id: ToolId | GroupId, layout: WorkspaceLayout): ReadonlyArray<readonly [number, number]> {
  if (id !== "belt" && id !== "favorites" && !layout.tools.find(tool => tool.id === id)?.inheritedShape) return GRID_SIZES;
  const columns = layout.columns ?? 4;
  const rows = Math.min(128, Math.max(layout.rows ?? 8, ...gridFrames(layout).map(frame => frame.row + frame.height - 1)));
  return Array.from({ length: columns * rows }, (_, index) => [index % columns + 1, Math.floor(index / columns) + 1] as const);
}

/** Move inside the available grid while preserving the card's exact shape. */
export function moveGridShape(start: GridShape, columns: number, rows: number, availableRows = 8, availableColumns = 4): GridShape {
  return { width: start.width, height: start.height,
    column: Math.max(1, Math.min(availableColumns + 1 - start.width, start.column + columns)),
    row: Math.max(1, Math.min(Math.max(availableRows, start.row + start.height - 1) - start.height + 1, start.row + rows)),
  };
}

/** Snap a dragged edge to an allowed shape, keeping its opposite edge anchored. */
export function resizeGridShape(start: GridShape, edge: ResizeEdge, columns: number, rows: number, availableColumns = 4, availableRows = 8, sizes: ReadonlyArray<readonly [number, number]> = GRID_SIZES): GridShape {
  const horizontal = edge.includes("e") || edge.includes("w");
  const vertical = edge.includes("n") || edge.includes("s");
  const desiredWidth = start.width + (edge.includes("w") ? -columns : edge.includes("e") ? columns : 0);
  const desiredHeight = start.height + (edge.includes("n") ? -rows : edge.includes("s") ? rows : 0);
  const bottomLimit = Math.max(availableRows + 1, start.row + start.height);
  const candidates = sizes.filter(([width, height]) => (horizontal || width === start.width) && (vertical || height === start.height)).map(([width, height]) => ({
    width, height,
    column: edge.includes("w") ? start.column + start.width - width : start.column,
    row: edge.includes("n") ? start.row + start.height - height : start.row,
  })).filter(shape => shape.column >= 1 && shape.column + shape.width <= availableColumns + 1 && shape.row >= 1 && shape.row + shape.height <= bottomLimit);
  const distance = (shape: GridShape) => (shape.width - desiredWidth) ** 2 + (shape.height - desiredHeight) ** 2;
  return candidates.sort((a, b) => distance(a) - distance(b) || (Math.abs(a.width - start.width) + Math.abs(a.height - start.height)) - (Math.abs(b.width - start.width) + Math.abs(b.height - start.height)))[0] ?? start;
}

export function setWorkspaceFrameShape(layout: WorkspaceLayout, id: ToolId | GroupId, shape: GridShape): WorkspaceLayout {
  if (["belt", "tracker", "roller"].includes(id)) return { ...layout, priority: id, groups: { ...layout.groups, [id]: shape } };
  return { ...layout, priority: id, tools: layout.tools.map(tool => tool.id === id ? { ...tool, ...shape } : tool) };
}

/** Guide cells use the same packed positions as the cards, including overflow rows. */
export function workspaceGridGuides(frames: Array<GridShape>, columns = 4, baseRows = 8): Array<{ column: number; row: number; empty: boolean }> {
  const rows = Math.max(baseRows, ...frames.map(frame => frame.row + frame.height - 1));
  return Array.from({ length: rows * columns }, (_, index) => {
    const column = index % columns + 1, row = Math.floor(index / columns) + 1;
    return { column, row, empty: !frames.some(frame => column >= frame.column && column < frame.column + frame.width && row >= frame.row && row < frame.row + frame.height) };
  });
}

/** Removing space must never change a card's position or dimensions. */
export function gridRemovalReason(layout: WorkspaceLayout, axis: "row" | "column"): string | undefined {
  const frames = gridFrames(layout);
  const rows = Math.max(layout.rows ?? 8, ...frames.map(frame => frame.row + frame.height - 1));
  const columns = layout.columns ?? 4;
  if (axis === "column" && columns <= 4) return "At least four columns are required for the supported card sizes.";
  if (axis === "row" && rows <= 1) return "At least one row is required.";
  if (frames.some(frame => axis === "row" ? frame.row + frame.height - 1 >= rows : frame.column + frame.width - 1 >= columns)) return `Move cards out of the ${axis === "row" ? "bottom row" : "rightmost column"} first.`;
  if (axis === "column") {
    const next = gridFrames({ ...layout, columns: columns - 1 });
    if (next.some((frame, index) => frame.column !== frames[index].column || frame.row !== frames[index].row)) return "Removing this column would rearrange cards. Move them clear first.";
  }
  return undefined;
}

export function removeGridTrack(layout: WorkspaceLayout, axis: "row" | "column"): WorkspaceLayout {
  if (gridRemovalReason(layout, axis)) return layout;
  return axis === "column" ? { ...layout, columns: (layout.columns ?? 4) - 1 } : { ...layout, rows: Math.max(layout.rows ?? 8, ...gridFrames(layout).map(frame => frame.row + frame.height - 1)) - 1 };
}
