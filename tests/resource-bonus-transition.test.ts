import test from "node:test";
import assert from "node:assert/strict";
import { removeResourceBonus } from "../src/lib/resource-bonus-transition.ts";
test("ending a bonus removes it from a full or partially spent resource", () => {
  assert.equal(removeResourceBonus(37, 37, 27), 27);
  assert.equal(removeResourceBonus(22, 37, 27), 12);
  assert.equal(removeResourceBonus(3, 37, 27), 0);
});
test("unrelated changes leave resources alone and removing a debuff reverses its contribution", () => {
  assert.equal(removeResourceBonus(17, 27, 27), 17);
  assert.equal(removeResourceBonus(17, 27, 37), 27);
});
test("repeated free activations and deactivations preserve original mana", () => {
  let mana = 60;
  for (let index = 0; index < 10; index++) {
    mana = removeResourceBonus(mana, 100, 110);
    assert.equal(mana, 70);
    mana = removeResourceBonus(mana, 110, 100);
    assert.equal(mana, 60);
  }
});
test("activation adds the bonus and subtracts only the assigned cost", () => {
  const active = removeResourceBonus(60 - 8, 100, 110);
  assert.equal(active, 62);
  assert.equal(removeResourceBonus(active, 110, 100), 52);
});
