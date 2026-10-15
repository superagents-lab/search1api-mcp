import assert from "node:assert/strict";
import test from "node:test";
import { findDrift } from "../scripts/sync-versions.mjs";

test("every versioned manifest matches package.json", () => {
  assert.deepEqual(
    findDrift(),
    [],
    "Run `npm run sync:versions` (npm version does this automatically)"
  );
});
