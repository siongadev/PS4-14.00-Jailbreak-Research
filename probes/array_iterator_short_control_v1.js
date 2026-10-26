// JavaScript-only control: shorten a three-item array's iterator without using TransformStream.
var original = Array.prototype[Symbol.iterator];
var shortened = 0;
var copied;
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
  copied = Array.from([11, 22, 33]);
} finally {
  Array.prototype[Symbol.iterator] = original;
}
return [{
  id: "short_iterator",
  status: shortened === 1 && copied.length === 1 && copied[0] === 11 ? "pass" : "fail",
  details: { shortened: shortened, copied_length: copied.length, first: copied[0] }
}];
