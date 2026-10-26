// Two arms that should not crash under the public-source null-cast model.
// Arm 1 puts a genuine ReadableStream in the readable slot; arm 2 puts a primitive there.
if (typeof TransformStream !== "function" || typeof ReadableStream !== "function")
  return [
    { id: "cast_genuine_stream", status: "unsupported", details: { reason: "stream_api_unavailable" } },
    { id: "cast_primitive_number", status: "unsupported", details: { reason: "stream_api_unavailable" } }
  ];
if (!api || typeof api.mark !== "function" || typeof api.markSync !== "function" || typeof api.isActive !== "function")
  return [{ id: "probe_error", status: "error", details: { error: "marker_api_unavailable" } }];

function runArm(label, replacementValue) {
  var original = Array.prototype[Symbol.iterator];
  var replacements = 0;
  var outcome = "none";
  var errorName = "none";
  var readableIsSubstitute = false;
  Array.prototype[Symbol.iterator] = function () {
    var iterator = original.call(this);
    if (this.length !== 3)
      return iterator;
    var index = 0;
    return {
      next: function () {
        var step = iterator.next();
        if (!step.done && index++ === 1) {
          ++replacements;
          api.markSync(label + "_replaced");
          return { value: replacementValue, done: false };
        }
        return step;
      }
    };
  };
  try {
    var stream = new TransformStream();
    outcome = "returned";
    readableIsSubstitute = stream.readable === replacementValue;
  } catch (error) {
    outcome = "threw";
    errorName = error && error.name ? String(error.name).slice(0, 64) : "unknown_exception";
  } finally {
    Array.prototype[Symbol.iterator] = original;
  }
  api.markSync(label + "_" + outcome);
  return {
    replacements: replacements,
    outcome: outcome,
    error_name: errorName,
    readable_is_substitute: readableIsSubstitute
  };
}

return api.mark("before_constructor").then(function () {
  if (!api.isActive())
    return [{ id: "probe_error", status: "error", details: { error: "probe_timeout_before_constructor" } }];
  var genuine = new ReadableStream();
  var arm1 = runArm("arm1", genuine);
  var arm2 = runArm("arm2", 7);
  var arm1Pass = arm1.outcome === "returned" && arm1.replacements === 1;
  var arm2Pass = arm2.outcome === "threw" && arm2.error_name === "TypeError" && arm2.replacements === 1;
  return [
    { id: "cast_genuine_stream", status: arm1Pass ? "pass" : "fail", details: arm1 },
    { id: "cast_primitive_number", status: arm2Pass ? "pass" : "fail", details: arm2 }
  ];
});
