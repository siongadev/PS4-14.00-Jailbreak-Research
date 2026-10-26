"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(
  path.join(root, "probes", "clone_history_inrange_anchor_groom_v2.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "probes", manifest.script), "utf8");
const base = 0x200100000;
const markerOffset = 64;
const word = BigInt(base + markerOffset - 8);
const anchor = { marker: 0 };
const state = { array: [anchor], a: anchor, index: 1000, groomBatches: [] };
state.view = new Proxy({}, {
  get(_target, key) {
    const offset = Number(key);
    if (offset >= markerOffset && offset < markerOffset + 4) {
      const object = state.groomBatches[0][0];
      return object ? (object.marker >>> ((offset - markerOffset) * 8)) & 0xff : 0;
    }
    if (offset >= state.index && offset < state.index + 8)
      return Number((word >> BigInt((offset - state.index) * 8)) & 0xffn);
    return 0;
  }
});

global.window = { __fw14ArrayState: state };
const phases = [];
const [check] = new Function("api", source)({ markSync(phase) { phases.push(phase); } });
delete global.window;

assert.deepStrictEqual(manifest.check_ids, [check.id]);
assert.strictEqual(check.status, "pass");
assert.strictEqual(check.details.found, true);
assert.strictEqual(check.details.found_word, "0x" + word.toString(16).padStart(16, "0"));
assert.strictEqual(check.details.found_index, markerOffset);
assert.strictEqual(check.details.found_base, "0x" + base.toString(16));
assert.strictEqual(state.calibratedViewBase, base);
assert.strictEqual(state.array[0], anchor);
assert.deepStrictEqual(phases, ["groom_batch_1"]);
assert.ok(Object.keys(check.details).length <= 12);
assert.ok(Object.values(check.details).every(value =>
  value === null || ["string", "number", "boolean"].includes(typeof value)));
console.log("In-range anchor groom emits a collector-valid success report");
