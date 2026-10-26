// Control: throw a JavaScript sentinel at the same three-item iteration point.
// No value of the wrong native stream type is handed to WebCore.
if (typeof TransformStream !== "function")
  return [{ id: "iterator_throw", status: "unsupported", details: { reason: "transform_stream_unavailable" } }];
if (!api || typeof api.mark !== "function" || typeof api.isActive !== "function")
  return [{ id: "iterator_throw", status: "error", details: { error: "marker_api_unavailable" } }];

return api.mark("before_iterator_throw").then(function () {
  if (!api.isActive())
    return [{ id: "iterator_throw", status: "error", details: { error: "probe_timeout_before_constructor" } }];
  var original = Array.prototype[Symbol.iterator];
  var sentinel = "stream_iterator_sentinel";
  var throws = 0;
  var caught = "none";
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
            ++throws;
            throw new Error(sentinel);
          }
          return step;
        }
      };
    };
    try {
      new TransformStream();
    } catch (error) {
      caught = error && error.message ? error.message : "unknown_exception";
    }
  } finally {
    Array.prototype[Symbol.iterator] = original;
  }
  return [{
    id: "iterator_throw",
    status: throws === 1 && caught === sentinel ? "pass" : "fail",
    details: { throws: throws, caught: caught }
  }];
});
