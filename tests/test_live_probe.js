"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

global.window = global;
require("../web/sha256.js");

const probes = [
  ["clone_graph_identity_v1", 7],
  ["clone_pool_minimal_v1", 5],
  ["clone_mapset_controls_v1", 6],
  ["clone_prefix_matrix_v1", 10],
  ["clone_reference_shift_v1", 7],
  ["clone_object_substitution_v1", 2],
  ["clone_view_buffer_identity_v1", 2],
  ["regexp_unicode_backref_v1", 6],
  ["streams_inventory_v1", 2],
  ["transform_stream_iterator_v1", 1],
  ["marker_round_trip_v1", 1],
  ["array_iterator_short_control_v1", 1],
  ["array_iterator_wrong_type_control_v1", 1],
  ["iterator_sync_marker_control_v1", 1]
];

async function main() {
  for (const [probeId, expectedCount] of probes) {
    const source = fs.readFileSync(path.join(__dirname, "../probes", probeId + ".js"), "utf8");
    const digest = crypto.createHash("sha256").update(source).digest("hex");
    assert.strictEqual(window.FW14_SHA256.hex(source), digest, probeId + " source digest");
    const run = new Function("api", '"use strict";\n' + source);
    const checks = await Promise.resolve(run({
      probe_id: probeId,
      mark: phase => Promise.resolve({phase}),
      markSync: phase => ({phase})
    }));
    assert.strictEqual(checks.length, expectedCount, probeId + " check count");
    for (const check of checks)
      assert.ok(["pass", "unsupported"].includes(check.status), probeId + "/" + check.id);
  }
  const guardedSource = fs.readFileSync(path.join(__dirname, "../probes/transform_stream_type_guard_v2.js"), "utf8");
  const guardedRun = new Function("api", '"use strict";\n' + guardedSource);
  const savedTransformStream = global.TransformStream;
  global.TransformStream = function () { throw new Error("constructor ran after timeout"); };
  try {
    const checks = await guardedRun({
      mark: phase => Promise.resolve({phase}),
      isActive: () => false
    });
    assert.strictEqual(checks[0].details.error, "probe_timeout_before_constructor");
  } finally {
    global.TransformStream = savedTransformStream;
  }
  const fullSource = fs.readFileSync(path.join(__dirname, "../probes/transform_stream_full_sequence_marked_v4.js"), "utf8");
  const fullRun = new Function("api", '"use strict";\n' + fullSource);
  const fullPhases = [];
  global.TransformStream = function () {
    const values = Array.from([1, 2, 3]);
    if (values[1] && values[1].marker === "wrong_native_stream_type")
      throw new TypeError("wrong type");
  };
  try {
    const checks = await fullRun({
      mark: phase => Promise.resolve({phase}),
      markSync: phase => { fullPhases.push(phase); return {phase}; },
      isActive: () => true
    });
    assert.strictEqual(checks[0].status, "pass");
    assert.deepStrictEqual(fullPhases, ["inside_replacement", "third_value", "iterator_done"]);
  } finally {
    global.TransformStream = savedTransformStream;
  }
  const markedSource = fs.readFileSync(path.join(__dirname, "../probes/transform_stream_type_guard_marked_v3.js"), "utf8");
  const markedRun = new Function("api", '"use strict";\n' + markedSource);
  global.TransformStream = function () { throw new Error("constructor ran after timeout"); };
  try {
    const checks = await markedRun({
      mark: phase => Promise.resolve({phase}),
      markSync: phase => ({phase}),
      isActive: () => false
    });
    assert.strictEqual(checks[0].details.error, "probe_timeout_before_constructor");
  } finally {
    global.TransformStream = savedTransformStream;
  }
  const throwSource = fs.readFileSync(path.join(__dirname, "../probes/transform_stream_iterator_throw_v1.js"), "utf8");
  const throwRun = new Function("api", '"use strict";\n' + throwSource);
  const savedIterator = Array.prototype[Symbol.iterator];
  global.TransformStream = function () {
    for (const value of [1, 2, 3]) void value;
  };
  try {
    const checks = await throwRun({
      mark: phase => Promise.resolve({phase}),
      isActive: () => true
    });
    assert.strictEqual(checks[0].status, "pass");
    assert.strictEqual(Array.prototype[Symbol.iterator], savedIterator);
  } finally {
    global.TransformStream = savedTransformStream;
    Array.prototype[Symbol.iterator] = savedIterator;
  }
  console.log("Live probes pass desktop controls and source digest checks");
}

main().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
