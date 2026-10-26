// Read the temporary fragment-node vector, then test a distinct retained element-list slot.
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
  var fixed0 = new ArrayBuffer(65536);
  var fixed1 = new ArrayBuffer(66224);
  new Uint8Array(fixed0).fill(0x91);
  new Uint8Array(fixed1).fill(0x92);
  var filler = new Array(253);
  filler[0] = BigInt(1) << BigInt(40);
  filler[1] = backing;
  filler[2] = fixed0;
  filler[3] = fixed1;
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
  mark("two_slot_stored");
  phase = "load";
  var output = history.state;
  mark("two_slot_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var cloned0 = new Uint8Array(output.filler[2]);
  var cloned1 = new Uint8Array(output.filler[3]);
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12 &&
    target.byteLength === 8 && cloned0.length === 65536 && cloned1.length === 66224;
  var starts = [-1, -1];
  var changed = [0, 0];
  var temp = [];
  var retained = [];
  var listLength = null;
  var swapped = null;
  var restored = null;
  if (valid) {
    phase = "map";
    var limit = 266240;
    var baseline = new Uint8Array(limit);
    for (var b = 0; b < limit; b++) baseline[b] = synthetic[b];
    var views = [cloned0, cloned1];
    var markers = [0x91, 0x92];
    for (var m = 0; m < 2; m++) {
      views[m].fill(0xc4);
      for (var q = 0; q < limit; q++) {
        if (synthetic[q] !== baseline[q]) {
          if (starts[m] < 0) starts[m] = q;
          changed[m]++;
        }
      }
      views[m].fill(markers[m]);
    }
    mark("two_slot_mapped");
    if (changed[0] === 65536 && changed[1] === 66224 &&
        starts[0] >= 0 && starts[1] >= 0) {
      phase = "temporary_vector";
      structuredClone(0, { transfer: [output.filler[2]] });
      var root = document.createElement("div");
      var fragment = document.createDocumentFragment();
      var textNode = document.createTextNode("text-probe");
      fragment.appendChild(textNode);
      for (var d = 0; d < 8191; d++)
        fragment.appendChild(document.createElement("span"));
      root.appendChild(fragment);
      mark("two_slot_fragment_appended");
      for (var t = 0; t < 32; t++) temp.push(synthetic[starts[0] + t]);
      mark("two_slot_temp_read");
      phase = "retained_vector";
      structuredClone(0, { transfer: [output.filler[3]] });
      mark("two_slot_second_detached");
      var list = root.querySelectorAll("span");
      listLength = list.length;
      var firstNode = list.item(0);
      var secondNode = list.item(1);
      for (var r = 0; r < 32; r++) retained.push(synthetic[starts[1] + r]);
      mark("two_slot_list_read");
      var pointerShaped = retained.length === 32 && retained[4] === 2 &&
        retained[5] === 0 && retained[6] === 0 && retained[7] === 0 &&
        retained[12] === 2 && retained[13] === 0 &&
        firstNode !== secondNode;
      if (pointerShaped) {
        phase = "swap_valid_elements";
        try {
          for (var w = 0; w < 8; w++) synthetic[starts[1] + w] = retained[8 + w];
          swapped = list.item(0) === secondNode;
        } finally {
          for (var x = 0; x < 8; x++) synthetic[starts[1] + x] = retained[x];
        }
        restored = list.item(0) === firstNode;
      }
      mark("two_slot_restored");
      if (swapped && restored) window.__fw14NodeState = {view:synthetic,index:starts[1],textBytes:temp.slice(0,8),elementBytes:retained.slice(0,8),list:list,textNode:textNode,firstNode:firstNode};
    }
  }
  result = { id: "two_slot_node_vectors", status: valid && swapped === true && restored === true ? "pass" : "fail", details: {
    view_valid: valid, starts: starts.join(","), changed: changed.join(","),
    temp_bytes: temp.join(","), retained_bytes: retained.join(","),
    list_length: listLength, swapped: swapped, restored: restored,
    first_input: new Uint8Array(fixed0)[0], second_input: new Uint8Array(fixed1)[0],
    target_first: new Uint8Array(target)[0]
  } };
} catch (error) {
  result = { id: "two_slot_node_vectors", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
