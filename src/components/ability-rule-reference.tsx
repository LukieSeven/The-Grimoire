import type { AbilityRuleValue } from "../lib/ability-input";

const ruleLabels: Record<string, string> = {
  opposed_check: "Opposed check", caster_stats: "Caster’s roll options", defender_stats: "Defender’s roll options",
  caster_win: "On caster win", caster_loss: "On caster loss", critical_outcome: "On critical",
  delayed_damage: "Delayed damage", activation_modes: "Activation choices", mark_pool: "Marks & stacks",
  trigger_window: "Trigger & expiry", conditional_modifier: "Conditional roll modifier", escape: "Break free",
};

function RuleValue({ value }: { value: AbilityRuleValue }) {
  if (Array.isArray(value)) {
    if (value.every(entry => typeof entry === "string")) return <span>{value.join(", ")}</span>;
    return <ul className="list-disc space-y-1 pl-4">{value.map((entry, index) => <li key={index}><RuleValue value={entry} /></li>)}</ul>;
  }
  if (value !== null && typeof value === "object") return <Rules value={value} />;
  return <span className="whitespace-pre-wrap break-words">{value === null ? "—" : typeof value === "boolean" ? value ? "Yes" : "No" : value}</span>;
}

function Rules({ value }: { value: Record<string, AbilityRuleValue> }) {
  return <dl className="space-y-2">{Object.entries(value).filter(([, entry]) => entry !== null && entry !== "" && (typeof entry !== "object" || Object.keys(entry).length > 0)).map(([key, entry]) => <div key={key}>
    <dt className="font-semibold text-foreground">{Object.hasOwn(ruleLabels, key) ? ruleLabels[key] : key.replace(/[_-]+/g, " ").replace(/^./, char => char.toUpperCase())}</dt>
    <dd className="pl-3"><RuleValue value={entry} /></dd>
  </div>)}</dl>;
}

export function AbilityRuleReference({ rules }: { rules?: Record<string, AbilityRuleValue> }) {
  if (!rules || !Object.keys(rules).length) return null;
  return <details className="rounded-md border border-border/40 p-3 text-xs text-muted-foreground">
    <summary className="cursor-pointer text-primary">Advanced rules (reference)</summary>
    <div className="mt-2"><Rules value={rules} /></div>
  </details>;
}
