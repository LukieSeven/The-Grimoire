import test from "node:test";
import assert from "node:assert/strict";
import { TRIGGER_CHOICES, evaluateCondition } from "../src/lib/ability-components.ts";
import { showsTriggerInput } from "../src/lib/ability-input.ts";

test("trigger inputs appear for When Triggered and Until Triggered, not other duration choices", () => {
  assert.equal(showsTriggerInput("When Triggered"), true);
  assert.equal(showsTriggerInput("Until Triggered"), true);
  for (const type of ["Always On", "While Active", "Instant", "Time", "Until Dispelled", "", "Custom duration"]) assert.equal(showsTriggerInput(type), false);
});
test("simple trigger choices include resources, custom and standard player-confirmed events", () => {
  for (const choice of ["Resources", "Custom", "Being Attacked", "Ally Being Attacked", "Taking Damage", "Dealing Damage", "Start of Turn", "End of Turn"]) assert.ok(TRIGGER_CHOICES.includes(choice));
  for (const label of TRIGGER_CHOICES.filter(choice => !["Resources", "Custom"].includes(choice))) {
    const condition = { id: label, kind: "situation" as const, label };
    assert.equal(evaluateCondition(condition), "judgment");
    assert.equal(evaluateCondition(condition, undefined, { [label]: true }), "met");
    assert.equal(evaluateCondition(condition, undefined, { [label]: false }), "unmet");
  }
});
test("resource trigger choices still evaluate against the loaded entity values", () => {
  const condition = { id: "resource", kind: "resource" as const, label: "", resource: "mana" as const, operator: "below_value" as const, threshold: 6 };
  const context = { hp: 20, maxHp: 40, mana: 5, maxMana: 30, dt: 2, maxDt: 5 };
  assert.equal(evaluateCondition(condition, context), "met");
  assert.equal(evaluateCondition(condition, { ...context, mana: 12 }), "unmet");
});
