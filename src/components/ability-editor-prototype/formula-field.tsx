import { useId, useRef } from "react";
import { linkedRollStats, needsSelectedStat, validateRollFormulaSyntax } from "../../lib/roll-rules";
import { Button } from "../ui/button";
import { SectionHelp } from "./section-help";

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  ownerLabel: string;
  linkedStats?: string[];
  required?: boolean;
}

const attributes = [
  ["Power", "POW"], ["Vitality", "VIT"], ["Spirit", "SPI"], ["Agility", "AGI"],
  ["Endurance", "END"], ["Precision", "PRE"], ["Willpower", "WIL"], ["Charisma", "CHA"],
] as const;
function formulaFeedback(value: string, hasLinkedStats: boolean): { message: string; invalid: boolean } | undefined {
  if (!value.trim()) return;
  try {
    validateRollFormulaSyntax(value);
    if (!hasLinkedStats && needsSelectedStat(value)) {
      return { message: "Syntax recognized. Link an attribute to use STAT, STATr, or STATm.", invalid: false };
    }
    return { message: "Syntax recognized. No dice rolled or resources spent.", invalid: false };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Review the formula syntax.", invalid: true };
  }
}

export function FormulaField({ value, onChange, label = "Roll formula", ownerLabel, linkedStats = [], required = false }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const validLinkedStats = linkedRollStats(linkedStats);
  const linkedLabels = validLinkedStats.map(stat => attributes.find(([name]) => name.toLowerCase() === stat)?.[1] ?? stat.toUpperCase());
  const feedback = formulaFeedback(value, validLinkedStats.length > 0);
  const insert = (token: string) => {
    const start = input.current?.selectionStart ?? value.length;
    const end = input.current?.selectionEnd ?? start;
    onChange(value.slice(0, start) + token + value.slice(end));
    queueMicrotask(() => {
      input.current?.focus();
      input.current?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return <div className="min-w-0 space-y-2">
    <div className="flex items-center gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <SectionHelp label={label}>Enter what the owner rolls, such as WILr + 1d6. Save validates the syntax without rolling. Record opposing stats and outcomes in Advanced rules.</SectionHelp>
    </div>
    <input ref={input} id={id} value={value} onChange={event => onChange(event.target.value)}
      aria-describedby={`${id}-feedback`} aria-invalid={feedback?.invalid || undefined} spellCheck={false}
      className="block w-full min-w-0 rounded-md border border-border/50 bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary" />
    <p id={`${id}-feedback`} className={`text-xs leading-relaxed ${feedback?.invalid ? "text-destructive" : "text-muted-foreground"}`} aria-live="polite">
      {feedback?.message ?? (required ? "Enter dice, an attribute, or a formula for this roll." : "Enter dice, an attribute, or a formula. Leave blank when no roll is needed.")}
    </p>
    <div className="relative min-w-0">
      <details className="rounded-md border border-border/40 bg-background/20">
        <summary className="cursor-pointer py-2 pl-3 pr-10 text-xs font-medium text-primary">Insert dice or attribute</summary>
        <div className="space-y-3 px-3 pb-3">
          <p className="text-xs leading-relaxed text-muted-foreground break-words">Use {ownerLabel}’s stats: <code className="text-foreground">WIL</code> is the effective score, <code className="text-foreground">WILr</code> rolls the Willpower dice and adds the rank modifier once, and <code className="text-foreground">WILm</code> uses just the rank modifier.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{attributes.map(([name, prefix]) => <div key={prefix} className="min-w-0 rounded-md border border-border/30 p-2">
            <span className="block text-[11px] text-muted-foreground">{name}</span>
            <div className="mt-1 flex flex-wrap gap-1">
              <Button type="button" size="xs" variant="outline" onClick={() => insert(prefix)} aria-label={`Insert ${name} effective score`}>{prefix}</Button>
              <Button type="button" size="xs" variant="outline" onClick={() => insert(`${prefix}r`)} aria-label={`Insert ${name} roll`}>{prefix}r</Button>
              <Button type="button" size="xs" variant="outline" onClick={() => insert(`${prefix}m`)} aria-label={`Insert ${name} rank modifier`}>{prefix}m</Button>
            </div>
          </div>)}</div>
          <div className="flex flex-wrap gap-1.5">{["d4", "d6", "d8", "d10", "d12", "d20", "d100", " + ", " - ", " * ", " / ", "(", ")"].map(token => <Button key={token} type="button" size="xs" variant="outline" onClick={() => insert(token)} aria-label={`Insert ${token.trim()}`}>{token.trim()}</Button>)}</div>
          <div className="space-y-2 border-t border-border/30 pt-2">
            <div className="flex flex-wrap gap-1.5">{["STAT", "STATr", "STATm"].map(token => <Button key={token} type="button" size="xs" variant="outline" onClick={() => insert(token)}>{token}</Button>)}</div>
            <p className="text-xs leading-relaxed text-muted-foreground">These use the linked stat selected for the ability: score, roll with rank modifier, or rank modifier only. {linkedLabels.length ? `Linked: ${linkedLabels.join(", ")}.` : "Link at least one attribute before using this shorthand."}</p>
          </div>
        </div>
      </details>
      <div className="absolute right-2 top-1.5"><SectionHelp label="Insert dice or attribute">Use these shortcuts to build a formula. For example, 2d6 + POWm rolls two six-sided dice and adds the owner’s Power rank modifier.</SectionHelp></div>
    </div>
  </div>;
}
