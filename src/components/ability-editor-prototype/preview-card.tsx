import type { AbilityInput } from "../../lib/ability-input";
import { durationLabel, rangedAreaSummary, resultRollBonusKind, rollBonusKind } from "../../lib/ability-input";
import { BONUS_FIELDS, hasModifierValue } from "../../lib/ability-bonuses";
import { attachedEffects, effectDetails, outcomeLabel } from "../../lib/effect-details";
import { EffectChip } from "../effect-chip";
import { AbilityRuleReference } from "../ability-rule-reference";
import type { RuleRecord } from "./mechanics-fields";

function PreviewText({ label, text, className }: { label: string; text: string; className: string }) {
  if (!text.trim()) return null;
  const body = <p className={`whitespace-pre-wrap break-words ${className}`}>{text}</p>;
  if (text.length <= 180 && text.split("\n").length <= 3) return body;
  return <details className="rounded-md border border-border/30 p-2">
    <summary className="cursor-pointer text-xs text-muted-foreground">{label}</summary>
    <div className="mt-2">{body}</div>
  </details>;
}

export function PrototypePreviewCard({ input, ownerLabel, reference }: { input: AbilityInput; ownerLabel: string; reference?: RuleRecord }) {
  const chips = [
    input.source,
    typeof reference?.category === "string" ? reference.category : "",
    typeof reference?.frequency === "string" ? reference.frequency : "",
    input.durationType === "Always On" ? input.manaCost ? `${input.manaCost} MP when used` : "" : input.manaCost !== undefined ? `${input.manaCost} MP` : "",
    input.durationType === "Always On" ? "" : input.reaction ? "Reaction" : input.timeCost !== undefined ? `${input.timeCost} seconds` : "",
    reference && !input.range ? "" : [input.rangeType, input.range, ["Aura", "Ranged"].includes(input.rangeType) && input.range ? "ft" : ""].filter(Boolean).join(" "),
    reference && input.durationType === "Instant" && !input.duration ? "" : durationLabel(input.durationType, input.duration),
  ].filter(Boolean);
  const inactiveResults = input.results.filter(result => !input.targets.includes(result.target));
  return <aside className="min-w-0 space-y-3 xl:sticky xl:top-4" aria-label="Ability draft preview">
    <div className="flex items-center justify-between gap-2"><h2 className="font-serif text-primary text-base">Ability preview</h2><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Read only</span></div>
    <article className="grimoire-card min-w-0 rounded-md border border-border/50 bg-card p-4 space-y-4">
      <header className="space-y-2 border-b border-border/30 pb-3">
        <p className="text-xs text-muted-foreground break-words">{ownerLabel}</p>
        <h3 className="text-xl font-serif text-primary break-words">{input.name.trim() || "Unnamed ability"}</h3>
        <div className="flex flex-wrap gap-1.5">{chips.map((chip, index) => <span key={index} className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[11px] break-words">{chip}</span>)}</div>
      </header>
      <PreviewText label="Ability description" text={input.description} className="text-sm" />
      <AbilityRuleReference rules={input.advancedRules} />
      {rangedAreaSummary(input) && <p className="text-xs text-muted-foreground break-words">{rangedAreaSummary(input)}</p>}
      {!input.targets.length && <p className="text-sm text-muted-foreground">{reference ? "See More settings → Advanced rules for this feature’s conditions and outcomes." : "No targets selected."}</p>}
      {input.results.filter(result => input.targets.includes(result.target)).map((result, index) => {
        const modifiers = BONUS_FIELDS.filter(([key]) => hasModifierValue(result.bonuses?.[key]));
        const defenses = (["resistances", "immunities", "vulnerabilities"] as const).filter(key => result.bonuses?.[key]?.trim());
        const effects = attachedEffects(result);
        const bonusKind = resultRollBonusKind(result);
        return <section key={result.id} className="rounded-md border border-border/40 bg-background/25 p-3 space-y-2">
        <h4 className="font-serif text-sm text-primary break-words">{result.name || result.target}{result.name ? ` · ${result.target}` : ""}</h4>
        <PreviewText label="Effect rules" text={result.rules} className="text-xs" />
        {result.formula.trim() && <div className="rounded border border-primary/25 px-2 py-1.5 text-xs"><span className="block text-muted-foreground mb-1">{result.rollOnly ? "Standalone roll" : rollBonusKind(result.purpose) ? "Roll formula" : result.purpose || "Roll formula"}</span><code className="break-all text-primary">{result.formula}</code>{bonusKind && <p className="mt-1 text-muted-foreground">Applies {bonusKind} roll bonuses</p>}</div>}
        {(modifiers.length > 0 || defenses.length > 0) && <div className="space-y-1 text-xs">{modifiers.map(([key, label]) => <p key={key} className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="font-mono break-all text-right">{result.bonuses![key]}</span></p>)}
          {defenses.map(key => <p key={key} className="break-words capitalize">{key}: {result.bonuses![key]}</p>)}
        </div>}
        {result.bonuses?.resistanceAttributes?.length ? <p className="text-[11px] text-muted-foreground capitalize">Resistance rolls: {result.bonuses.resistanceAttributes.join(", ")}</p> : null}
        {result.bonuses?.checkSkills?.length ? <p className="text-[11px] text-muted-foreground">Check scope: {result.bonuses.checkSkills.join(", ")}</p> : null}
        {effects.length > 0 && <div className="flex flex-wrap gap-1.5">{effects.map(effect => {
          const details = effectDetails(effect.templateId, input.options);
          return <EffectChip key={`${effect.templateId}:${effect.outcome}`} name={details.name} description={`${outcomeLabel(effect.outcome)}\n${details.description}`} />;
        })}</div>}
        {(result.enemySavingThrow || result.saveFormula) && <p className="text-[11px] text-muted-foreground break-words">Resistance (reference): {[result.enemySavingThrow, result.saveFormula].filter(Boolean).join(" · ")} · resolved at the table</p>}
        {result.stacking && <p className="text-[11px] text-muted-foreground">{result.stacking}{result.maxStacks !== undefined ? ` · max ${result.maxStacks}` : ""}</p>}
        {!result.rules.trim() && !result.formula.trim() && !modifiers.length && !defenses.length && !effects.length && !result.enemySavingThrow && !result.saveFormula && <p className="text-xs text-muted-foreground">Result {index + 1} · not configured yet</p>}
      </section>;
      })}
      {input.summon && <p className="text-xs text-primary">Summon: {input.summon.familiar.name} · {input.summon.abilities.length} copied abilities</p>}
      {(input.cooldown !== undefined || input.uses || input.recharge) && <p className="text-xs text-muted-foreground break-words">Reference notes: {[input.cooldown !== undefined ? `Cooldown ${input.cooldown} ${input.cooldownUnit.toLowerCase()}` : "", input.uses, input.recharge].filter(Boolean).join(" · ")}</p>}
    </article>
    <p className="text-[11px] text-muted-foreground leading-relaxed">Presentation preview only. No rolls, resource spending, item consumption, or tracker changes.</p>
    {(inactiveResults.length > 0 || input.upgrades.length > 0 || input.unlockRank) && <p className="text-[11px] text-muted-foreground">Existing data retained: {[inactiveResults.length ? `${inactiveResults.length} result(s) for unselected targets` : "", input.upgrades.length ? `${input.upgrades.length} progression change(s)` : "", input.unlockRank ? `unlocks at ${input.unlockRank}` : ""].filter(Boolean).join(" · ")}.</p>}
  </aside>;
}
