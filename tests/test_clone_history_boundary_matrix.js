"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "probes", "clone_history_boundary_matrix_v1.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "probes", manifest.script), "utf8");
const sizes = [3, 128, 129, 130, 144, 160, 192, 224, 240, 248, 255, 256];

function run(faultSize) {
  const seen = [];
  const phases = [];
  const history = {
    saved: null,
    replaceState(value) {
      if (value !== null) {
        seen.push(value.length);
        assert.strictEqual(value[1], value[2]);
        if (value.length > 3) {
          assert.strictEqual(value[0].length, value.length - 3);
          assert.strictEqual(value[0][0], BigInt(1) << BigInt(40));
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
  assert.ok(phases.length <= 6);
  return checks;
}

assert.deepStrictEqual(run(null).map(check => check.status), Array(12).fill("pass"));
const fault = run(129);
assert.deepStrictEqual(fault.map(check => check.status),
  ["pass", "pass", "error", ...Array(9).fill("unsupported")]);
assert.strictEqual(fault[2].details.phase, "load");
console.log("History boundary matrix: order, graph shape, and marker budget verified");
