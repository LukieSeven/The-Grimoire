import type { GridShape, ToolId } from "./workspace-layout.ts";

export interface WorkspaceMetrics { width: number; row: number; columnGap: number; rowGap: number; grid: boolean; rem: number }

/** Only purpose-built, audited detached layouts are selectable. Belt content has its own scroll area. */
export function unavailableLayout(id: ToolId, shape: GridShape, metrics: WorkspaceMetrics): string | undefined {
  const width = metrics.grid ? (metrics.width - 3 * metrics.columnGap) / 4 * shape.width + (shape.width - 1) * metrics.columnGap : metrics.width;
  if (["attributes", "abilities", "skills", "familiar", "inventory", "notes", "settings"].includes(id)) return "A dedicated detached layout is not ready for this tool. Its full content remains available on the Tabbed Belt.";
  // Row tracks already have a responsive minimum. Do not hide a supported
  // saved shape simply because a shorter viewport makes each track smaller.
  if (id === "resources" && shape.height < 2) return "Resources needs at least two rows. Choose a taller size or use the Belt.";
  if (id === "combat" && shape.height < 2) return "The current Combat layout needs at least two rows. A one-row compact design is not ready.";
  if (id === "stats" && shape.height < 2) return "Stats and its dice readout need at least two rows. A readable one-row design is not ready.";
  if (["dice", "history"].includes(id) && shape.height < 2) return "Dice and History need at least two rows for readable controls.";
  if (width < metrics.rem * 16 && id !== "favorites") return "This page is too narrow for the current detached design. Use a wider card or dock the tool on the Belt.";
  return undefined;
}
