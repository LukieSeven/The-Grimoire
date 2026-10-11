import test from "node:test";
import assert from "node:assert/strict";
import { presetEffect } from "../src/lib/preset-effect.ts";
import { blankAbilityInput, blankResult, COMMON_EFFECTS, emptyOptions } from "../src/lib/ability-input.ts";

test("every preloaded Effect can be applied to one combatant without inventing mechanics", () => {
  for (const name of COMMON_EFFECTS) {
    const effect = presetEffect(`common:${name}`, "target-one", emptyOptions())!;
    assert.equal(effect.name, name); assert.equal(effect.targetId, "target-one");
    assert.equal(effect.templateId, `common:${name}`); assert.equal(effect.active, true);
    assert.equal(effect.rules, "");
  }
  assert.equal(presetEffect("common:unknown", "target", emptyOptions()), undefined);
});

test("custom combat Effects retain their complete definition in an independent snapshot", () => {
  const options = emptyOptions(); const definition = blankAbilityInput();
  definition.name = "Test custom effect"; definition.targets = ["Enemy"];
  definition.durationType = "Until Combat Ends";
  definition.results = [{ ...blankResult("Enemy"), rules: "Test-only rules", bonuses: { bonusMovement: -5 }, formula: "END+1" }];
  options.effects = [{ id: "custom", name: definition.name, kind: "Debuff", rules: "Reference", definition }];
  const effect = presetEffect("custom", "target-two", options)!;
  assert.equal(effect.targetId, "target-two"); assert.equal(effect.duration, "Until Combat Ends");
  assert.deepEqual(effect.definition, definition);
  effect.definition!.results[0].rules = "Changed snapshot";
  assert.equal(definition.results[0].rules, "Test-only rules");
  assert.equal(presetEffect("missing", "target", options), undefined);
});
