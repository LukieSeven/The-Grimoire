import test from "node:test";
import assert from "node:assert/strict";
import { resolveDiceExpression } from "../src/lib/dice-expression.ts";

test("20D6 rolls twenty independent six-sided dice, not one D20", () => {
  let calls = 0;
  const low = resolveDiceExpression("20D6", "20D6", sides => {
    assert.equal(sides, 6);
    calls++;
    return { result: 1, isCrit: false };
  });
  assert.equal(calls, 20);
  assert.equal(low.result, 20);
  assert.equal(low.breakdown, `(${Array(20).fill(1).join("+")})`);
  const high = resolveDiceExpression("20d6", "20d6", sides => ({ result: sides, isCrit: true }));
  assert.equal(high.result, 120);
  assert.equal(high.isCrit, true);
  assert.equal(high.criticalDice.length, 20);
  assert.ok(high.criticalDice.every(die => die.sides === 6));
});

test("every critical is retained with its actual die size", () => {
  const values = [6, 2, 6, 8, 1];
  const roll = resolveDiceExpression("3d6+2d8", "3d6+2d8", sides => {
    const result = values.shift()!;
    return { result, isCrit: result === sides };
  });
  assert.deepEqual(roll.criticalDice, [{ sides: 6 }, { sides: 6 }, { sides: 8 }]);
});

test("multiple mixed-case dice terms retain counts and arithmetic precedence", () => {
  const values = [1, 2, 3, 4, 5, 4];
  const sidesSeen: number[] = [];
  const rolled = resolveDiceExpression("2d6*3+2D8-d20+D4", "2d6*3+2D8-d20+D4", sides => {
    sidesSeen.push(sides);
    const result = values.shift()!;
    return { result, isCrit: result === sides };
  });
  assert.deepEqual(sidesSeen, [6, 6, 8, 8, 20, 4]);
  assert.equal(rolled.result, 15);
  assert.equal(rolled.breakdown, "(1+2)*3+(3+4)-5+4");
});

test("changing token lengths cannot skip or partially replace later dice", () => {
  let calls = 0;
  const rolled = resolveDiceExpression("d20+d20+d6+d60", "D20+D20+D6+D60", () => {
    calls++;
    return { result: 1, isCrit: false };
  });
  assert.equal(calls, 4);
  assert.equal(rolled.result, 4);
  assert.equal(rolled.breakdown, "1+1+1+1");
});

test("resolved stat breakdowns are retained alongside counted dice", () => {
  const rolled = resolveDiceExpression("2d6+9*2", "2d6+4+5*2", () => ({ result: 3, isCrit: false }));
  assert.equal(rolled.result, 24);
  assert.equal(rolled.breakdown, "(3+3)+4+5*2");
});

test("single-die and arithmetic-only formulas remain supported", () => {
  const rolled = resolveDiceExpression("D12", "D12", sides => ({ result: sides, isCrit: true }));
  assert.equal(rolled.result, 12);
  assert.equal(rolled.isCrit, true);
  const math = resolveDiceExpression("(9+2)/2", "(9+2)/2", () => { throw new Error("No dice requested"); });
  assert.equal(math.result, 5);
});

test("display whitespace cannot leave an old count in the rolled breakdown", () => {
  const rolled = resolveDiceExpression("2d6", "2 D 6", () => ({ result: 3, isCrit: false }));
  assert.equal(rolled.result, 6);
  assert.equal(rolled.breakdown, "(3+3)");
});

test("malformed dice and arithmetic reject instead of logging invented results", () => {
  for (const expression of ["", "0d6", "d0", "1.5d6", "d6.5", "d6foo", "d6d8", "d-6", "2d", "d6+", "d6;1", "1/0", "0/0"]) {
    assert.throws(() => resolveDiceExpression(expression, expression, () => ({ result: 1, isCrit: false })), expression);
  }
});
