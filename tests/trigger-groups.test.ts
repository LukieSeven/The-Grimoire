import test from "node:test";
import assert from "node:assert/strict";
import { blankAbilityInput, blankResult, emptyRequirements, durationTriggerGroups } from "../src/lib/ability-input.ts";
import { TRIGGER_CHOICES } from "../src/lib/ability-components.ts";
import { resolveTrackerEffects, isEffectApplied } from "../src/lib/tracker.ts";
import { groupAbilityTriggers } from "../src/lib/trigger-groups.ts";
import type { Ability } from "../src/lib/storage.ts";

function fixture(id: number, event?: string) {
  const definition = blankAbilityInput(); definition.name = `Test ability ${id}`; definition.targets = ["Enemy"]; definition.results = [blankResult("Enemy")];
  if (event) { definition.durationType = "When Triggered"; definition.durationTrigger = { ...emptyRequirements(), conditions: [{ id: `event-${id}`, kind: "situation", label: event }] }; }
  return { id, name: definition.name, definition, description: "Long reference is not a trigger tag", linkedStats: [] } as unknown as Ability;
}
function groups(abilities: Ability[]) { return groupAbilityTriggers(resolveTrackerEffects(abilities, "Iron", {}), abilities); }
test("only the event tagged on an ability creates a tracker header", () => {
  const tagged = fixture(1, "Ally Being Attacked"), untagged = fixture(2);
  const grouped = groups([tagged, untagged]);
  assert.deepEqual(grouped.map(group => group.name), ["Ally Being Attacked"]);
  assert.ok(grouped[0].entries.every(entry => entry.ability.id === tagged.id));
  assert.equal(grouped[0].eventConditions.length, 1);
});
test("all built-in event, Resource and Custom tags connect to their matching abilities", () => {
  const abilities = TRIGGER_CHOICES.map((choice, index) => {
    const ability = fixture(index + 1, choice === "Custom" ? "A user-entered condition" : choice);
    if (choice === "Resources") ability.definition!.durationTrigger!.conditions = [{ id: "resource-test", kind: "resource", label: "", resource: "mana", operator: "depleted" }];
    return ability;
  });
  const grouped = groups(abilities);
  assert.deepEqual(grouped.map(group => group.name), TRIGGER_CHOICES.map(choice => choice === "Resources" ? "Mana Modified" : choice === "Custom" ? "A user-entered condition" : choice));
  for (const [index, group] of grouped.entries()) assert.ok(group.entries.every(entry => entry.ability.id === abilities[index].id));
});
test("unused saved trigger definitions and untagged effects do not create headers", () => {
  const ability = fixture(1);
  ability.definition!.options.triggers.push({ id: "unused", name: "Being Attacked", match: "all", conditions: [{ id: "unused-event", kind: "situation", label: "Being Attacked" }] });
  assert.deepEqual(groups([ability]), []);
});
test("a target result's own trigger groups only that result, not unrelated siblings", () => {
  const ability = fixture(1), tagged = ability.definition!.results[0], sibling = blankResult("Enemy");
  tagged.durationType = "When Triggered"; tagged.durationTrigger = { ...emptyRequirements(), conditions: [{ id: "hit", kind: "situation", label: "Hitting a Target" }] };
  ability.definition!.results.push(sibling);
  const grouped = groups([ability]);
  assert.deepEqual(grouped.map(group => group.name), ["Hitting a Target"]);
  assert.deepEqual(grouped[0].entries.map(entry => entry.effect.id), [tagged.id]);
});
test("Sub-Abilities contribute their own tags without pulling unrelated parent abilities", () => {
  const ability = fixture(1), sub = blankAbilityInput(); sub.name = "Alternate test use"; sub.durationType = "When Triggered";
  sub.durationTrigger = { ...emptyRequirements(), conditions: [{ id: "sub-event", kind: "situation", label: "Start of Turn" }] }; ability.definition!.subAbilities.push(sub);
  const grouped = groups([ability]);
  assert.deepEqual(grouped.map(group => group.name), ["Start of Turn"]);
  assert.deepEqual(grouped[0].entries.map(entry => entry.effect.id), [sub.id]);
});
test("removing the last tag removes its header immediately", () => {
  const ability = fixture(1, "Being Attacked");
  assert.equal(groups([ability]).length, 1);
  ability.definition!.durationTrigger!.conditions = [];
  assert.deepEqual(groups([ability]), []);
});
test("event tags organize information without activation or ending gates", () => {
  const ability = fixture(1, "Being Attacked"), definition = ability.definition!;
  const applications = [{ id: "active", abilityId: ability.id, effectId: definition.id, targetId: "self", startedAt: "test" }];
  const entry = (met: boolean) => resolveTrackerEffects([ability], "Iron", {}, undefined, { "event-1": met })[0];
  assert.equal(entry(false).applicability, "available");
  assert.equal(isEffectApplied(entry(false), "self", []), false);
  assert.equal(isEffectApplied(entry(false), "self", applications), true);
  assert.equal(isEffectApplied(entry(true), "self", applications), true);
  definition.durationType = "Until Triggered";
  assert.equal(isEffectApplied(entry(false), "self", applications), true);
  assert.equal(isEffectApplied(entry(true), "self", applications), true);
  assert.deepEqual(groups([ability]).map(group => group.name), ["Being Attacked"]);
});
test("switching to a non-triggered duration preserves the event input without using a hidden trigger", () => {
  const ability = fixture(1, "Ally Being Attacked"), definition = ability.definition!;
  definition.durationType = "Time";
  const chosen = durationTriggerGroups(definition);
  assert.equal(chosen.activation.conditions.length, 0); assert.equal(chosen.ending.conditions.length, 0);
  assert.equal(definition.durationTrigger!.conditions[0].label, "Ally Being Attacked");
  assert.deepEqual(groups([ability]), []);
});
test("legacy resource triggers remain grouped without exposing untagged legacy effects", () => {
  const ability = { id: 1, name: "Legacy test ability", triggers: [{ id: "legacy-trigger", name: "Mana condition", resource: "mana", operator: "depleted", threshold: 0 }], abilityEffects: [{ id: "untagged-effect", name: "Untagged test effect" }] } as Ability;
  const grouped = groups([ability]);
  assert.deepEqual(grouped.map(group => group.name), ["Mana Modified"]);
  assert.equal(grouped[0].legacy.length, 1); assert.equal(grouped[0].entries.length, 0);
});

test("resource groups follow trigger inputs rather than granted bonuses", () => {
  const ability = fixture(50);
  ability.definition!.durationType = "When Triggered";
  ability.definition!.durationTrigger = { ...emptyRequirements(), conditions: [
    { id: "hp-check", kind: "resource", label: "", resource: "hp", operator: "below_percent", threshold: 50 },
    { id: "mana-check", kind: "resource", label: "", resource: "mana", operator: "depleted" },
  ] };
  ability.definition!.results[0].bonuses = { dtBuff: 2 };
  assert.deepEqual(groups([ability]).map(group => group.name), ["Health Modified", "Mana Modified"]);
  ability.definition!.durationTrigger.conditions = [{ id: "dt-check", kind: "resource", label: "", resource: "dt", operator: "depleted" }];
  assert.deepEqual(groups([ability]).map(group => group.name), ["DT Modified"]);
});
