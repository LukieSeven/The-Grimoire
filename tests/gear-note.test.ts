import test from "node:test";
import assert from "node:assert/strict";
import { readGearNote } from "../src/lib/gear-note.ts";

test("gear-note copy preserves multiline descriptions and complete formulas", () => {
  const note = [
    "Description: A weathered blade.",
    "It has a wrapped grip.",
    "",
    "Other rules: Follow the linked ability.",
    "Dice: Only roll for the fire effect.",
    "Dice: 2d6 + POWm",
    "Modifier: 0",
    "DT Bonus: 2 + WILm",
    'Stat Modifiers: {"power": "VITm", "agility": -1}',
  ].join("\r\n");
  assert.deepEqual(readGearNote(note), {
    description: "A weathered blade.\r\nIt has a wrapped grip.\r\n\r\nOther rules: Follow the linked ability.\r\nDice: Only roll for the fire effect.",
    diceType: "2d6 + POWm",
    modifier: "0",
    dtBonus: "2 + WILm",
    statModifiers: { power: "VITm", agility: -1 },
  });
});

test("plain item notes and legacy blank modifiers remain compatible", () => {
  const plain = "A belt pouch.\nAn extra compartment inside.";
  assert.equal(readGearNote(plain).description, plain);
  assert.equal(readGearNote("Description: A ritual pouch.\nDice: A decorative motif.").description, "A ritual pouch.\nDice: A decorative motif.");
  const abbreviated = readGearNote("Description: Old armor.\nSecond line.\nDT Bonus: 2 + WILm", true);
  assert.equal(abbreviated.description, "Old armor.\nSecond line.");
  assert.equal(abbreviated.dtBonus, "2 + WILm");
  const old = readGearNote("Description: \nDice: d6\nModifier: None\nDT Bonus: -2\nStat Modifiers: invalid");
  assert.equal(old.description, "");
  assert.equal(old.diceType, "d6");
  assert.equal(old.modifier, "");
  assert.equal(old.dtBonus, "-2");
  assert.equal(old.statModifiers, undefined);
});
