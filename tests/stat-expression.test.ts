import test from "node:test";
import assert from "node:assert/strict";
import { formulaActorRank, requireStatValue, resolveStatExpression } from "../src/lib/stat-expression.ts";

test("Power and Willpower aliases are distinct complete tokens", () => {
  const resolved = resolveStatExpression("willpower+power+WIL+POW", "Willpower + Power + WIL + POW", { power: 9, willpower: 8 }, () => { throw new Error("No stat rolls requested"); });
  assert.equal(resolved.expression, "8+9+8+9");
  assert.equal(resolved.breakdown, "8 + 9 + 8 + 9");
});

test("full rolled-stat aliases cannot collide with another attribute", () => {
  const keys: string[] = [];
  const resolved = resolveStatExpression("willpowerr+powerr+WILr+POWr", "Willpowerr + Powerr + WILr + POWr", { power: 9, willpower: 8 }, (value, key) => {
    keys.push(key);
    return { total: value + 2, breakdown: `(${value}+2)`, isCrit: key === "willpower" };
  });
  assert.equal(resolved.expression, "10+11+10+11");
  assert.equal(resolved.breakdown, "(8+2) + (9+2) + (8+2) + (9+2)");
  assert.deepEqual(keys, ["willpower", "power"]);
  assert.equal(resolved.isCrit, true);
});

test("stat-like substrings in unknown identifiers are never replaced", () => {
  const resolved = resolveStatExpression("willpowerful+power2+empower+wilr2", "willpowerful+power2+empower+wilr2", { power: 9, willpower: 8 }, () => { throw new Error("No valid rolled stat requested"); });
  assert.equal(resolved.expression, "willpowerful+power2+empower+wilr2");
});

test("formula modifiers use the familiar's actual class/rank", () => {
  assert.equal(formulaActorRank({ className: "Bronze" }), "Bronze");
  assert.equal(formulaActorRank({ className: "Silver", rank: "Iron" }), "Silver");
  assert.equal(formulaActorRank({ rank: "Gold" }), "Gold");
  assert.throws(() => formulaActorRank({}));
});

test("missing or non-finite stat data rejects instead of inventing a value", () => {
  for (const value of [undefined, Number.NaN, Infinity, -Infinity]) {
    assert.throws(() => requireStatValue(value, "willpower"));
  }
  assert.equal(requireStatValue(0, "willpower"), 0);
  assert.throws(() => resolveStatExpression("wilr", "wilr", {}, () => ({ total: 1, breakdown: "1", isCrit: false })));
});
