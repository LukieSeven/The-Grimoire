import assert from "node:assert/strict";
import test from "node:test";
import { commitStorageUpdates, type StorageLike } from "../src/lib/persistence.ts";

test("grouped storage writes roll back when a later key fails", () => {
  const values = new Map<string, string>([["first", "old"], ["second", "old"]]);
  let shouldFail = true;
  const storage: StorageLike = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      if (key === "second" && shouldFail) {
        shouldFail = false;
        throw new Error("simulated storage failure");
      }
      values.set(key, value);
    },
    removeItem: key => { values.delete(key); },
  };

  assert.throws(() => commitStorageUpdates(storage, { first: "new", second: "new" }), /simulated/);
  assert.equal(values.get("first"), "old");
  assert.equal(values.get("second"), "old");
});
