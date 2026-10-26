"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "probes", "clone_history_mid_matrix_v1.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "probes", manifest.script), "utf8");
const sizes = [3, 256, 9, 10, 12, 16, 24, 32, 64, 128, 256];

function run(faultSize) {
  const seen = [];
  const phases = [];
  const history = {
    saved: null,
    replaceState(value) {
      if (value !== null) {
        seen.push(value.length);
        assert.strictEqual(value[1], value[2]);
        if (value.length !== 3) {
          assert.strictEqual(value[0].length, value.length - 3);
          assert.strictEqual(typeof value[0][0], seen.length === 2 ? "object" : "bigint");
        }
      }
      this.saved = value;
    },
    get state() {
      if (this.saved.length === faultSize && typeof this.saved[0][0] === "bigint")
        throw new TypeError("Unable to deserialize data.");
      return this.saved;
    }
  };
  const checks = new Function("api", "history", source)(
    { markSync(phase) { phases.push(phase); } }, history);
  assert.deepStrictEqual(checks.map(check => check.id), manifest.check_ids);
  assert.strictEqual(history.saved, null);
  assert.deepStrictEqual(seen, faultSize ? sizes.slice(0, sizes.indexOf(faultSize) + 1) : sizes);
  assert.ok(phases.length <= 6);
  return checks;
}

assert.deepStrictEqual(run(null).map(check => check.status), Array(11).fill("pass"));
const fault = run(16);
assert.deepStrictEqual(fault.map(check => check.status),
  [...Array(5).fill("pass"), "error", ...Array(5).fill("unsupported")]);
assert.strictEqual(fault[5].details.phase, "load");
assert.strictEqual(fault[5].details.cleanup_ok, true);
console.log("Mid History matrix: graph shape and marker budget verified");
