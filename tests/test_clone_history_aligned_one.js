"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "probes", "clone_history_aligned_one_v1.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "probes", manifest.script), "utf8");

function run(faultMode) {
  const shapes = [];
  const phases = [];
  const history = {
    saved: null,
    replaceState(value) {
      if (value !== null) {
        shapes.push([value.length, value.length > 3 ? typeof value[0][0] : "number"]);
        assert.strictEqual(value[1], value[2]);
        if (value.length > 3) {
          assert.strictEqual(value[0].length, 65533);
          assert.strictEqual(value[65536], -63744);
        }
      }
      this.saved = value;
    },
    get state() {
      if (faultMode && this.saved.length > 3 && typeof this.saved[0][0] === "bigint") {
        if (faultMode === "throw") throw new TypeError("Unable to deserialize data.");
        const output = this.saved.slice();
        output.length = 327682;
        output[2] = 0;
        output[327681] = 1;
        return output;
      }
      return this.saved;
    }
  };
  const checks = new Function("api", "history", source)(
    { markSync(phase) { phases.push(phase); } }, history);
  assert.deepStrictEqual(checks.map(check => check.id), manifest.check_ids);
  assert.deepStrictEqual(shapes, [[3, "number"], [65537, "object"], [65537, "bigint"]]);
  assert.strictEqual(history.saved, null);
  assert.deepStrictEqual(phases, faultMode === "throw" ? ["aligned_one_ready"] :
    ["aligned_one_ready", "aligned_one_loaded"]);
  return checks;
}

assert.deepStrictEqual(run(null).map(check => check.status), ["pass", "pass", "pass"]);
const altered = run("altered");
assert.deepStrictEqual(altered.map(check => check.status), ["pass", "pass", "fail"]);
assert.strictEqual(altered[2].details.output_length, 327682);
assert.strictEqual(altered[2].details.inserted_value, 1);
const thrown = run("throw");
assert.deepStrictEqual(thrown.map(check => check.status), ["pass", "pass", "error"]);
assert.strictEqual(thrown[2].details.phase, "load");
console.log("Aligned History one: shape and result classification verified");
