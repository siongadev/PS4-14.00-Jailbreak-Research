"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "probes", "clone_webkit_patch_bytes_v1.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "probes", manifest.script), "utf8");
const originalClone = global.structuredClone;
const originalPoint = global.DOMPoint;

class MockPoint {
  constructor(x, y = 0) { this.x = x; this.y = y; }
}

function run(injectError) {
  const arrays = [];
  const phases = [];
  global.DOMPoint = MockPoint;
  global.structuredClone = value => {
    if (Array.isArray(value)) {
      arrays.push(value);
      if (injectError && typeof value[1] === "bigint")
        throw new TypeError("Unable to deserialize data.");
    }
    return value;
  };
  const checks = new Function("api", source)(
    { markSync(phase) { phases.push(phase); } });
  assert.deepStrictEqual(checks.map(check => check.id), manifest.check_ids);
  assert.strictEqual(arrays.length, 2);
  for (const value of arrays) {
    assert.strictEqual(value.length, 258);
    assert.strictEqual(value[0], value[255]);
    assert.strictEqual(value[257].length, 85);
    assert.ok(value[257].slice(0, 66).every(byte => byte === 0));
    assert.deepStrictEqual(Array.from(value[257].slice(66)),
      [0x37, 0x13, 0x00, 0x00, 0x10, 0x06, 0x00, 0x00, 0x80,
        0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21, 0xff, 0xff, 0xff, 0xff]);
  }
  assert.strictEqual(typeof arrays[0][1], "number");
  assert.strictEqual(typeof arrays[1][1], "bigint");
  assert.deepStrictEqual(phases, injectError ? ["bigint_bytes_ready"] :
    ["bigint_bytes_ready", "bigint_bytes_loaded"]);
  return checks;
}

try {
  assert.deepStrictEqual(run(false).map(check => check.status), ["pass", "pass", "pass"]);
  assert.deepStrictEqual(run(true).map(check => check.status), ["pass", "pass", "error"]);
} finally {
  global.structuredClone = originalClone;
  if (originalPoint === undefined) delete global.DOMPoint;
  else global.DOMPoint = originalPoint;
}
console.log("Published WebKit regression bytes: controls and byte pattern verified");
