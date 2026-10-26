"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "probes", "clone_history_size_ladder_v1.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "probes", manifest.script), "utf8");
const sizes = [3, 256, 4096, 16384, 32768, 65535, 65536];

function run(faultSize) {
  const seen = [];
  const phases = [];
  const history = {
    saved: null,
    replaceState(value) {
      if (value !== null) {
        const size = value.length;
        seen.push(size);
        assert.strictEqual(value[1], value[2]);
        if (size > 3) {
          assert.strictEqual(value[0].length, size - 3);
          assert.strictEqual(value[0][0], BigInt(1) << BigInt(40));
          assert.strictEqual(value[size - 1], -64000);
        }
      }
      this.saved = value;
    },
    get state() {
      if (this.saved.length === faultSize)
        throw new TypeError("Unable to deserialize data.");
      return this.saved;
    }
  };
  const checks = new Function("api", "history", source)(
    { markSync(phase) { phases.push(phase); } }, history);
  assert.deepStrictEqual(checks.map(check => check.id), manifest.check_ids);
  assert.strictEqual(history.saved, null);
  assert.deepStrictEqual(seen, faultSize ? sizes.slice(0, sizes.indexOf(faultSize) + 1) : sizes);
  assert.ok(phases.includes("bigint_size_256_ready"));
  assert.strictEqual(phases.includes("bigint_size_32768_loaded"), faultSize !== 32768);
  for (const check of checks)
    assert.ok(["pass", "error", "unsupported"].includes(check.status));
  return checks;
}

assert.deepStrictEqual(run(null).map(check => check.status), Array(7).fill("pass"));
const fault = run(32768);
assert.deepStrictEqual(fault.map(check => check.status),
  ["pass", "pass", "pass", "pass", "error", "unsupported", "unsupported"]);
assert.strictEqual(fault[4].details.phase, "load");
assert.strictEqual(fault[4].details.cleanup_ok, true);
console.log("History size ladder: graph shape, ordering, and stop-on-error verified");
