import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRequirements, evaluateCondition } from "../src/lib/ability-components.ts";
import type { AbilityComponent, TriggerContext, TriggerCondition } from "../src/lib/ability-components.ts";
import { resolveTrackerEffects, isEffectApplied } from "../src/lib/tracker.ts";
import type { Ability } from "../src/lib/storage.ts";

// Synthetic test values only; no character fixtures are shipped in the application.
test("one aura shares its activation and range across independent ally and enemy effects", () => {
  const aura: AbilityComponent = { ...component, behaviors: ["activated"], createdEffects: [
    { id: "benefit", name: "Benefit", rules: "Ally rules", targets: ["allies"], delivery: "ongoing" },
    { id: "penalty", name: "Penalty", rules: "Enemy rules", targets: ["enemies"], delivery: "ongoing", conditions: [situation] },
  ] };
  const applications = [{ id: "activation", abilityId: ability.id, effectId: aura.id, targetId: "self", startedAt: "2026-01-01" }];
  const entries = resolveTrackerEffects([{ ...ability, components: [aura] }], "Iron", { power: 12 }, context);
  const benefit = entries.find(entry => entry.effect.id === "benefit")!;
  const penalty = entries.find(entry => entry.effect.id === "penalty")!;
  assert.equal(isEffectApplied(benefit, "self", []), false);
  assert.equal(isEffectApplied(benefit, "self", applications), true);
  assert.equal(isEffectApplied(penalty, "self", applications), false);
  assert.equal(benefit.effect.tracking?.radius, aura.radius);
  assert.equal(benefit.effect.description, "Ally rules");
  assert.equal(isEffectApplied(benefit, "enemy", applications), false);
  const confirmed = resolveTrackerEffects([{ ...ability, components: [aura] }], "Iron", { power: 12 }, context, { [situation.id]: true });
  assert.equal(isEffectApplied(confirmed.find(entry => entry.effect.id === "penalty")!, "self", applications), true);
  const applied = [...applications, { id: "target", abilityId: ability.id, effectId: "penalty", targetId: "enemy", startedAt: "2026-01-01" }];
  assert.equal(isEffectApplied(confirmed.find(entry => entry.effect.id === "penalty")!, "enemy", applied), true);
  assert.equal(isEffectApplied(confirmed.find(entry => entry.effect.id === "penalty")!, "enemy", applied.filter(entry => entry.id !== "activation")), false);
});
const context: TriggerContext = { hp: 20, maxHp: 100, mana: 10, maxMana: 20, dt: 0, maxDt: 10 };
const resource: TriggerCondition = { id: "resource-test", kind: "resource", label: "", resource: "hp", operator: "below_percent", threshold: 30 };
const situation: TriggerCondition = { id: "situation-test", kind: "situation", label: "Player decision" };
const component: AbilityComponent = { id: "component-test", name: "Test component", kinds: ["aura", "modifier"], behaviors: ["always-on"], targets: ["allies"], rules: "Test rules", radius: 12, radiusUnit: "ft" };
const ability = { id: 42, name: "Test source", primaryStat: "power", linkedStats: ["power"], components: [component] } as Ability;

test("all requirements preserve unknown player judgments", () => {
  assert.equal(evaluateRequirements([resource, situation], "all", context), "judgment");
  assert.equal(evaluateRequirements([resource, situation], "all", context, { [situation.id]: true }), "met");
  assert.equal(evaluateRequirements([resource, situation], "all", context, { [situation.id]: false }), "unmet");
});
test("any requirements can be satisfied by one known check", () => {
  assert.equal(evaluateRequirements([resource, situation], "any", context), "met");
});
test("missing threshold or maximum is not fabricated", () => {
  assert.equal(evaluateCondition({ ...resource, threshold: undefined }, context), "judgment");
  assert.equal(evaluateCondition(resource, { ...context, maxHp: 0 }), "judgment");
  assert.equal(evaluateCondition(resource), "judgment");
});
test("always-on ally auras have an active origin without applying to every enemy", () => {
  const [entry] = resolveTrackerEffects([ability], "Iron", { power: 12 }, context);
  assert.equal(isEffectApplied(entry, "self", []), true);
  assert.equal(isEffectApplied(entry, "enemy", []), false);
  assert.equal(entry.effect.tracking?.radius, 12);
});
test("multiple components activate independently", () => {
  const next: AbilityComponent = { ...component, id: "attack-test", kinds: ["damage"], behaviors: ["activated", "reaction"], targets: ["enemies"], radius: undefined };
  const entries = resolveTrackerEffects([{ ...ability, components: [component, next] }], "Iron", { power: 12 }, context);
  assert.equal(isEffectApplied(entries[0], "self", []), true);
  assert.equal(isEffectApplied(entries[1], "self", []), false);
  const applications = [{ id: "application-test", abilityId: ability.id, effectId: next.id, targetId: "enemy-one", startedAt: "2026-01-01" }];
  assert.equal(isEffectApplied(entries[1], "enemy-one", applications), true);
  assert.equal(isEffectApplied(entries[1], "enemy-two", applications), false);
});
test("automatic conditions become inactive when resource requirements stop matching", () => {
  const conditional = { ...component, behaviors: ["conditional"] as const, triggerMode: "automatic" as const, conditions: [resource] };
  const source = { ...ability, components: [{ ...conditional, behaviors: [...conditional.behaviors] }] };
  assert.equal(isEffectApplied(resolveTrackerEffects([source], "Iron", { power: 12 }, context)[0], "self", []), true);
  assert.equal(isEffectApplied(resolveTrackerEffects([source], "Iron", { power: 12 }, { ...context, hp: 80 })[0], "self", []), false);
});
test("evolution patches one component without duplicating or modifying the saved radius", () => {
  const source = { ...ability, evolutionModifiers: [{ id: "modifier-test", name: "Test modifier", rankLabel: "Iron 2", requiredStat: 4, effect: "" }], components: [{ ...component, evolutions: [{ id: "change-test", modifierId: "modifier-test", radius: 24 }] }] };
  const iron = resolveTrackerEffects([source], "Iron", { power: 12 }, context);
  const bronze = resolveTrackerEffects([source], "Bronze", { power: 12 }, context);
  assert.equal(iron[0].effect.tracking?.radius, 12);
  assert.equal(bronze.length, 1);
  assert.equal(bronze[0].effect.tracking?.radius, 24);
  assert.equal(source.components[0].radius, 12);
});

test("component rank steps work without an ability-level progression list", () => {
  const source = { ...ability, evolutionModifiers: [], components: [{ ...component, unlockedByModifierId: "Iron 2", evolutions: [{ id: "step-test", modifierId: "Iron 2", radius: 24 }] }] };
  const dormant = resolveTrackerEffects([source], "Iron", { power: 12 }, context)[0];
  const unlocked = resolveTrackerEffects([source], "Bronze", { power: 12 }, context)[0];
  assert.equal(dormant.progression, "dormant");
  assert.equal(unlocked.progression, "unlocked");
  assert.equal(unlocked.effect.tracking?.radius, 24);
  assert.deepEqual(source.evolutionModifiers, []);
});

test("created effects expose only their own rules and can be applied independently", () => {
  const source = { ...ability, description: "Long-form source text must not leak into effect references", components: [{ ...component, createdEffects: [
    { id: "created-one", name: "First effect", rules: "First effect rules", targets: ["enemies" as const], duration: "Until ended" },
    { id: "created-two", name: "Second effect", rules: "Second effect rules", targets: ["allies" as const] },
  ] }] };
  const entries = resolveTrackerEffects([source], "Iron", { power: 12 }, context);
  assert.equal(entries.length, 3);
  const first = entries.find(entry => entry.effect.id === "created-one")!;
  const second = entries.find(entry => entry.effect.id === "created-two")!;
  assert.equal(first.effect.description, "First effect rules");
  assert.equal(first.effect.tracking?.radius, undefined);
  assert.equal(isEffectApplied(first, "self", []), false);
  const applications = [{ id: "created-application", abilityId: ability.id, effectId: first.effect.id, targetId: "target-one", startedAt: "2026-01-01" }];
  assert.equal(isEffectApplied(first, "target-one", applications), true);
  assert.equal(isEffectApplied(first, "target-two", applications), false);
  assert.equal(isEffectApplied(second, "target-one", applications), false);
});

test("an applied created effect persists after its source creation requirement stops matching", () => {
  const source = { ...ability, components: [{ ...component, conditions: [resource], createdEffects: [{ id: "persistent-test", name: "Persistent effect", rules: "Recorded rules", targets: ["enemies" as const] }] }] };
  const effect = resolveTrackerEffects([source], "Iron", { power: 12 }, { ...context, hp: 80 }).find(entry => entry.effect.id === "persistent-test")!;
  assert.equal(effect.applicability, "unavailable");
  assert.equal(isEffectApplied(effect, "enemy", [{ id: "application", abilityId: ability.id, effectId: effect.effect.id, targetId: "enemy", startedAt: "2026-01-01" }]), true);
});
