import test from "node:test";
import assert from "node:assert/strict";
import { resolveTrackerEffects, isEffectApplied } from "../src/lib/tracker.ts";
import { storage, importCharacterJSON } from "../src/lib/storage.ts";
import type { Ability } from "../src/lib/storage.ts";
import type { Familiar } from "../src/lib/storage.ts";
import { resolveFamiliarTrackerEffects } from "../src/lib/familiar-values.ts";
import { groupAbilityTriggers } from "../src/lib/trigger-groups.ts";
import { blankAbilityInput, blankResult } from "../src/lib/ability-input.ts";

test("item and familiar trigger tags share the tracker without sharing source identity", () => {
  const definition = blankAbilityInput();
  definition.name = "Tagged source";
  definition.targets = ["Enemy"];
  definition.results = [blankResult("Enemy")];
  definition.results[0].lifetime = "independent";
  definition.trigger.conditions = [{ id: "event", kind: "situation", label: "Ally Being Attacked" }];
  const source = { id: 700, name: definition.name, definition, equipmentId: 5 } as Ability;
  const familiar = { id: "owner", name: "Owner", className: "Iron", power: 3, vitality: 4, spirit: 5, agility: 6, endurance: 7, precision: 8, willpower: 9, charisma: 10, currentHp: 12, currentMana: 13, currentDt: 14, abilities: [source] } as unknown as Familiar;
  const itemEntries = resolveTrackerEffects([source], "Iron", { power: 30 });
  const familiarEntries = resolveFamiliarTrackerEffects(familiar);
  assert.ok(familiarEntries.length);
  assert.ok(familiarEntries.every(entry => entry.ownerFamiliar === familiar));
  const group = groupAbilityTriggers([...itemEntries, ...familiarEntries], [source]).find(group => group.name === "Ally Being Attacked")!;
  assert.equal(group.entries.length, itemEntries.length + familiarEntries.length);
  const item = itemEntries.find(entry => entry.result)!;
  const owned = familiarEntries.find(entry => entry.result)!;
  const application = { id: "attached", familiarId: familiar.id, abilityId: source.id, effectId: owned.effect.id, targetId: "opponent", startedAt: "test" };
  assert.equal(isEffectApplied(item, "opponent", [application]), false);
  assert.equal(isEffectApplied(owned, "opponent", [application]), true);
});

// Synthetic fixtures are confined to tests; the application ships no sample character.
const ability = {
  id: 700, name: "Test effect source", primaryStat: "power", linkedStats: ["power"],
  abilityEffects: [{ id: "effect-test", name: "Test effect", tracking: { radius: 7, radiusUnit: "ft", targets: ["self"], permanent: true } }],
  evolutionModifiers: [{ id: "evolution-test", name: "Test evolution", requiredStat: 4, rankLabel: "Iron 2", effect: "", effectChanges: [{ effectId: "effect-test", radius: 11 }] }],
} as Ability;

test("active evolutions update one derived aura and leave the base unchanged", () => {
  const result = resolveTrackerEffects([ability], "Bronze", { power: 12 });
  assert.equal(result.length, 1);
  assert.equal(result[0].effect.tracking?.radius, 11);
  assert.equal(ability.abilityEffects![0].tracking!.radius, 7);
});

test("dormant evolution does not modify the effective radius", () => {
  assert.equal(resolveTrackerEffects([ability], "Iron", { power: 12 })[0].effect.tracking?.radius, 7);
});

test("permanent self effects are active without applications, conditional effects require judgment", () => {
  const [entry] = resolveTrackerEffects([ability], "Iron", { power: 12 });
  assert.equal(isEffectApplied(entry, "self", []), true);
  assert.equal(isEffectApplied(entry, "enemy", []), false);
  const conditional = { ...ability, abilityEffects: [{ ...ability.abilityEffects![0], tracking: { ...ability.abilityEffects![0].tracking, requirements: "Player confirmation" } }] };
  const [pending] = resolveTrackerEffects([conditional], "Iron", { power: 12 });
  assert.equal(pending.applicability, "requires judgment");
  assert.equal(isEffectApplied(pending, "self", []), false);
});

test("effect applications remain isolated by source and target", () => {
  const [entry] = resolveTrackerEffects([{ ...ability, abilityEffects: [{ id: "effect-test", name: "Test effect" }] }], "Iron", { power: 12 });
  const applications = [{ id: "application-test", abilityId: ability.id, effectId: "effect-test", targetId: "target-one", startedAt: "2026-01-01" }];
  assert.equal(isEffectApplied(entry, "target-one", applications), true);
  assert.equal(isEffectApplied(entry, "target-two", applications), false);
});

test("legacy effects do not acquire fabricated aura metadata", () => {
  const [entry] = resolveTrackerEffects([{ ...ability, abilityEffects: [{ id: "legacy-effect", name: "Legacy effect", description: "Original rules" }] }], "Iron", { power: 12 });
  assert.equal(entry.effect.tracking, undefined);
  assert.equal(entry.effect.description, "Original rules");
});

test("new evolution-linked effects stay dormant until progression unlocks them", () => {
  const gated = { ...ability, abilityEffects: [{ ...ability.abilityEffects![0], tracking: { ...ability.abilityEffects![0].tracking, unlockedByModifierId: "evolution-test" } }] };
  const [dormant] = resolveTrackerEffects([gated], "Iron", { power: 12 });
  assert.equal(dormant.progression, "dormant");
  assert.equal(dormant.applicability, "unavailable");
  assert.equal(isEffectApplied(dormant, "self", []), false);
  const [unlocked] = resolveTrackerEffects([gated], "Bronze", { power: 12 });
  assert.equal(unlocked.progression, "unlocked");
  assert.equal(isEffectApplied(unlocked, "self", []), true);
});

test("fresh storage has no example characters", () => {
  assert.equal(storage.getCharacters().length, 0);
});

test("character import retains familiar nested fields and remaps effect applications", () => {
  const loaded = importCharacterJSON(JSON.stringify({ character: {
    name: "Import fixture", familiars: [{ id: "familiar-test", abilities: [{ id: 55, name: "Nested fixture", linkedStats: ["spirit"], subAbilities: [{ id: "nested-test", name: "Nested action" }], extension: { preserved: true } }] }],
    effectApplications: [{ id: "application-test", abilityId: ability.id, effectId: "effect-test", targetId: "self", startedAt: "2026-01-01" }],
  }, abilities: [ability] }));
  const nested = loaded.familiars![0].abilities[0] as unknown as Record<string, unknown>;
  assert.deepEqual(nested.extension, { preserved: true });
  assert.deepEqual(nested.linkedStats, ["spirit"]);
  assert.equal((nested.subAbilities as unknown[]).length, 1);
  assert.equal(loaded.effectApplications![0].abilityId, storage.getAbilities(loaded.id)[0].id);
});
