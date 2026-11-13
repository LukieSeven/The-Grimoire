import type { AbilityInput } from "../../lib/ability-input";
import type { Familiar } from "../../lib/storage";

export interface PreviewNode {
  input: AbilityInput;
  depth: number;
  kind: "primary" | "action" | "summon";
  familiarName?: string;
  familiar?: Familiar;
}

export function previewNodes(input: AbilityInput, depth = 0, kind: PreviewNode["kind"] = "primary", familiar?: Familiar): PreviewNode[] {
  return [
    { input, depth, kind, familiar, familiarName: familiar?.name },
    ...input.subAbilities.flatMap(child => previewNodes(child, depth + 1, "action", familiar)),
    ...(input.summon?.abilities ?? []).flatMap(child => previewNodes(child, depth + 1, "summon", input.summon!.familiar)),
  ];
}

/** Patch only the selected definition; untouched legacy fields and IDs survive. */
export function replacePreviewNode(root: AbilityInput, next: AbilityInput): AbilityInput {
  if (root.id === next.id) return next;
  return {
    ...root,
    subAbilities: root.subAbilities.map(child => replacePreviewNode(child, next)),
    ...(root.summon ? { summon: { ...root.summon, abilities: root.summon.abilities.map(child => replacePreviewNode(child, next)) } } : {}),
  };
}

export function removePreviewNode(root: AbilityInput, id: string): AbilityInput {
  return {
    ...root,
    subAbilities: root.subAbilities.filter(child => child.id !== id).map(child => removePreviewNode(child, id)),
    ...(root.summon ? { summon: { ...root.summon, abilities: root.summon.abilities.filter(child => child.id !== id).map(child => removePreviewNode(child, id)) } } : {}),
  };
}
