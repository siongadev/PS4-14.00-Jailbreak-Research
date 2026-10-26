"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "probes", "clone_history_tiny_matrix_v1.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "probes", manifest.script), "utf8");

function run(injectError) {
  const seen = [];
  const history = {
    saved: null,
    replaceState(value) {
      if (value !== null) {
        seen.push([value.length, value.length === 3 ? "number" : typeof value[0][0]]);
        assert.strictEqual(value[1], value[2]);
      }
      this.saved = value;
    },
    get state() {
      if (injectError && this.saved.length === 4 && typeof this.saved[0][0] === "bigint")
        throw new TypeError("Unable to deserialize data.");
      return this.saved;
    }
  };
  const checks = new Function("api", "history", source)(
    { markSync() {} }, history);
  assert.deepStrictEqual(checks.map(check => check.id), manifest.check_ids);
  assert.strictEqual(history.saved, null);
  assert.deepStrictEqual(seen, injectError ?
    [[3, "number"], [4, "object"], [4, "bigint"]] :
    [[3, "number"], [4, "object"], [4, "bigint"], [5, "bigint"],
      [8, "bigint"], [16, "bigint"], [32, "bigint"], [64, "bigint"],
      [128, "bigint"], [256, "bigint"]]);
  return checks;
}

assert.deepStrictEqual(run(false).map(check => check.status), Array(10).fill("pass"));
const fault = run(true);
assert.deepStrictEqual(fault.map(check => check.status),
  ["pass", "pass", "error", ...Array(7).fill("unsupported")]);
assert.strictEqual(fault[2].details.phase, "load");
assert.strictEqual(fault[2].details.cleanup_ok, true);
console.log("Tiny History matrix: graph shape and stop-on-error verified");
