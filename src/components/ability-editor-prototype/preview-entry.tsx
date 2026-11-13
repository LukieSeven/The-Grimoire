import { lazy, Suspense } from "react";
import type { PrototypeDraftProps } from "./prototype-draft";
import type { EquipmentBlueprintProps } from "./equipment-blueprint";

const Draft = lazy(() => import("./prototype-draft"));
const EquipmentBlueprint = lazy(() => import("./equipment-blueprint"));

export type { AbilityEditorOwner } from "./prototype-draft";

export const previewAbilityDialogClass = "w-[96vw] sm:max-w-[70rem] max-h-[90dvh] flex flex-col gap-0 overflow-hidden bg-card p-0";
export const previewAbilityHeaderClass = "shrink-0 border-b border-border/40 p-4 pr-12 text-left";
export const previewAbilityTitleClass = "font-serif text-xl text-primary";

export function LocalAbilityDraft(props: PrototypeDraftProps) {
  return <Suspense fallback={<p role="status" className="p-4 text-sm text-muted-foreground">Opening ability editor…</p>}><Draft {...props} /></Suspense>;
}

export function LocalEquipmentBlueprint(props: EquipmentBlueprintProps) {
  return <Suspense fallback={<p role="status" className="p-4 text-sm text-muted-foreground">Opening equipment draft…</p>}><EquipmentBlueprint {...props} /></Suspense>;
}
