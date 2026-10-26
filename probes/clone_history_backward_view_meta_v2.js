// Test whether the same History metadata wrap accepts a view that begins
// 6 MiB before its eight-byte resizable backing store. Metadata only.
function makeKey() {
  var bytes = [0, 0, 0, 0x16, 0x02,
    0x00, 0x00, 0xa0, 0xff, 0xff, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x60, 0, 0, 0, 0, 0,
    0x13, 3, 0, 0xff, 0xff, 0xff, 0xff];
  var chars = [];
  for (var k = 0; k < bytes.length; k += 2)
    chars.push(String.fromCharCode(bytes[k] | bytes[k + 1] << 8));
  return (chars.join("") + "A".repeat(256)).slice(0, 256);
}
var phase = "build";
var result;
try {
  var backing = new ArrayBuffer(8, { maxByteLength: 16 });
  new Uint8Array(backing).fill(0x41);
  var filler = new Array(253);
  filler[0] = BigInt(1) << BigInt(40);
  filler[1] = backing;
  for (var n = 2; n < 27; n++) filler[n] = {};
  for (var j = 27; j < filler.length; j++) filler[j] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  history.replaceState(input, "");
  if (api && typeof api.markSync === "function")
    api.markSync("backward_view_stored");
  phase = "load";
  var output = history.state;
  if (api && typeof api.markSync === "function")
    api.markSync("backward_view_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var valid = synthetic instanceof Uint8Array &&
    synthetic.buffer === target && target.byteLength === 8 &&
    synthetic.length === 6291456 && synthetic.byteOffset > 1e12 &&
    new Uint8Array(target)[0] === 0x41;
  result = { id: "backward_view_meta_v2", status: valid ? "pass" : "fail",
    details: { is_view: synthetic instanceof Uint8Array,
      same_buffer: synthetic instanceof Uint8Array && synthetic.buffer === target,
      view_offset: synthetic instanceof Uint8Array ? synthetic.byteOffset : null,
      view_length: synthetic instanceof Uint8Array ? synthetic.length : null,
      backing_length: target.byteLength,
      backing_canary: new Uint8Array(target)[0] } };
} catch (error) {
  result = { id: "backward_view_meta_v2", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
