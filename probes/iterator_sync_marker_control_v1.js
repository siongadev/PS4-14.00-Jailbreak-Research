// Confirm a durable marker can be posted from within an ordinary array iterator.
if (!api || typeof api.markSync !== "function")
  return [{ id: "iterator_sync_marker", status: "error", details: { error: "sync_marker_api_unavailable" } }];
var original = Array.prototype[Symbol.iterator];
var markers = 0;
var copied;
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
          api.markSync("inside_array_iterator");
          ++markers;
        }
        return step;
      }
    };
  };
  copied = Array.from([11, 22, 33]);
} finally {
  Array.prototype[Symbol.iterator] = original;
}
return [{
  id: "iterator_sync_marker",
  status: markers === 1 && copied.length === 3 && copied[1] === 22 ? "pass" : "fail",
  details: { markers: markers, copied_length: copied.length }
}];
