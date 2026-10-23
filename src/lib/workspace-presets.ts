import { defaultWorkspaceLayout, normalizeWorkspaceLayout, type WorkspaceLayout } from "./workspace-layout.ts";

export interface WorkspacePreset { id: string; name: string; layout: WorkspaceLayout }

/** Layout-only defaults captured from the two saved preview presets. Fresh copies
 * keep personal layout edits isolated; no character fields are read or written. */
export function defaultWorkspacePresets(): WorkspacePreset[] {
  const original = defaultWorkspaceLayout();
  const next: WorkspaceLayout = {
    ...defaultWorkspaceLayout(),
    tools: original.tools.map(tool => tool.id === "resources" ? { ...tool, width: 1 } : tool.id === "favorites" ? { ...tool, width: 1, height: 4, column: 4, row: 3 } : { ...tool }),
    groups: {
      belt: { width: 2, height: 6, column: 2, row: 1 },
      tracker: { width: 1, height: 4, column: 4, row: 3 },
      roller: { width: 1, height: 2, column: 4, row: 1 },
    },
    priority: "favorites",
  };
  return [{ id: "og-layout", name: "OG Layout", layout: original }, { id: "new-layout", name: "New Layout", layout: next }];
}

/** Character-scoped tombstones prevent a removed built-in from being re-added. */
export function normalizeDeletedPresetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && id.trim().length > 0))];
}

/** Add missing global presets without replacing personal saved layouts or
 * restoring layouts this character explicitly deleted. */
export function normalizeWorkspacePresets(value: unknown, _current?: WorkspaceLayout, deletedPresetIds?: unknown): WorkspacePreset[] {
  const deleted = new Set(normalizeDeletedPresetIds(deletedPresetIds));
  const presets: WorkspacePreset[] = [];
  if (Array.isArray(value)) for (const entry of value) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || typeof entry.name !== "string") continue;
    if (deleted.has(entry.id)) continue;
    const name = entry.name.trim().slice(0, 60);
    if (!name || presets.some(preset => preset.id === entry.id || preset.name.toLowerCase() === name.toLowerCase())) continue;
    presets.push({ id: entry.id, name, layout: normalizeWorkspaceLayout(entry.layout) });
  }
  for (const preset of defaultWorkspacePresets()) {
    if (deleted.has(preset.id)) continue;
    if (!presets.some(existing => existing.id === preset.id || existing.name.toLowerCase() === preset.name.toLowerCase())) presets.push(preset);
  }
  return presets;
}

/** Remove only the selected saved snapshot; neither its active layout nor the
 * global preset definitions are modified. Unknown IDs are a no-op. */
export function deleteWorkspacePreset(presets: WorkspacePreset[], id: string, deletedPresetIds: unknown = []): { presets: WorkspacePreset[]; deletedPresetIds: string[] } {
  const deleted = normalizeDeletedPresetIds(deletedPresetIds);
  if (!presets.some(preset => preset.id === id)) return { presets, deletedPresetIds: deleted };
  return {
    presets: presets.filter(preset => preset.id !== id),
    deletedPresetIds: normalizeDeletedPresetIds([...deleted, id]),
  };
}

export function saveWorkspacePreset(presets: WorkspacePreset[], name: string, layout: WorkspaceLayout): WorkspacePreset[] {
  const cleanName = name.trim().slice(0, 60);
  if (!cleanName) return presets;
  const existing = presets.find(preset => preset.name.toLowerCase() === cleanName.toLowerCase());
  const next = { id: existing?.id ?? crypto.randomUUID(), name: cleanName, layout: normalizeWorkspaceLayout(layout) };
  return existing ? presets.map(preset => preset.id === existing.id ? next : preset) : [...presets, next];
}
