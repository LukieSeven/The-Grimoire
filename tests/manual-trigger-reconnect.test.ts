import test from "node:test";
import assert from "node:assert/strict";
import { blankAbilityInput, blankResult } from "../src/lib/ability-input.ts";
import type { RequirementGroup } from "../src/lib/ability-input.ts";
import { recordsAbilityActivation, isManualTriggerActivation, shouldEndAbilityOnUse } from "../src/lib/ability-use-action.ts";
import { applyTrackedEffect } from "../src/lib/effect-stacking.ts";
import { getAdjustedStats } from "../src/lib/storage.ts";
import type { Ability, Character } from "../src/lib/storage.ts";
import { resolveTrackerEffects, isEffectApplied } from "../src/lib/tracker.ts";

const event = { id: "attack", kind: "situation", label: "Being Attacked" } as const;
const health = { id: "low-health", kind: "resource", label: "", resource: "hp", operator: "below_percent", threshold: 50 } as const;
const vitals = { hp: 60, maxHp: 80, mana: 40, maxMana: 50, dt: 10, maxDt: 10 };
const group = (mode: RequirementGroup["mode"], ...conditions: RequirementGroup["conditions"]): RequirementGroup => ({ conditions, match: "all", mode });

function fixture() {
  const definition = { ...blankAbilityInput(), name: "Triggered defense", targets: ["Self"], results: [{ ...blankResult("Self"), bonuses: { bonusEndurance: 2 } }] };
  const ability = { id: 1, name: definition.name, description: "", linkedStats: [], definition } as Ability;
  const resolve = (confirmations: Record<string, boolean> = {}, current = vitals) => resolveTrackerEffects([ability], "Iron", { endurance: 10 }, current, confirmations);
  return { definition, ability, resolve };
}

test("manual tabletop event permits a tracked bonus only after confirmation and activation", () => {
  const { definition, ability, resolve } = fixture();
  definition.durationType = "When Triggered";
  definition.trigger = group("manual", event);
  assert.equal(resolve()[0].applicability, "requires judgment");
  assert.equal(resolve({ attack: false })[0].applicability, "unavailable");
  const [ready, result] = resolve({ attack: true });
  assert.equal(ready.applicability, "available");
  assert.ok(isManualTriggerActivation(ready.input!));
  assert.ok(recordsAbilityActivation(ready.input!));
  assert.equal(ready.permanent, false);
  assert.equal(isEffectApplied(result, "self", []), false);
  const applications = applyTrackedEffect([], ready, "self", "2026-11-14T00:00:00Z");
  assert.equal(isEffectApplied(result, "self", applications), true);
  const character = { id: 1, rank: "Iron", power: 10, vitality: 10, spirit: 10, agility: 10, endurance: 10, precision: 10, willpower: 10, charisma: 10, currentHp: 60, currentMana: 40, currentDt: 10, hpFormula: "Vitality*8", manaFormula: "Spirit*5", dtFormula: "Endurance", initiativeFormula: "Agility", dtBonus: 0, triggerConfirmations: { attack: true }, effectApplications: applications } as Character;
  assert.equal(getAdjustedStats(character, [], [ability]).stats.endurance, 12);
  assert.equal(isEffectApplied(resolve({ attack: false })[1], "self", applications), false);
  assert.equal(shouldEndAbilityOnUse(true, "When Triggered", true, true), true);
  assert.equal(shouldEndAbilityOnUse(true, "When Triggered", false, true), false);
});

test("reference-only resources neither block activation nor end a tracked effect", () => {
  const { definition, resolve } = fixture();
  definition.durationType = "Until Triggered";
  definition.trigger = group("reference", health);
  definition.ending = group("reference", { ...health, id: "end-health" });
  const [ready] = resolve();
  assert.equal(ready.applicability, "available");
  const applications = applyTrackedEffect([], ready, "self", "2026-11-14T00:00:00Z");
  const [lowHealthSource, lowHealthResult] = resolve({}, { ...vitals, hp: 20 });
  assert.equal(lowHealthSource.endingMet, false);
  assert.equal(isEffectApplied(lowHealthResult, "self", applications), true);
});

test("older situation tags remain reminders except on the matching triggered duration", () => {
  const { definition, resolve } = fixture();
  definition.durationType = "While Active";
  definition.trigger = group("manual", event);
  const [ready] = resolve();
  assert.equal(ready.applicability, "available");
  assert.equal(isManualTriggerActivation(ready.input!), false);
  const applications = applyTrackedEffect([], ready, "self", "2026-11-14T00:00:00Z");
  definition.durationType = "Until Triggered";
  definition.ending = group("manual", event);
  assert.equal(isEffectApplied(resolve()[1], "self", applications), true);
  assert.equal(isEffectApplied(resolve({ attack: true })[1], "self", applications), false);
});

test("existing resource-only When Triggered effects remain automatic", () => {
  const { definition, resolve } = fixture();
  definition.durationType = "When Triggered";
  definition.trigger = group("manual", health);
  assert.equal(isEffectApplied(resolve()[1], "self", []), false);
  const [ready, result] = resolve({}, { ...vitals, hp: 20 });
  assert.equal(ready.permanent, true);
  assert.equal(recordsAbilityActivation(ready.input!), false);
  assert.equal(isEffectApplied(result, "self", []), true);
});
