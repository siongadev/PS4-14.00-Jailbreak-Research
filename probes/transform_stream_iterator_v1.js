// Observe whether TransformStream construction consults page-controlled Array iteration.
// The replacement delegates to the original iterator and never changes returned values.
if (typeof TransformStream !== "function")
  return [{ id: "iterator_observation", status: "unsupported", details: { reason: "transform_stream_unavailable" } }];

var original = Array.prototype[Symbol.iterator];
var totalCalls = 0;
var lengthThreeCalls = 0;
var constructorResult = "unknown";
try {
  Array.prototype[Symbol.iterator] = function () {
    ++totalCalls;
    if (this.length === 3)
      ++lengthThreeCalls;
    return original.call(this);
  };
  try {
    var stream = new TransformStream();
    constructorResult = stream && stream.readable && stream.writable ? "created" : "incomplete";
  } catch (error) {
    constructorResult = "threw_" + (error && error.name ? error.name : "unknown");
  }
} finally {
  Array.prototype[Symbol.iterator] = original;
}
return [{
  id: "iterator_observation",
  status: "pass",
  details: {
    constructor_result: constructorResult,
    total_array_iterator_calls: totalCalls,
    length_three_iterator_calls: lengthThreeCalls
  }
}];
