// Locate the live fixed-buffer slot, transfer its owner, and check whether the slot moves.
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
  mark("fixed_move_ready");
  phase = "store";
  history.replaceState(input, "");
  mark("fixed_move_stored");
  phase = "load";
  var output = history.state;
  mark("fixed_move_loaded");
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
  var afterMovedWrite = null;
  var afterMovedRestore = null;
  var movedNormal = null;
  var movedLength = null;
  var oldLength = null;
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
    cloned.fill(0x91);
    mark("fixed_move_located");
    if (changes === 65536 && first >= 0 && synthetic[first] === 0x91) {
      phase = "transfer";
      before = synthetic[first];
      var moved = structuredClone(output.filler[2], { transfer: [output.filler[2]] });
      var movedView = new Uint8Array(moved);
      movedLength = movedView.length;
      oldLength = cloned.length;
      mark("fixed_move_transferred");
      phase = "write_moved";
      movedView[0] = 0xd7;
      afterMovedWrite = synthetic[first];
      movedNormal = movedView[0];
      movedView[0] = 0x91;
      afterMovedRestore = synthetic[first];
      mark("fixed_move_restored");
    }
  }
  var expected = valid && changes === 65536 && before === 0x91 &&
    movedLength === 65536 && oldLength === 0 && movedNormal === 0xd7 &&
    afterMovedWrite === 0xd7 && afterMovedRestore === 0x91;
  result = { id: "fixed_transfer_alias", status: expected ? "pass" : "fail", details: {
    view_valid: valid, first_index: first, changed_bytes: changes,
    before: before, moved_length: movedLength, old_length: oldLength,
    moved_normal_after: movedNormal, forged_after_moved_write: afterMovedWrite,
    forged_after_restore: afterMovedRestore,
    original_first: new Uint8Array(fixed)[0],
    target_first: new Uint8Array(target)[0]
  } };
} catch (error) {
  result = { id: "fixed_transfer_alias", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
try { history.replaceState(null, ""); }
catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
return [result];
