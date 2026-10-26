// One-shot abnormal iterator: present only one value from the internal three-item tuple.
// This may trigger a browser failure; run only with an observer and a separate normal control.
if (typeof TransformStream !== "function")
  return [{ id: "short_sequence", status: "unsupported", details: { reason: "transform_stream_unavailable" } }];
if (!api || typeof api.mark !== "function" || typeof api.isActive !== "function")
  return [{ id: "short_sequence", status: "error", details: { error: "marker_api_unavailable" } }];

return api.mark("before_constructor").then(function () {
  if (!api.isActive())
    return [{ id: "short_sequence", status: "error", details: { error: "probe_timeout_before_constructor" } }];
  var original = Array.prototype[Symbol.iterator];
  var shortened = 0;
  var result = "returned";
  try {
    Array.prototype[Symbol.iterator] = function () {
      var iterator = original.call(this);
      if (this.length !== 3)
        return iterator;
      var index = 0;
      return {
        next: function () {
          if (index++ === 0)
            return iterator.next();
          ++shortened;
          return { done: true };
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
    id: "short_sequence",
    status: shortened === 1 && result === "TypeError" ? "pass" : "fail",
    details: { shortened: shortened, result: result }
  }];
});
