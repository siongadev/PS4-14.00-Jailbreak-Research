// One-shot wrong-type probe with durable markers before construction and inside iteration.
if (typeof TransformStream !== "function")
  return [{ id: "type_guard_marked", status: "unsupported", details: { reason: "transform_stream_unavailable" } }];
if (!api || typeof api.mark !== "function" || typeof api.markSync !== "function" || typeof api.isActive !== "function")
  return [{ id: "type_guard_marked", status: "error", details: { error: "marker_api_unavailable" } }];

return api.mark("before_constructor").then(function () {
  if (!api.isActive())
    return [{ id: "type_guard_marked", status: "error", details: { error: "probe_timeout_before_constructor" } }];
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
          if (!step.done && index++ === 1) {
            api.markSync("inside_replacement");
            ++replacements;
            return { value: { marker: "wrong_native_stream_type" }, done: false };
          }
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
    id: "type_guard_marked",
    status: replacements === 1 && result === "TypeError" ? "pass" : "fail",
    details: { replacements: replacements, result: result }
  }];
});
