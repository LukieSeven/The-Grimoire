import test from "node:test";
import assert from "node:assert/strict";
import { trackedUsageChanges, trackedUsageFromAbility } from "../src/lib/ability-usage.ts";

test("tracked use validates new charges and initializes their remaining count", () => {
  assert.equal(trackedUsageChanges({ mode: "rechargeable", maximum: "" }, null, false).error, "Enter a positive whole number for maximum charges.");
  assert.ok(trackedUsageChanges({ mode: "rechargeable", maximum: "1.5" }, null, true).error);
  assert.deepEqual(trackedUsageChanges({ mode: "rechargeable", maximum: "3" }, null, false).fields, {
    usageType: "rechargeable", maxCharges: 3, currentCharges: 3,
  });
});

test("editing a charged ability does not refill it or discard untouched legacy values", () => {
  const original = { usageType: "rechargeable", maxCharges: 5, currentCharges: 0 };
  assert.deepEqual(trackedUsageChanges(trackedUsageFromAbility(original), original, false), {});
  assert.deepEqual(trackedUsageChanges({ mode: "rechargeable", maximum: "2" }, original, false).fields, {
    usageType: "rechargeable", maxCharges: 2, currentCharges: 0,
  });
  const legacy = { usageType: "Permanent", maxCharges: 0, currentCharges: 0 };
  assert.deepEqual(trackedUsageChanges(trackedUsageFromAbility(legacy), legacy, true), {});
});

test("only inventory items can be configured to consume quantity", () => {
  const usage = { mode: "one-time", maximum: "" } as const;
  assert.ok(trackedUsageChanges(usage, null, false).error);
  assert.deepEqual(trackedUsageChanges(usage, null, true).fields, {
    usageType: "one-time", maxCharges: null, currentCharges: null,
  });
});
