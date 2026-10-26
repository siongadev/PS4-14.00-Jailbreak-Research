// One-shot check that the three-item iterator completes before a wrong-type failure.
if (typeof TransformStream !== "function")
  return [{ id: "full_sequence_type_guard", status: "unsupported", details: { reason: "transform_stream_unavailable" } }];
if (!api || typeof api.mark !== "function" || typeof api.markSync !== "function" || typeof api.isActive !== "function")
  return [{ id: "full_sequence_type_guard", status: "error", details: { error: "marker_api_unavailable" } }];

return api.mark("before_constructor").then(function () {
  if (!api.isActive())
    return [{ id: "full_sequence_type_guard", status: "error", details: { error: "probe_timeout_before_constructor" } }];
  var original = Array.prototype[Symbol.iterator];
  var replacements = 0;
  var result = "returned";
  try {
    Array.prototype[Symbol.iterator] = function () {
      var iterator = original.call(this);
      if (this.length !== 3)
        return iterator;
      var index = 0;
      return {
        next: function () {
          var step = iterator.next();
          if (step.done) {
            if (index === 3)
              api.markSync("iterator_done");
            return step;
          }
          if (index === 1) {
            api.markSync("inside_replacement");
            ++replacements;
            ++index;
            return { value: { marker: "wrong_native_stream_type" }, done: false };
          }
          if (index === 2)
            api.markSync("third_value");
          ++index;
          return step;
        }
      };
    };
    try {
      new TransformStream();
    } catch (error) {
      result = error && error.name ? error.name : "unknown_exception";
    }
  } finally {
    Array.prototype[Symbol.iterator] = original;
  }
  return [{
    id: "full_sequence_type_guard",
    status: replacements === 1 && result === "TypeError" ? "pass" : "fail",
    details: { replacements: replacements, result: result }
  }];
});
