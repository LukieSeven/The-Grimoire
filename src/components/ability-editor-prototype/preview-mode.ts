export function isAbilityEditorPreview(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get("ability-editor") === "preview";
}
