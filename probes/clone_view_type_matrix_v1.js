// Test whether the wrong-buffer reference bypasses view bounds checks by type.
// Every source view is a valid 8-byte window in a 16-byte source buffer.
var variants = [
  { name: "u8", create: function (b) { return new Uint8Array(b, 4, 8); }, short: 11 },
  { name: "u16", create: function (b) { return new Uint16Array(b, 4, 4); }, short: 11 },
  { name: "i32", create: function (b) { return new Int32Array(b, 4, 2); }, short: 11 },
  { name: "f64", create: function (b) { return new Float64Array(b, 8, 1); }, short: 15 },
  { name: "data", create: function (b) { return new DataView(b, 4, 8); }, short: 11 }
];
var checks = [];

for (var index = 0; index < variants.length; index++) {
  var variant = variants[index];
  for (var prefixIndex = 0; prefixIndex < 2; prefixIndex++) {
    var bigint = prefixIndex === 1;
    var id = variant.name + (bigint ? "_bigint" : "_control");
    if (bigint && api && typeof api.markSync === "function")
      api.markSync("before_" + variant.name);
    try {
      var first = new ArrayBuffer(variant.short);
      var second = new ArrayBuffer(16);
      new Uint8Array(first).fill(0x11);
      new Uint8Array(second).fill(0x22);
      var view = variant.create(second);
      var copiedGraph = structuredClone([bigint ? BigInt(23) : 23, first, second, view]);
      var copied = copiedGraph[3];
      var isView = ArrayBuffer.isView(copied);
      var backing = isView ? copied.buffer : null;
      var backingLength = backing ? backing.byteLength : -1;
      var offset = isView ? copied.byteOffset : -1;
      var length = isView ? copied.byteLength : -1;
      var withinBounds = isView && offset + length <= backingLength;
      var correct = backing === copiedGraph[2];
      var wrong = backing === copiedGraph[1];
      checks.push({
        id: id,
        status: isView && correct && !wrong && withinBounds ? "pass" : "fail",
        details: { is_view: isView, correct_buffer: correct, wrong_buffer: wrong,
          offset: offset, length: length, backing_length: backingLength,
          within_bounds: withinBounds }
      });
    } catch (error) {
      checks.push({
        id: id,
        status: "fail",
        details: { error_name: String(error.name || "unknown"),
          error: String(error).slice(0, 160) }
      });
    }
  }
}
return checks;
