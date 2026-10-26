"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const probesDir = path.join(__dirname, "../probes");
const phaseName = /^[a-z][a-z0-9_]{0,31}$/;

function load(name) {
  return fs.readFileSync(path.join(probesDir, name + ".js"), "utf8");
}

function manifest(name) {
  return JSON.parse(fs.readFileSync(path.join(probesDir, name + ".json"), "utf8"));
}

function harness(name, options) {
  const phases = [];
  const api = {
    mark: phase => { phases.push(phase); return Promise.resolve({ phase }); },
    markSync: phase => { phases.push(phase); return { phase }; },
    isActive: () => options.active !== false
  };
  return { run: new Function("api", '"use strict";\n' + load(name)), api, phases };
}

// Model of the public 616-1300 path (TransformStream.cpp:114-117). The builtin result is
// iterated once through Array.from, as SequenceConverter does; the cast on items[1] is
// unchecked, so a non-ReadableStream dereferences null. Index loops avoid a second
// iteration, which would consume the overridden iterator again.
function modelTransformStream(options) {
  return function TransformStreamModel() {
    const results = [{ marker: "transformer" }, new ReadableStream(), new WritableStream()];
    const items = Array.from(results);
    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      if (options.idlRejectsPrimitives !== false &&
          (item === null || (typeof item !== "object" && typeof item !== "function")))
        throw new TypeError("not an object");
    }
    if (!(items[1] instanceof ReadableStream))
      throw new Error("model null dereference");
    return { readable: items[1], writable: items[2] };
  };
}

function assertPhases(phases) {
  for (const phase of phases)
    assert.ok(phaseName.test(phase), "invalid marker phase: " + phase);
}

(async () => {
  const savedTransformStream = global.TransformStream;
  const savedIterator = Array.prototype[Symbol.iterator];
  try {
    const discriminatorIds = manifest("transform_stream_cast_discriminator_v1").check_ids;
    const writableIds = manifest("transform_stream_cast_writable_arm_v1").check_ids;
    assert.deepStrictEqual(discriminatorIds, ["cast_genuine_stream", "cast_primitive_number"]);
    assert.deepStrictEqual(writableIds, ["cast_writable_stream"]);
    for (const name of ["transform_stream_cast_discriminator_v1", "transform_stream_cast_writable_arm_v1"]) {
      const m = manifest(name);
      assert.strictEqual(m.probe_id, name);
      assert.strictEqual(m.script, name + ".js");
      assert.ok(m.timeout_ms > 0 && m.timeout_ms <= 10000);
    }

    global.TransformStream = modelTransformStream({});
    let h = harness("transform_stream_cast_discriminator_v1", {});
    let checks = await h.run(h.api);
    assert.deepStrictEqual(checks.map(c => c.id), discriminatorIds);
    assert.deepStrictEqual(checks.map(c => c.status), ["pass", "pass"]);
    assert.deepStrictEqual(checks[0].details, {
      replacements: 1, outcome: "returned", error_name: "none", readable_is_substitute: true
    });
    assert.deepStrictEqual(checks[1].details, {
      replacements: 1, outcome: "threw", error_name: "TypeError", readable_is_substitute: false
    });
    assert.deepStrictEqual(h.phases, [
      "before_constructor", "arm1_replaced", "arm1_returned", "arm2_replaced", "arm2_threw"
    ]);
    assertPhases(h.phases);
    assert.strictEqual(Array.prototype[Symbol.iterator], savedIterator);

    global.TransformStream = modelTransformStream({ idlRejectsPrimitives: false });
    h = harness("transform_stream_cast_discriminator_v1", {});
    checks = await h.run(h.api);
    assert.strictEqual(checks[0].status, "pass");
    assert.strictEqual(checks[1].status, "fail");
    assert.strictEqual(checks[1].details.error_name, "Error");
    assert.strictEqual(Array.prototype[Symbol.iterator], savedIterator);

    global.TransformStream = modelTransformStream({});
    h = harness("transform_stream_cast_writable_arm_v1", {});
    checks = await h.run(h.api);
    assert.deepStrictEqual(checks.map(c => c.id), writableIds);
    assert.strictEqual(checks[0].status, "fail");
    assert.deepStrictEqual(checks[0].details, { replacements: 1, outcome: "threw", error_name: "Error" });
    assert.deepStrictEqual(h.phases, ["before_constructor", "arm3_replaced", "arm3_threw"]);
    assertPhases(h.phases);
    assert.strictEqual(Array.prototype[Symbol.iterator], savedIterator);

    global.TransformStream = function () { return {}; };
    h = harness("transform_stream_cast_writable_arm_v1", {});
    checks = await h.run(h.api);
    assert.strictEqual(checks[0].status, "fail");
    assert.strictEqual(checks[0].details.outcome, "returned");

    global.TransformStream = undefined;
    h = harness("transform_stream_cast_discriminator_v1", {});
    checks = await h.run(h.api);
    assert.deepStrictEqual(checks.map(c => c.status), ["unsupported", "unsupported"]);

    global.TransformStream = function () { throw new Error("constructor ran after timeout"); };
    h = harness("transform_stream_cast_discriminator_v1", { active: false });
    checks = await h.run(h.api);
    assert.strictEqual(checks[0].id, "probe_error");
    assert.strictEqual(checks[0].details.error, "probe_timeout_before_constructor");

    const discriminatorSource = load("transform_stream_cast_discriminator_v1");
    assert.ok(!/WritableStream/.test(discriminatorSource),
      "the crash-arm stream must stay out of the discriminator probe");
  } finally {
    global.TransformStream = savedTransformStream;
    Array.prototype[Symbol.iterator] = savedIterator;
  }
  console.log("TransformStream cast discriminator dry checks passed");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
