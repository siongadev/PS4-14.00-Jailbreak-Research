// Measure two small cloned backing stores and sample their bytes after release.
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
function sample(view, first) {
  var out = [];
  for (var i = 0; i < 64; i += 8) {
    var word = "0x";
    for (var j = 7; j >= 0; j--)
      word += view[first + i + j].toString(16).padStart(2, "0");
    out.push(word);
  }
  return out.join(",");
}
var phase = "build";
var result;
try {
  var size = 4096;
  var backing = new ArrayBuffer(8, { maxByteLength: 16 });
  new Uint8Array(backing).fill(0x41);
  var originalA = new ArrayBuffer(size);
  var originalB = new ArrayBuffer(size);
  new Uint8Array(originalA).fill(0x91);
  new Uint8Array(originalB).fill(0x92);
  var filler = new Array(253);
  filler[0] = BigInt(1) << BigInt(40);
  filler[1] = backing;
  filler[2] = originalA;
  filler[3] = originalB;
  for (var n = 4; n < 27; n++) {
    var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(neighbor).fill(0x40 + n);
    filler[n] = neighbor;
  }
  for (var f = 27; f < filler.length; f++) filler[f] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  history.replaceState(input, "");
  mark("small_pair_stored");
  phase = "load";
  var output = history.state;
  mark("small_pair_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var clones = [new Uint8Array(output.filler[2]),
                new Uint8Array(output.filler[3])];
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
      synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
      target.byteLength === 8 && clones[0].length === size &&
      clones[1].length === size;
  var firsts = [-1, -1];
  var counts = [0, 0];
  var before = [null, null];
  var afterSecond = null;
  var afterBoth = [null, null];
  var detached = [false, false];
  var mapped = false;
  if (valid) {
    phase = "map";
    var limit = 524288;
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
    mapped = firsts[0] >= 0 && firsts[1] >= 0 &&
      firsts[0] !== firsts[1] && counts[0] === size && counts[1] === size &&
      firsts[0] + size <= limit && firsts[1] + size <= limit &&
      synthetic[firsts[0]] === 0x91 &&
      synthetic[firsts[0] + size - 1] === 0x91 &&
      synthetic[firsts[1]] === 0x92 &&
      synthetic[firsts[1] + size - 1] === 0x92;
    if (mapped) {
      mark("small_pair_mapped");
      before[0] = sample(synthetic, firsts[0]);
      before[1] = sample(synthetic, firsts[1]);
      phase = "release_second";
      structuredClone(0, { transfer: [output.filler[3]] });
      detached[1] = clones[1].length === 0;
      mark("small_pair_second_released");
      afterSecond = sample(synthetic, firsts[1]);
      phase = "release_first";
      structuredClone(0, { transfer: [output.filler[2]] });
      detached[0] = clones[0].length === 0;
      mark("small_pair_first_released");
      afterBoth[0] = sample(synthetic, firsts[0]);
      afterBoth[1] = sample(synthetic, firsts[1]);
    }
  }
  result = { id: "small_free_pair", status:
      valid && mapped && detached[0] && detached[1] ? "pass" : "fail",
    details: {
      view_valid: valid, mapped: mapped, first_indices: firsts.join(","),
      changed_counts: counts.join(","), detached: detached.join(","),
      before_first: before[0], before_second: before[1],
      after_second_release: afterSecond,
      after_both_first: afterBoth[0], after_both_second: afterBoth[1],
      target_first: new Uint8Array(target)[0],
      original_markers: new Uint8Array(originalA)[0] + "," +
          new Uint8Array(originalB)[0]
    } };
} catch (error) {
  result = { id: "small_free_pair", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error =
    String(error).slice(0, 100); }
return [result];
