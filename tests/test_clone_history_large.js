"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function run(name, faultMode) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "probes", name + ".json"), "utf8"));
  const source = fs.readFileSync(path.join(root, "probes", manifest.script), "utf8");
  assert.strictEqual(manifest.probe_id, name);
  assert.strictEqual(manifest.timeout_ms, 30000);
  const phases = [];
  const shapes = [];
  const history = {
    saved: null,
    replaceState(value) {
      if (value !== null) shapes.push({
        length: value.length,
        first_type: typeof value[0],
        filler_length: Array.isArray(value[0]) ? value[0].length : null,
        filler_first_type: Array.isArray(value[0]) ? typeof value[0][0] : null,
        filler_first_value: Array.isArray(value[0]) && typeof value[0][0] === "bigint" ?
          String(value[0][0]) : null,
        alias: value[1] === value[2],
        tail: value.length === 65536 ? value[0xffff] : null
      });
      this.saved = structuredClone(value);
    },
    get state() {
      const value = structuredClone(this.saved);
      if (faultMode && Array.isArray(value) && value.length === 65536 &&
          typeof value[0][0] === "bigint") {
        if (faultMode === "throw") throw new TypeError("Unable to deserialize data.");
        value.length = 327681;
        value[2] = -64000;
      }
      return value;
    }
  };
  const api = { markSync(phase) { phases.push(phase); } };
  const checks = new Function("api", "history", source)(api, history);
  assert.deepStrictEqual(checks.map(check => check.id), manifest.check_ids);
  assert.strictEqual(checks.length, 2);
  assert.strictEqual(history.saved, null);
  assert.strictEqual(phases.length, faultMode === "throw" ? 1 : 2);
  assert.deepStrictEqual(phases, name === "clone_history_large_control_v1" ?
    ["control_large_ready", "control_large_loaded"] :
    faultMode === "throw" ? ["bigint_large_ready"] :
    ["bigint_large_ready", "bigint_large_loaded"]);
  assert.strictEqual(shapes.length, 2);
  assert.strictEqual(shapes[0].length, 3);
  assert.strictEqual(shapes[0].first_type, "number");
  assert.strictEqual(shapes[0].filler_length, null);
  assert.strictEqual(shapes[1].length, 65536);
  assert.strictEqual(shapes[1].filler_length, 65533);
  assert.strictEqual(shapes[1].tail, -64000);
  assert.ok(shapes.every(shape => shape.alias));
  if (name === "clone_history_large_control_v1") {
    assert.strictEqual(shapes[1].filler_first_type, "object");
  } else {
    assert.strictEqual(shapes[1].filler_first_value, "1099511627776");
  }
  for (const check of checks) {
    assert.ok(["pass", "fail", "error", "unsupported"].includes(check.status));
    assert.ok(Object.keys(check.details).length <= 12);
    assert.strictEqual(check.details.cleanup_ok, true);
    for (const value of Object.values(check.details))
      assert.ok(value === null || ["string", "number", "boolean"].includes(typeof value));
  }
  assert.ok(JSON.stringify(checks).length <= 3600);
  return checks;
}

assert.deepStrictEqual(run("clone_history_large_control_v1", null).map(x => x.status),
  ["pass", "pass"]);
assert.deepStrictEqual(run("clone_history_large_bigint_v1", null).map(x => x.status),
  ["pass", "pass"]);
const fault = run("clone_history_large_bigint_v1", "length");
assert.deepStrictEqual(fault.map(x => x.status), ["pass", "fail"]);
assert.strictEqual(fault[1].details.output_length, 327681);
assert.strictEqual(fault[1].details.output_alias, false);
const thrown = run("clone_history_large_bigint_v1", "throw");
assert.deepStrictEqual(thrown.map(x => x.status), ["pass", "error"]);
assert.strictEqual(thrown[1].details.phase, "load");
console.log("Large History clone probes: ordinary and fault-classification controls passed");
