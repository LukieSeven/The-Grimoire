import test from "node:test";
import assert from "node:assert/strict";
import { blankAbilityInput, blankResult } from "../src/lib/ability-input.ts";
import { instantSelfRestoration } from "../src/lib/ability-resource-restoration.ts";
import { resolveTrackerEffects } from "../src/lib/tracker.ts";
import { spendTemporary } from "../src/lib/temporary-resources.ts";
import { getAdjustedStats, type Ability, type Character } from "../src/lib/storage.ts";

const stats = { power: 8, vitality: 8, spirit: 8, agility: 8, endurance: 8, precision: 8, willpower: 8, charisma: 8 };
const caps = { maxHp: 64, maxMana: 40, maxDt: 8 };
const pools = { currentHp: 30, currentMana: 39, currentDt: 6, tempMana: 4 };

test("instant self restores use the owner's stats, run after payment, and respect tracked limits", () => {
  const node = { ...blankAbilityInput(), name: "Restore", targets: ["Self", "Ally"], results: [
    { ...blankResult("Self"), bonuses: { hpAdd: "WIL + 2", manaAdd: 4, dtAdd: 5, hpBuff: 10 } },
    { ...blankResult("Self"), bonuses: { hpAdd: 2 } },
    { ...blankResult("Self"), bonuses: { hpAdd: 99 }, durationType: "While Active" },
    { ...blankResult("Self"), bonuses: { hpAdd: 5 }, lifetime: "independent" as const },
    { ...blankResult("Self"), effectAction: "Healing" as const, purpose: "Healing", formula: "2d6" },
    { ...blankResult("Ally"), bonuses: { hpAdd: 99 } },
  ] };
  const ability = { id: 1, name: node.name, definition: node } as Ability;
  const entries = resolveTrackerEffects([ability], "Iron", stats);
  const payment = spendTemporary(pools, { currentMana: pools.currentMana - 6 });
  const restore = instantSelfRestoration(entries, node.id, { ...pools, ...payment }, caps, stats, "Iron", []);
  assert.deepEqual(payment, { currentMana: 37, tempMana: 0 });
  assert.deepEqual(restore.patch, { currentHp: 42, currentMana: 40, currentDt: 8 });
  assert.deepEqual(restore.restored, { currentHp: 12, currentMana: 3, currentDt: 2 });
  assert.deepEqual(spendTemporary(pools, { ...payment, ...restore.patch }), { ...payment, ...restore.patch });
  const partialPayment = spendTemporary(pools, { currentMana: pools.currentMana - 2 });
  const partialRestore = instantSelfRestoration(entries, node.id, { ...pools, ...partialPayment }, caps, stats, "Iron", []);
  assert.deepEqual(spendTemporary(pools, { ...partialPayment, ...partialRestore.patch }), { currentHp: 42, currentMana: 40, currentDt: 8, tempMana: 2 });
  const independent = entries.find(entry => entry.result?.lifetime === "independent");
  assert.ok(independent);
  assert.deepEqual(instantSelfRestoration(entries, node.id, pools, caps, stats, "Iron", [], independent).restored, { currentHp: 5 });
});

test("an instant restore nested in a sustained action never raises the tracked maximum", () => {
  const node = { ...blankAbilityInput(), name: "Restore and sustain", durationType: "While Active", targets: ["Self"], results: [
    { ...blankResult("Self"), durationType: "Instant", bonuses: { hpAdd: 8, manaAdd: 6, dtAdd: 2 } },
    { ...blankResult("Self"), bonuses: { hpBuff: 5 } },
  ] };
  const ability = { id: 1, name: node.name, definition: node } as Ability;
  const effectApplications = [{ id: "activation", abilityId: ability.id, effectId: node.id, targetId: "self", startedAt: "2026-11-14T00:00:00Z" }];
  const character = { ...stats, ...pools, rank: "Iron", hpFormula: "VIT * 8", manaFormula: "SPI * 5", dtFormula: "END", effectApplications } as Character;
  const adjusted = getAdjustedStats(character, [], [ability]);
  assert.equal(adjusted.totalMaxHp, caps.maxHp + 5);
  assert.equal(adjusted.totalMaxMana, caps.maxMana);
  assert.equal(adjusted.totalMaxDt, caps.maxDt);
});
