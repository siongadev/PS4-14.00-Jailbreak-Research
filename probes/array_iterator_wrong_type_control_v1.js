// JavaScript-only control for the wrong-type substitution used by TransformStream.
var original = Array.prototype[Symbol.iterator];
var replacements = 0;
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
          ++replacements;
          return { value: { marker: "wrong_native_stream_type" }, done: false };
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
  id: "wrong_type_iterator",
  status: replacements === 1 && copied.length === 3 && copied[0] === 11 &&
    copied[1] && copied[1].marker === "wrong_native_stream_type" && copied[2] === 33 ? "pass" : "fail",
  details: { replacements: replacements, copied_length: copied.length, middle_type: typeof copied[1] }
}];
