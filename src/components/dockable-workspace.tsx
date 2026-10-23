import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useRef, type ReactNode, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { GRID_SIZES, workspaceFrameSizes, gridRemovalReason, removeGridTrack, TOOL_NAMES, TOOL_IDS, normalizeWorkspaceLayout, type ToolId, type ToolDock, type WorkspaceLayout, gridFrames, type GridShape, type GroupId, resizeGridShape, moveGridShape, setWorkspaceFrameShape, workspaceGridGuides, type ResizeEdge } from "../lib/workspace-layout";
import { Button } from "./ui/button";
import { normalizeWorkspacePresets, normalizeDeletedPresetIds, deleteWorkspacePreset, saveWorkspacePreset, type WorkspacePreset } from "../lib/workspace-presets";
import { Input } from "./ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { unavailableLayout, type WorkspaceMetrics } from "../lib/workspace-availability";

type Workspace = {
  layout: WorkspaceLayout; editing: boolean; begin: () => void;
  register: (id: ToolId, node: HTMLDivElement | null) => void;
  targets: Partial<Record<ToolId, HTMLDivElement>>;
  selected: ToolId | GroupId;
  selectFrame: (id: ToolId | GroupId) => void;
  resizeFrame: (id: ToolId | GroupId, shape: GridShape) => void;
  restoreDraft: (layout: WorkspaceLayout) => void;
  unavailable: (id: ToolId, shape: GridShape) => string | undefined;
  measureGrid: (node: HTMLDivElement) => void;
  dockFrame: (id: ToolId | GroupId, dock: "belt" | "left", shape?: GridShape) => void;
};
const Context = createContext<Workspace | null>(null);
export const useWorkspace = () => useContext(Context);
export function revealWorkspaceTool(id: ToolId) { window.dispatchEvent(new CustomEvent("grimoire:reveal-tool", { detail: id })); }

function sameLayout(first: WorkspaceLayout, second: WorkspaceLayout) {
  return JSON.stringify(normalizeWorkspaceLayout(first)) === JSON.stringify(normalizeWorkspaceLayout(second));
}
function matchingPreset(presets: WorkspacePreset[], layout: WorkspaceLayout, preferred?: string) {
  const matches = (preset: WorkspacePreset) => sameLayout(preset.layout, layout);
  return presets.find(preset => preset.id === preferred && matches(preset))?.id ?? presets.find(matches)?.id;
}

// Responsive cards stack visually, but gestures still edit their whole-grid
// footprint. A stacked flex layout has no computed gridTemplateRows to read.
function gestureSteps(grid: Element, layout: WorkspaceLayout) {
  const style = getComputedStyle(grid);
  const gapX = parseFloat(style.columnGap) || 0, gapY = parseFloat(style.rowGap) || 0;
  const frame = grid.querySelector<HTMLElement>(".workspace-grid-cell");
  const span = Number(frame?.dataset.height) || 1;
  const row = parseFloat(style.gridTemplateRows) || (frame ? (frame.getBoundingClientRect().height - gapY * (span - 1)) / span : 0);
  return { stepX: (grid.getBoundingClientRect().width + gapX) / (layout.columns ?? 4), stepY: row + gapY };
}

export function WorkspaceProvider({ initial, initialPresets, initialDeletedPresetIds, onSave, saving, children }: { initial?: WorkspaceLayout; initialPresets?: WorkspacePreset[]; initialDeletedPresetIds?: string[]; onSave: (layout: WorkspaceLayout, presets: WorkspacePreset[], done: () => void, deletedPresetIds: string[]) => void; saving?: boolean; children: ReactNode }) {
  const [layout, setLayout] = useState(() => normalizeWorkspaceLayout(initial));
  const [editing, setEditing] = useState(false);
  const [targets, setTargets] = useState<Workspace["targets"]>({});
  const [selected, setSelected] = useState<ToolId | GroupId>("resources");
  const saved = useRef(layout);
  const [deletedPresetIds, setDeletedPresetIds] = useState(() => normalizeDeletedPresetIds(initialDeletedPresetIds));
  const [presets, setPresets] = useState(() => normalizeWorkspacePresets(initialPresets, layout, initialDeletedPresetIds));
  const [presetName, setPresetName] = useState("New Layout");
  const [naming, setNaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePresetId, setDeletePresetId] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(() => matchingPreset(presets, layout));
  const [metrics, setMetrics] = useState<WorkspaceMetrics>(() => { const rem = parseFloat(getComputedStyle(document.documentElement).fontSize); return { width: window.innerWidth, row: Math.max(rem * 11.5, (window.innerHeight - rem * 9) * 1.15 / 4), columnGap: rem * .85, rowGap: rem * .85, grid: window.innerWidth > 1000, rem }; });
  const measureGrid = useCallback((node: HTMLDivElement) => {
    const style = getComputedStyle(node), rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const next = { width: style.display === "grid" ? (node.clientWidth + parseFloat(style.columnGap)) * 4 / Number(style.getPropertyValue("--workspace-columns") || 4) - parseFloat(style.columnGap) : node.clientWidth, row: parseFloat(style.gridTemplateRows) || Math.max(rem * 11.5, (window.innerHeight - rem * 9) * 1.15 / 4), columnGap: parseFloat(style.columnGap), rowGap: parseFloat(style.rowGap), grid: style.display === "grid", rem };
    setMetrics(old => Object.keys(next).every(key => old[key as keyof WorkspaceMetrics] === next[key as keyof WorkspaceMetrics]) ? old : next);
  }, []);
  const unavailable = useCallback((id: ToolId, shape: GridShape) => unavailableLayout(id, shape, metrics), [metrics]);
  useEffect(() => { const value = normalizeWorkspaceLayout(initial); saved.current = value; if (!editing) { setLayout(value); setSelectedPreset(previous => matchingPreset(presets, value, previous)); } }, [initial]);
  const register = useCallback((id: ToolId, node: HTMLDivElement | null) => setTargets(old => {
    if (old[id] === (node ?? undefined)) return old;
    const next = { ...old }; if (node) next[id] = node; else delete next[id]; return next;
  }), []);
  const availableRows = Math.max(layout.rows ?? 8, ...gridFrames(layout).map(frame => frame.row + frame.height - 1));
  const resizeFrame = useCallback((id: ToolId | GroupId, shape: GridShape) => setLayout(old => setWorkspaceFrameShape(old, id, shape)), []);
  const dockFrame = (id: ToolId | GroupId, dock: "belt" | "left", shape?: GridShape) => setLayout(old => ({ ...old, tools: old.tools.map(tool => (tool.id === id || tool.dock === id && id !== "belt") && tool.id !== "settings" ? { ...tool, ...(shape ?? {}), ...(shape && tool.id !== "favorites" && !GRID_SIZES.some(([width, height]) => width === shape.width && height === shape.height) ? { inheritedShape: true as const } : {}), dock } : tool) }));
  const saveNamedLayout = () => {
    const name = presetName.trim();
    if (!name || saving) return;
    const existing = presets.find(preset => preset.name.toLowerCase() === name.toLowerCase());
    if (existing && !window.confirm(`Overwrite saved layout "${existing.name}" with this arrangement?`)) return;
    const next = saveWorkspacePreset(presets, name, layout);
    onSave(layout, next, () => { setPresets(next); saved.current = layout; setSelectedPreset(next.find(preset => preset.name.toLowerCase() === name.toLowerCase())?.id); setNaming(false); setEditing(false); }, deletedPresetIds);
  };
  const acceptChanges = () => {
    if (saving) return;
    onSave(layout, presets, () => { saved.current = layout; setNaming(false); setEditing(false); }, deletedPresetIds);
  };
  const deleteSelectedLayout = () => {
    if (saving || !presets.some(preset => preset.id === deletePresetId)) return;
    const next = deleteWorkspacePreset(presets, deletePresetId, deletedPresetIds);
    // Delete only the saved choice: never apply or discard the editor's draft.
    onSave(saved.current, next.presets, () => {
      setPresets(next.presets);
      setDeletedPresetIds(next.deletedPresetIds);
      setSelectedPreset(previous => matchingPreset(next.presets, layout, previous));
      setDeleting(false);
    }, next.deletedPresetIds);
  };
  return <Context.Provider value={{ layout, editing, begin: () => { setNaming(false); setEditing(true); }, register, targets, selected, selectFrame: setSelected, resizeFrame, restoreDraft: setLayout, unavailable, measureGrid, dockFrame }}>
    {editing && <section className="workspace-editor border border-primary bg-card p-4 space-y-3" aria-label="Layout editor">
      <strong className="block">Customize Layout</strong>
      <p className="text-sm text-muted-foreground">Drag a card header to move it, or an edge or corner to resize. Cards snap to the grid; brighter cells show available spaces. Arrow keys also move a focused header. Escape cancels a drag. Accept Changes applies this arrangement; Save Layout stores a named preset.</p>
      <div className="flex flex-wrap items-center gap-2"><span>Grid: {layout.columns ?? 4} columns × {availableRows} rows</span><Button size="sm" variant="outline" disabled={availableRows >= 128} onClick={() => setLayout(old => ({ ...old, rows: availableRows + 1 }))}>Add row</Button><Button size="sm" variant="outline" disabled={(layout.columns ?? 4) >= 12} onClick={() => setLayout(old => ({ ...old, columns: (old.columns ?? 4) + 1 }))}>Add column</Button><Button size="sm" variant="outline" disabled={!!gridRemovalReason(layout, "row")} title={gridRemovalReason(layout, "row") ?? "Remove the empty bottom row"} onClick={() => setLayout(old => removeGridTrack(old, "row"))}>Remove row</Button><Button size="sm" variant="outline" disabled={!!gridRemovalReason(layout, "column")} title={gridRemovalReason(layout, "column") ?? "Remove the empty rightmost column"} onClick={() => setLayout(old => removeGridTrack(old, "column"))}>Remove column</Button></div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Saved layouts">{presets.map(preset => <Button key={preset.id} size="sm" variant={selectedPreset === preset.id && sameLayout(layout, preset.layout) ? "default" : "outline"} disabled={saving} aria-pressed={selectedPreset === preset.id && sameLayout(layout, preset.layout)} onClick={() => { if (window.confirm(`Load "${preset.name}"? Unsaved layout changes will be replaced.`)) { setLayout(normalizeWorkspaceLayout(preset.layout)); setPresetName(preset.name); setSelectedPreset(preset.id); setNaming(false); } }}>{preset.name}</Button>)}</div>
      {naming && <form className="flex flex-wrap items-center gap-2" aria-label="Save named layout" onSubmit={event => { event.preventDefault(); saveNamedLayout(); }}><label htmlFor="workspace-preset-name">Layout name</label><Input id="workspace-preset-name" className="w-56" autoFocus maxLength={60} value={presetName} onChange={event => setPresetName(event.target.value)} disabled={saving} /><Button size="sm" type="submit" disabled={saving || !presetName.trim()}>Save named layout</Button><Button size="sm" variant="outline" type="button" disabled={saving} onClick={() => setNaming(false)}>Back</Button></form>}
      <div className="workspace-layout-actions flex flex-wrap justify-end gap-2 border-t border-border/40 pt-3" role="group" aria-label="Layout actions">
        <Button size="sm" variant="destructive" disabled={saving || !presets.length} onClick={() => { setDeletePresetId(selectedPreset ?? presets[0]?.id ?? ""); setDeleting(true); }}>Delete Layout</Button>
        <Button size="sm" disabled={saving} onClick={() => setNaming(true)}>Save Layout</Button>
        <Button size="sm" variant="destructive" className="workspace-layout-cancel" disabled={saving} onClick={() => { setLayout(saved.current); setSelectedPreset(matchingPreset(presets, saved.current)); setNaming(false); setEditing(false); }}>Cancel</Button>
        <Button size="sm" className="workspace-layout-accept" disabled={saving} title="Apply this layout without creating or overwriting a named preset" onClick={acceptChanges}>Accept Changes</Button>
      </div>
    </section>}
    <Dialog open={deleting} onOpenChange={open => { if (!saving) setDeleting(open); }}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader><DialogTitle>Delete Layout</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Remove a saved layout from this character. Your current arrangement, unsaved layout edits, and character information will not change. This cannot be undone.</p>
        <label htmlFor="workspace-delete-preset" className="text-sm font-semibold">Layout to delete</label>
        <select id="workspace-delete-preset" className="w-full min-w-0 rounded-md border border-border bg-background p-2 text-sm" value={deletePresetId} disabled={saving} onChange={event => setDeletePresetId(event.target.value)}>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => setDeleting(false)}>Keep layout</Button>
          <Button size="sm" variant="destructive" disabled={saving || !deletePresetId} onClick={deleteSelectedLayout}>Delete selected layout</Button>
        </div>
      </DialogContent>
    </Dialog>
    {children}
  </Context.Provider>;
}

// The portal destination never changes: only its DOM parent moves. Tool state stays mounted.
export function DockableTool({ id, children }: { id: ToolId; children: ReactNode }) {
  const workspace = useWorkspace();
  const [container] = useState(() => { const node = document.createElement("div"); node.className = "workspace-tool-content"; node.dataset.tool = id; return node; });
  const parking = useRef<HTMLDivElement>(null);
  const target = workspace?.targets[id];
  useLayoutEffect(() => { (target ?? parking.current)?.appendChild(container); return () => { container.remove(); }; }, [target, container]);
  return <><div ref={parking} hidden />{createPortal(children, container)}</>;
}
function Slot({ id, available = true }: { id: ToolId; available?: boolean }) {
  const workspace = useWorkspace()!;
  const ref = useCallback((node: HTMLDivElement | null) => workspace.register(id, node), [id, workspace.register]);
  return <div ref={ref} className="workspace-slot" hidden={!available} />;
}
function Tool({ id }: { id: ToolId }) {
  const workspace = useWorkspace()!, tool = workspace.layout.tools.find(item => item.id === id)!;
  const warning = workspace.unavailable(id, tool);
  return <section className={`workspace-tool ${id !== "resources" && id !== "favorites" ? "grimoire-card" : ""} ${workspace.editing ? "workspace-editing" : ""}`} data-width={tool.width} style={{ "--tool-span": tool.width } as CSSProperties} aria-label={TOOL_NAMES[id]}>
    <div inert={workspace.editing || undefined}>{warning && <div className="workspace-unavailable" role="note" title={warning}><strong>{TOOL_NAMES[id]}</strong><p>This size is unavailable.</p><span>Use a supported size or the Tabbed Belt.</span></div>}<Slot id={id} available={!warning} /></div>
  </section>;
}
function TabGroup({ dock, title }: { dock: ToolDock; title: string }) {
  const workspace = useWorkspace()!;
  const members = workspace.layout.tools.filter(tool => tool.dock === dock);
  const [active, setActive] = useState<ToolId | undefined>(members[0]?.id);
  const canDisplay = (id: ToolId) => dock === "belt" || !workspace.unavailable(id, workspace.layout.groups[dock as GroupId]);
  const availableMembers = members.filter(tool => canDisplay(tool.id));
  const current = members.some(tool => tool.id === active && canDisplay(tool.id)) ? active : members.find(tool => canDisplay(tool.id))?.id;
  useEffect(() => {
    const reveal = (event: Event) => { const id = (event as CustomEvent<ToolId>).detail; if (members.some(tool => tool.id === id)) setActive(id); };
    window.addEventListener("grimoire:reveal-tool", reveal); return () => window.removeEventListener("grimoire:reveal-tool", reveal);
  }, [members.map(tool => tool.id).join("|")]);
  if (!members.length) return null;
  return <section data-dock={dock} className={`workspace-group grimoire-card border border-border bg-card p-4 ${workspace.editing ? "workspace-editing" : ""}`} aria-label={title}>
    <div className="workspace-group-tabs" role="tablist" aria-label={title}>{members.map(tool => <button key={tool.id} id={`layout-tab-${tool.id}`} type="button" role="tab" disabled={!canDisplay(tool.id)} title={workspace.editing ? "Double-click or Alt+Enter to detach this tab at the current card size, if supported." : canDisplay(tool.id) ? undefined : workspace.unavailable(tool.id, workspace.layout.groups[dock as GroupId])} onDoubleClick={() => { const shape = workspace.layout.groups[dock as GroupId]; if (workspace.editing && !workspace.unavailable(tool.id, shape)) workspace.dockFrame(tool.id, "left", shape); }} tabIndex={current === tool.id ? 0 : -1} onKeyDown={event => { if (workspace.editing && event.altKey && event.key === "Enter") { event.preventDefault(); const shape = workspace.layout.groups[dock as GroupId]; if (!workspace.unavailable(tool.id, shape)) workspace.dockFrame(tool.id, "left", shape); return; } const index = availableMembers.findIndex(member => member.id === tool.id); const next = event.key === "ArrowRight" ? availableMembers[(index + 1) % availableMembers.length] : event.key === "ArrowLeft" ? availableMembers[(index + availableMembers.length - 1) % availableMembers.length] : event.key === "Home" ? availableMembers[0] : event.key === "End" ? availableMembers.at(-1) : undefined; if (next) { event.preventDefault(); setActive(next.id); document.getElementById(`layout-tab-${next.id}`)?.focus(); } }} aria-selected={current === tool.id} aria-controls={`layout-panel-${tool.id}`} onClick={() => setActive(tool.id)}>{TOOL_NAMES[tool.id]}</button>)}</div>
    {!current && <div className="workspace-unavailable">These tools need a larger card or the Tabbed Belt. Their saved content has not changed.</div>}
    {members.map(tool => <div key={tool.id} role="tabpanel" id={`layout-panel-${tool.id}`} aria-labelledby={`layout-tab-${tool.id}`} data-belt-scroll={dock === "belt" ? "true" : undefined} tabIndex={dock === "belt" ? 0 : undefined} hidden={current !== tool.id} inert={workspace.editing || undefined}><Slot id={tool.id} available={canDisplay(tool.id)} /></div>)}
  </section>;
}
export function WorkspaceCanvas() {
  const workspace = useWorkspace()!;
  const grid = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = grid.current;
    if (!node) return;
    const syncGuides = () => { node.style.setProperty("--workspace-track-rows", getComputedStyle(node).gridTemplateRows); workspace.measureGrid(node); };
    syncGuides();
    const observer = new ResizeObserver(syncGuides);
    observer.observe(node);
    return () => observer.disconnect();
  });
  const frames = gridFrames(workspace.layout);
  return <div ref={grid} className={`workspace-grid ${workspace.editing ? "workspace-grid-editing" : ""}`} aria-label="Character workspace" style={{ "--workspace-columns": workspace.layout.columns ?? 4, "--workspace-rows": workspace.layout.rows ?? 8 } as CSSProperties}>
    {workspace.editing && <div className="workspace-grid-guides" aria-hidden="true">{workspaceGridGuides(frames, workspace.layout.columns ?? 4, workspace.layout.rows ?? 8).map(cell => <div key={`${cell.column}:${cell.row}`} className={`workspace-grid-guide ${cell.empty ? "workspace-grid-guide-empty" : ""}`} data-empty={cell.empty} style={{ gridColumn: cell.column, gridRow: cell.row }}><span>{cell.empty ? "Available" : ""}</span></div>)}</div>}
    {frames.map(frame => <div key={frame.id} className={`workspace-grid-cell ${workspace.editing && workspace.selected === frame.id ? "workspace-frame-selected" : ""}`} data-frame-id={frame.id} data-width={frame.width} data-height={frame.height} onPointerDownCapture={() => { if (workspace.editing) workspace.selectFrame(frame.id); }} style={{ gridColumn: `${frame.column} / span ${frame.width}`, gridRow: `${frame.row} / span ${frame.height}`, "--workspace-card-order": (frame.row - 1) * (workspace.layout.columns ?? 4) + frame.column, "--workspace-card-base-height": `calc(var(--grid-row) * ${frame.height} + .85rem * ${frame.height - 1})` } as CSSProperties}>
      {workspace.editing && <WorkspaceHeader id={frame.id} shape={frame} />}
      {frame.group ? <TabGroup dock={frame.id as GroupId} title={frame.id === "belt" ? "Tabbed Belt" : frame.id === "tracker" ? "Character trackers" : "Dice tools"} /> : <Tool id={frame.id as ToolId} />}
      {workspace.editing && <ResizeHandles id={frame.id} shape={frame} />}
    </div>)}
  </div>;
}

function WorkspaceHeader({ id, shape }: { id: ToolId | GroupId; shape: GridShape }) {
  const workspace = useWorkspace()!;
  const drag = useRef<{ pointer: number; x: number; y: number; stepX: number; stepY: number; rows: number; start: GridShape; layout: WorkspaceLayout; moved: boolean } | null>(null);
  const [moving, setMoving] = useState(false);
  const name = id === "belt" ? "Tabbed Belt" : id === "tracker" ? "Character trackers" : id === "roller" ? "Dice tools" : TOOL_NAMES[id];
  useEffect(() => {
    if (!moving) return;
    const cursor = document.body.style.cursor, select = document.body.style.userSelect;
    document.body.style.cursor = "grabbing"; document.body.style.userSelect = "none";
    return () => { document.body.style.cursor = cursor; document.body.style.userSelect = select; };
  }, [moving]);
  const update = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = drag.current;
    if (!session || session.pointer !== event.pointerId) return;
    const next = moveGridShape(session.start, Math.round((event.pageX - session.x) / session.stepX), Math.round((event.pageY - session.y) / session.stepY), session.rows, workspace.layout.columns ?? 4);
    if (next.column === session.start.column && next.row === session.start.row) { if (session.moved) workspace.restoreDraft(session.layout); return; }
    session.moved = true; workspace.resizeFrame(id, next);
  };
  const finish = (event: ReactPointerEvent<HTMLButtonElement>, cancel = false) => {
    const session = drag.current;
    if (!session || session.pointer !== event.pointerId) return;
    if (cancel) workspace.restoreDraft(session.layout); else update(event);
    drag.current = null; setMoving(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <button type="button" className="workspace-edit-label workspace-move-header" data-moving={moving || undefined} aria-label={`Move ${name}`} title={`Drag to move ${name}. Arrow keys move one grid cell. Escape cancels. Right-click to dock on the Belt.`} onContextMenu={event => { event.preventDefault(); if (id !== "belt" && window.confirm(`Dock ${name} on the Tabbed Belt?`)) workspace.dockFrame(id, "belt"); }} onClick={() => workspace.selectFrame(id)}
    onPointerDown={event => {
      if (event.button !== 0) return;
      const grid = event.currentTarget.closest(".workspace-grid"); if (!grid) return;
      event.preventDefault(); event.stopPropagation();
      drag.current = { pointer: event.pointerId, x: event.pageX, y: event.pageY, ...gestureSteps(grid, workspace.layout), rows: Math.max(workspace.layout.rows ?? 8, ...gridFrames(workspace.layout).map(frame => frame.row + frame.height - 1)), start: { width: shape.width, height: shape.height, column: shape.column, row: shape.row }, layout: workspace.layout, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true }); workspace.selectFrame(id); setMoving(true);
    }} onPointerMove={update} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={() => { drag.current = null; setMoving(false); }}
    onKeyDown={event => {
      if (event.key === "Escape" && drag.current) { const session = drag.current; workspace.restoreDraft(session.layout); drag.current = null; setMoving(false); if (event.currentTarget.hasPointerCapture(session.pointer)) event.currentTarget.releasePointerCapture(session.pointer); event.preventDefault(); return; }
      const dx = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0, dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (dx || dy) { event.preventDefault(); workspace.selectFrame(id); workspace.resizeFrame(id, moveGridShape(shape, dx, dy, Math.max(workspace.layout.rows ?? 8, ...gridFrames(workspace.layout).map(frame => frame.row + frame.height - 1)), workspace.layout.columns ?? 4)); }
    }}><span>{name} · {shape.width} × {shape.height}</span><span aria-hidden="true" className="workspace-move-grip">⠿</span></button>;
}

const RESIZE_EDGES: ResizeEdge[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const EDGE_NAMES: Record<ResizeEdge, string> = { n: "top", ne: "top-right", e: "right", se: "bottom-right", s: "bottom", sw: "bottom-left", w: "left", nw: "top-left" };
interface ResizeGesture { pointer: number; edge: ResizeEdge; x: number; y: number; stepX: number; stepY: number; start: GridShape; layout: WorkspaceLayout }

function ResizeHandles({ id, shape }: { id: ToolId | GroupId; shape: GridShape }) {
  const workspace = useWorkspace()!;
  const gesture = useRef<ResizeGesture | null>(null);
  const [direction, setDirection] = useState<ResizeEdge | null>(null);
  const name = id === "belt" ? "Tabbed Belt" : id === "tracker" ? "Character trackers" : id === "roller" ? "Dice tools" : TOOL_NAMES[id];
  useEffect(() => {
    if (!direction) return;
    const previousCursor = document.body.style.cursor, previousSelect = document.body.style.userSelect;
    document.body.style.cursor = `${direction}-resize`;
    document.body.style.userSelect = "none";
    return () => { document.body.style.cursor = previousCursor; document.body.style.userSelect = previousSelect; };
  }, [direction]);
  const update = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = gesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const columns = Math.round((event.pageX - drag.x) / drag.stepX), rows = Math.round((event.pageY - drag.y) / drag.stepY);
    const next = resizeGridShape(drag.start, drag.edge, columns, rows, workspace.layout.columns ?? 4, Math.max(workspace.layout.rows ?? 8, ...gridFrames(workspace.layout).map(frame => frame.row + frame.height - 1)), workspaceFrameSizes(id, workspace.layout));
    if (!["belt", "tracker", "roller"].includes(id) && workspace.unavailable(id as ToolId, next)) return;
    workspace.resizeFrame(id, next);
  };
  const finish = (event: ReactPointerEvent<HTMLButtonElement>, cancel = false) => {
    const drag = gesture.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    if (cancel) workspace.restoreDraft(drag.layout); else update(event);
    gesture.current = null; setDirection(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="workspace-resize-handles" data-resizing={direction ?? undefined}>
    {RESIZE_EDGES.map(edge => <button type="button" key={edge} className={`workspace-resize-handle workspace-resize-${edge}`} aria-label={`Resize ${name} ${EDGE_NAMES[edge]} edge`} title={`Drag to resize ${name}. Arrow keys resize; Escape cancels the drag.`}
      onPointerDown={event => {
        if (event.button !== 0) return;
        const grid = event.currentTarget.closest(".workspace-grid");
        if (!grid) return;
        event.preventDefault(); event.stopPropagation();
        gesture.current = { pointer: event.pointerId, edge, x: event.pageX, y: event.pageY, ...gestureSteps(grid, workspace.layout), start: { width: shape.width, height: shape.height, column: shape.column, row: shape.row }, layout: workspace.layout };
        event.currentTarget.setPointerCapture(event.pointerId); workspace.selectFrame(id); setDirection(edge); event.currentTarget.focus({ preventScroll: true });
      }} onPointerMove={update} onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)} onLostPointerCapture={() => { gesture.current = null; setDirection(null); }}
      onKeyDown={event => {
        if (event.key === "Escape" && gesture.current) { workspace.restoreDraft(gesture.current.layout); const pointer = gesture.current.pointer; gesture.current = null; setDirection(null); if (event.currentTarget.hasPointerCapture(pointer)) event.currentTarget.releasePointerCapture(pointer); event.preventDefault(); return; }
        const horizontal = edge.includes("e") || edge.includes("w"), vertical = edge.includes("n") || edge.includes("s");
        const dx = horizontal ? event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0 : 0;
        const dy = vertical ? event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0 : 0;
        if (dx || dy) { event.preventDefault(); workspace.selectFrame(id); const next = resizeGridShape(shape, edge, dx, dy, workspace.layout.columns ?? 4, Math.max(workspace.layout.rows ?? 8, ...gridFrames(workspace.layout).map(frame => frame.row + frame.height - 1)), workspaceFrameSizes(id, workspace.layout)); if (["belt", "tracker", "roller"].includes(id) || !workspace.unavailable(id as ToolId, next)) workspace.resizeFrame(id, next); }
      }}><span aria-hidden="true" /></button>)}
  </div>;
}
