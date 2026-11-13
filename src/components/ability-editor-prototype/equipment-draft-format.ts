import { z } from "zod";
import { EFFECT_ACTIONS, type AbilityInput } from "../../lib/ability-input.ts";
import { BONUS_FIELDS } from "../../lib/ability-bonuses.ts";

export const equipmentDraftFormat = "grimoire-equipment-draft";
export const equipmentDraftVersion = 1;

const text = z.string();
const number = z.number();
const texts = z.array(text);
const condition = z.looseObject({
  id: text, label: text, kind: z.enum(["resource", "situation"]),
  resource: z.enum(["hp", "mana", "dt"]).optional(),
  operator: z.enum(["below_percent", "below_value", "depleted", "above_percent", "full"]).optional(), threshold: number.optional(),
});
const match = z.enum(["any", "all"]);
const requirements = z.looseObject({ conditions: z.array(condition), match, mode: z.enum(["reference", "manual", "automatic"]) });
const retainedTiming = z.looseObject({ activation: requirements.optional(), ending: requirements.optional(), unassigned: requirements.optional() }).optional();
const outcome = z.enum(["always", "success", "failed-save"]);
const amount = z.union([text, number]).optional();
const bonusAmounts = Object.fromEntries(BONUS_FIELDS.map(([key]) => [key, amount]));
const result = z.looseObject({
  id: text, target: text, name: text, purpose: text, formula: text, rules: text, value: text,
  durationType: text, duration: text, lifetime: z.enum(["source", "independent"]), trigger: requirements, ending: requirements,
  durationTrigger: requirements.optional(), enemySavingThrow: text.optional(), saveFormula: text.optional(), templateId: text.optional(),
  retainedTiming, rollBonusKind: z.enum(["attack", "check", "resistance", "none"]).optional(), rollOnly: z.boolean().optional(), effectAction: z.enum(EFFECT_ACTIONS).optional(),
  attachedEffectOnly: z.boolean().optional(), effectKind: z.enum(["Buff", "Debuff"]).optional(),
  stacking: z.enum(["Stack", "Highest Only", "Replace Existing", "Refresh Duration"]).optional(), maxStacks: number.optional(),
  effectOutcome: outcome.optional(), effects: z.array(z.looseObject({ templateId: text, outcome })).optional(),
  bonuses: z.looseObject({
    ...bonusAmounts,
    resistances: text.optional(), immunities: text.optional(), vulnerabilities: text.optional(),
    resistanceAttributes: texts.optional(), checkSkills: texts.optional(),
  }).optional(),
});

// Validate the fields read by the draft editor while retaining unfamiliar fields for future round trips.
const abilityDefinition: z.ZodType = z.lazy(() => z.looseObject({
  id: text, name: text, source: text, targets: texts, reaction: z.boolean(), durationType: text, duration: text,
  rangeType: text, range: text, cooldownUnit: z.enum(["Seconds", "Minutes", "Hours", "Days"]), cooldownStarts: z.enum(["activation", "end"]),
  manaCost: number.optional(), manaPerTurn: number.optional(), timeCost: number.optional(), cooldown: number.optional(),
  uses: text, recharge: text, description: text, linkedStats: texts, unlockRank: text.optional(),
  advancedRules: z.record(text, z.json()).optional(),
  upgrades: z.array(z.looseObject({ id: text, rank: text, rules: text, range: text.optional(), duration: text.optional(), formula: text.optional(), resultId: text.optional() })),
  rangedTargeting: text.optional(), areaShape: text.optional(), areaDimensions: z.record(text, text).optional(),
  areaBehavior: z.record(text, z.boolean()).optional(),
  trigger: requirements, ending: requirements, durationTrigger: requirements.optional(), retainedTiming,
  results: z.array(result), subAbilities: z.array(abilityDefinition),
  summon: z.looseObject({
    familiar: z.looseObject({ id: z.union([text, number]), name: text }), abilities: z.array(abilityDefinition),
  }).optional(),
  options: z.looseObject({
    durationTypes: texts, rangeTypes: texts, targets: texts, rollPurposes: texts,
    rangedTargeting: texts.optional(), areaShapes: texts.optional(), effectTypes: texts.optional(),
    triggers: z.array(z.looseObject({ id: text, name: text, conditions: z.array(condition), match })),
    effects: z.array(z.looseObject({ id: text, name: text, kind: text, rules: text, value: text.optional(), definition: abilityDefinition.optional() })),
  }),
}));

const definitions = z.array(abilityDefinition.nullable());
const completeDraft = z.object({
  format: z.literal(equipmentDraftFormat), version: z.literal(equipmentDraftVersion), reference: z.unknown(),
  definitions: z.object({ weapons: z.array(definitions), paired: definitions.nullable() }),
});

export function readCompleteEquipmentDraft(input: unknown): {
  reference: unknown;
  definitions: { weapons: (AbilityInput | null)[][]; paired: (AbilityInput | null)[] | null };
} {
  const parsed = completeDraft.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`This equipment draft could not be opened: ${issue.path.join(".") || "draft"} is missing or has an unsupported format.`);
  }
  return { reference: parsed.data.reference, definitions: parsed.data.definitions as { weapons: (AbilityInput | null)[][]; paired: (AbilityInput | null)[] | null } };
}
