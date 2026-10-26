// Crash arm for the null-cast model: a genuine WritableStream in the readable slot.
// The model predicts the readable cast fails and the browser stops before returning.
// Any captured result contradicts the model, so both outcomes below report "fail".
if (typeof TransformStream !== "function" || typeof WritableStream !== "function")
  return [{ id: "cast_writable_stream", status: "unsupported", details: { reason: "stream_api_unavailable" } }];
if (!api || typeof api.mark !== "function" || typeof api.markSync !== "function" || typeof api.isActive !== "function")
  return [{ id: "probe_error", status: "error", details: { error: "marker_api_unavailable" } }];

return api.mark("before_constructor").then(function () {
  if (!api.isActive())
    return [{ id: "probe_error", status: "error", details: { error: "probe_timeout_before_constructor" } }];
  var original = Array.prototype[Symbol.iterator];
  var replacements = 0;
  var outcome = "none";
  var errorName = "none";
  var substitute = new WritableStream();
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
          api.markSync("arm3_replaced");
          return { value: substitute, done: false };
        }
        return step;
      }
    };
  };
  try {
    new TransformStream();
    outcome = "returned";
  } catch (error) {
    outcome = "threw";
    errorName = error && error.name ? String(error.name).slice(0, 64) : "unknown_exception";
  } finally {
    Array.prototype[Symbol.iterator] = original;
  }
  api.markSync("arm3_" + outcome);
  return [{
    id: "cast_writable_stream",
    status: "fail",
    details: { replacements: replacements, outcome: outcome, error_name: errorName }
  }];
});
