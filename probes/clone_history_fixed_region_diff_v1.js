// Find live fixed-buffer aliases at any offset in the first four mapped regions.
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
  var original = new Uint8Array(fixed);
  original.fill(0x91);
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
  mark("fixed_diff_ready");
  phase = "store";
  history.replaceState(input, "");
  mark("fixed_diff_stored");
  phase = "load";
  var output = history.state;
  mark("fixed_diff_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var cloned = new Uint8Array(output.filler[2]);
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12;
  var regionLength = 262144;
  var baseline = null;
  var originalChanges = 0;
  var originalFirst = -1;
  var originalLast = -1;
  var cloneChanges = 0;
  var cloneFirst = -1;
  var cloneLast = -1;
  if (valid) {
    phase = "baseline";
    baseline = new Uint8Array(regionLength);
    mark("fixed_diff_before_baseline");
    for (var k = 0; k < regionLength; k++) baseline[k] = synthetic[k];
    mark("fixed_diff_baseline_done");
    phase = "original_fill";
    original.fill(0xa7);
    for (var a = 0; a < regionLength; a++) {
      if (synthetic[a] !== baseline[a]) {
        originalChanges++;
        if (originalFirst < 0) originalFirst = a;
        originalLast = a;
      }
    }
    original.fill(0x91);
    mark("fixed_diff_original_done");
    phase = "clone_fill";
    cloned.fill(0xc4);
    for (var b = 0; b < regionLength; b++) {
      if (synthetic[b] !== baseline[b]) {
        cloneChanges++;
        if (cloneFirst < 0) cloneFirst = b;
        cloneLast = b;
      }
    }
    cloned.fill(0x91);
    mark("fixed_diff_clone_done");
  }
  result = { id: "fixed_region_diff", status: valid ? "pass" : "fail", details: {
    view_valid: valid,
    region_length: regionLength,
    original_changes: originalChanges,
    original_first: originalFirst,
    original_last: originalLast,
    clone_changes: cloneChanges,
    clone_first: cloneFirst,
    clone_last: cloneLast,
    original_first_byte: original[0],
    cloned_first_byte: cloned[0],
    target_first: new Uint8Array(target)[0]
  } };
} catch (error) {
  result = { id: "fixed_region_diff", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
