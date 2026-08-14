import test from "node:test";
import assert from "node:assert/strict";
import { 
  calculateAbilityEvolutions, 
  getRankForStatValue, 
  getAbilityHighestRank 
} from "../src/lib/storage.ts";
import type { Ability, EvolutionModifier } from "../src/lib/storage.ts";

const createTestAbility = (override?: Partial<Ability>): Ability => ({
  id: 101,
  characterId: 1,
  name: "Ability 1",
  description: "Target rolls resistance against stat.",
  cost: 4,
  cooldown: 240,
  range: "Melee",
  speed: "Standard",
  rollFormula: "POWr * 2",
  primaryStat: "power",
  linkedStats: ["power", "willpower"],
  assignedToQuickRolls: true,
  evolutionModifiers: [
    {
      id: "mod-1",
      name: "Modifier 1",
      rankLabel: "Iron 2",
      requiredStat: 4,
      effect: "Modifier 1 effect"
    },
    {
      id: "mod-2",
      name: "Modifier 2",
      rankLabel: "Iron 3",
      requiredStat: 6,
      effect: "Modifier 2 effect"
    },
    {
      id: "mod-3",
      name: "Modifier 3",
      rankLabel: "Iron 4",
      requiredStat: 8,
      effect: "Modifier 3 effect"
    },
    {
      id: "mod-4",
      name: "Modifier 4",
      rankLabel: "Iron 5",
      requiredStat: 10,
      effect: "Modifier 4 effect"
    },
    {
      id: "mod-5",
      name: "Modifier 5",
      rankLabel: "Bronze 1",
      requiredStat: 12,
      effect: "Modifier 5 effect"
    },
    {
      id: "mod-6",
      name: "Modifier 6",
      rankLabel: "Bronze 2",
      requiredStat: 13,
      effect: "Modifier 6 effect"
    },
    {
      id: "mod-7",
      name: "Modifier 7",
      rankLabel: "Bronze 3",
      requiredStat: 14,
      effect: "Modifier 7 effect"
    },
    {
      id: "mod-8",
      name: "Modifier 8",
      rankLabel: "Bronze 4",
      requiredStat: 15,
      effect: "Modifier 8 effect"
    },
    {
      id: "mod-9",
      name: "Modifier 9",
      rankLabel: "Bronze 5",
      requiredStat: 16,
      effect: "Modifier 9 effect"
    },
    {
      id: "mod-10",
      name: "Modifier 10",
      rankLabel: "Silver 1",
      requiredStat: 17,
      effect: "Modifier 10 effect"
    },
  ],
  ...override,
});

test("CASE 1: Rank = Iron, POW = 8 -> 0 active evolution modifiers (Dormant)", () => {
  const ab = createTestAbility();
  const res = calculateAbilityEvolutions(ab, "Iron", { power: 8 });

  assert.equal(res.isDormant, true);
  assert.equal(res.activeModifiers.length, 0);
  assert.equal(res.earnedDormantModifiers.length, 3); // Modifiers 1..3 earned but dormant
  assert.equal(res.earnedDormantModifiers[0].name, "Modifier 1");
  assert.equal(res.earnedDormantModifiers[1].name, "Modifier 2");
  assert.equal(res.earnedDormantModifiers[2].name, "Modifier 3");
});

test("CASE 2: Rank = Bronze, POW = 8 -> Modifiers 1–3 active", () => {
  const ab = createTestAbility();
  const res = calculateAbilityEvolutions(ab, "Bronze", { power: 8 });

  assert.equal(res.isDormant, false);
  assert.equal(res.activeModifiers.length, 3);
  assert.deepEqual(
    res.activeModifiers.map(m => m.name),
    ["Modifier 1", "Modifier 2", "Modifier 3"]
  );
  assert.equal(res.nextLockedModifier?.name, "Modifier 4");
});

test("CASE 3: Rank = Bronze, POW = 10 -> Modifiers 1–4 active", () => {
  const ab = createTestAbility();
  const res = calculateAbilityEvolutions(ab, "Bronze", { power: 10 });

  assert.equal(res.isDormant, false);
  assert.equal(res.activeModifiers.length, 4);
  assert.equal(res.activeModifiers[3].name, "Modifier 4");
  assert.equal(res.nextLockedModifier?.name, "Modifier 5");
});

test("CASE 4: Rank = Bronze, POW = 12 -> Modifiers 1–5 active", () => {
  const ab = createTestAbility();
  const res = calculateAbilityEvolutions(ab, "Bronze", { power: 12 });

  assert.equal(res.isDormant, false);
  assert.equal(res.activeModifiers.length, 5);
  assert.equal(res.activeModifiers[4].name, "Modifier 5");
});

test("CASE 5: Rank = Bronze, POW = 15 -> Modifiers 1–8 active", () => {
  const ab = createTestAbility();
  const res = calculateAbilityEvolutions(ab, "Bronze", { power: 15 });

  assert.equal(res.isDormant, false);
  assert.equal(res.activeModifiers.length, 8);
  assert.equal(res.activeModifiers[7].name, "Modifier 8");
});

test("Rank Gate Hard Cap: Bronze capped at 9 active modifiers even at POW 30", () => {
  const ab = createTestAbility();
  const res = calculateAbilityEvolutions(ab, "Bronze", { power: 30 });

  assert.equal(res.isDormant, false);
  assert.equal(res.activeModifiers.length, 9); // Bronze ceiling is 9!
  assert.equal(res.lockedModifiers.length, 1); // Modifier 10 locked by Rank Gate
  assert.equal(res.nextLockedModifier?.name, "Modifier 10");
});

test("Rank Gate Progression: Silver unlocks up to 14 slots at POW 30", () => {
  const ab = createTestAbility();
  const res = calculateAbilityEvolutions(ab, "Silver", { power: 30 });

  assert.equal(res.isDormant, false);
  assert.equal(res.activeModifiers.length, 10); // All 10 defined modifiers active under Silver 14 cap
});

test("Highest-Rank Multi-Stat Resolution: POW 8 (Iron 4) vs AGI 14 (Bronze 3) -> Bronze 3", () => {
  const ab = createTestAbility({ primaryStat: "power", linkedStats: ["power", "agility"] });
  const rankRes = getAbilityHighestRank(ab, { power: 8, agility: 14 });

  assert.equal(rankRes.label, "Bronze 3");
  assert.equal(rankRes.rank, "Bronze");
  assert.equal(rankRes.subLevel, 3);
});

test("Unassigned Stat Fallback: No stats selected -> defaults to Iron 1", () => {
  const ab = createTestAbility({ primaryStat: "", linkedStats: [] });
  const rankRes = getAbilityHighestRank(ab, { power: 20 });

  assert.equal(rankRes.label, "Iron 1");
  assert.equal(rankRes.rank, "Iron");
  assert.equal(rankRes.subLevel, 1);
});

test("Dynamic Stat Changes: POW fluctuations automatically update active modifier count", () => {
  const ab = createTestAbility();

  const pow8 = calculateAbilityEvolutions(ab, "Bronze", { power: 8 });
  assert.equal(pow8.activeModifiers.length, 3);

  const pow10 = calculateAbilityEvolutions(ab, "Bronze", { power: 10 });
  assert.equal(pow10.activeModifiers.length, 4);

  const pow7 = calculateAbilityEvolutions(ab, "Bronze", { power: 7 });
  assert.equal(pow7.activeModifiers.length, 2);
});

test("Rank Transition: Changing rank from Iron -> Bronze -> Iron", () => {
  const ab = createTestAbility();

  const ironRes = calculateAbilityEvolutions(ab, "Iron", { power: 8 });
  assert.equal(ironRes.activeModifiers.length, 0);

  const bronzeRes = calculateAbilityEvolutions(ab, "Bronze", { power: 8 });
  assert.equal(bronzeRes.activeModifiers.length, 3);

  const ironBackRes = calculateAbilityEvolutions(ab, "Iron", { power: 8 });
  assert.equal(ironBackRes.activeModifiers.length, 0);
});

test("Canonical Data Immutability: calculateAbilityEvolutions does not mutate original ability", () => {
  const ab = createTestAbility();
  const originalJSON = JSON.stringify(ab);

  calculateAbilityEvolutions(ab, "Bronze", { power: 15 });

  assert.equal(JSON.stringify(ab), originalJSON);
});

test("Sub-Abilities Integration: ability supports nested sub-abilities with individual roll formulas", () => {
  const ab = createTestAbility({
    subAbilities: [
      {
        id: "sub-1",
        name: "Secondary Strike",
        type: "Melee",
        description: "Deals additional physical damage.",
        cost: 2,
        rollFormula: "POWr * 1.5",
        assignedToQuickRolls: true
      }
    ]
  });

  assert.ok(ab.subAbilities);
  assert.equal(ab.subAbilities.length, 1);
  assert.equal(ab.subAbilities[0].name, "Secondary Strike");
  assert.equal(ab.subAbilities[0].cost, 2);
  assert.equal(ab.subAbilities[0].rollFormula, "POWr * 1.5");
});
