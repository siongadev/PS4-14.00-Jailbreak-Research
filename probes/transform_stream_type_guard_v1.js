// One-shot check of the native type guard for the JS-created internal stream tuple.
// A patched implementation should reject the replacement with TypeError.
// An unpatched native dereference may terminate the browser before a capture is sent.
if (typeof TransformStream !== "function")
  return [{ id: "type_guard", status: "unsupported", details: { reason: "transform_stream_unavailable" } }];

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
  id: "type_guard",
  status: replacements === 1 && result === "TypeError" ? "pass" : "fail",
  details: { replacements: replacements, result: result }
}];
