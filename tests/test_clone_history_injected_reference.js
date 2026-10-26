"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "probes", "clone_history_injected_reference_v1.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "probes", manifest.script), "utf8");

const header = Buffer.alloc(4);
header.writeUInt32LE(0x80001300);
const fakeSuffix = Buffer.concat([
  Buffer.from([0x01, 0x00, 0x10]), header,
  Buffer.from([0, 0, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
]);
assert.strictEqual(fakeSuffix.readUInt32LE(0), 0x00100001);
assert.strictEqual(fakeSuffix[4], 0x13);
assert.strictEqual(fakeSuffix.readUInt32LE(5), 0x8000);
assert.strictEqual(fakeSuffix.readUInt32LE(9), 0xffffffff);
assert.strictEqual(fakeSuffix.readUInt32LE(13), 0xffffffff);

function run(altered) {
  const phases = [];
  const shapes = [];
  const history = {
    saved: null,
    replaceState(value) {
      if (value !== null) {
        shapes.push([value.length, value.length > 3 ? typeof value[0][0] : "number"]);
        assert.strictEqual(value[1], value[2]);
        if (value.length > 3) {
          assert.strictEqual(value[0].length, 65533);
          assert.strictEqual(value[0][32766].marker, 0x6a71c02d);
          assert.strictEqual(value[65536].length, 0x1300);
        }
      }
      this.saved = value;
    },
    get state() {
      if (altered && this.saved.length > 3 && typeof this.saved[0][0] === "bigint") {
        const output = this.saved.slice();
        output.length = 0x100002;
        output[2] = this.saved[0][32765];
        output[0x100001] = this.saved[0][32766];
        return output;
      }
      return this.saved;
    }
  };
  const checks = new Function("api", "history", source)(
    { markSync(phase) { phases.push(phase); } }, history);
  assert.deepStrictEqual(checks.map(check => check.id), manifest.check_ids);
  assert.deepStrictEqual(shapes, [[3, "number"], [65537, "object"], [65537, "bigint"]]);
  assert.deepStrictEqual(phases, ["reference_bigint_ready", "reference_bigint_loaded"]);
  assert.strictEqual(history.saved, null);
  return checks;
}

assert.deepStrictEqual(run(false).map(check => check.status), ["pass", "pass", "pass"]);
const altered = run(true);
assert.deepStrictEqual(altered.map(check => check.status), ["pass", "pass", "fail"]);
assert.strictEqual(altered[2].details.output_length, 0x100002);
assert.strictEqual(altered[2].details.inserted_is_target, true);
assert.strictEqual(altered[2].details.inserted_marker, 0x6a71c02d);
console.log("Injected reference: shape, byte layout and result classification verified");
