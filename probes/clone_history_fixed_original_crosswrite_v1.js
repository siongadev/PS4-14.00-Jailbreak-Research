// Check whether the observed fixed-buffer marker aliases the original source buffer.
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
    var fixed = new ArrayBuffer(65536);
    new Uint8Array(fixed).fill(0x91);
    var filler = new Array(253);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : 0;
    filler[1] = backing;
    filler[2] = fixed;
    for (var i = 3; i < 27; i++) {
      var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
      new Uint8Array(neighbor).fill(0x40 + i);
      filler[i] = neighbor;
    }
    for (var j = 27; j < filler.length; j++) filler[j] = {};
    var shared = { marker: 0x51515151 };
    var key = makeKey();
    var input = {};
    input.filler = filler;
    input.first = shared;
    input.second = shared;
    input[key] = 0;
    if (useBigInt) mark("fixed_alias_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt) mark("fixed_alias_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt) mark("fixed_alias_loaded");
    phase = "inspect";
    var target = output.filler[1];
    var synthetic = output["\u0000"];
    var normal = new Uint8Array(fixed);
    var cloned = new Uint8Array(output.filler[2]);
    var viewValid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
      synthetic.byteOffset === 8 && synthetic.length > 1e12;
    var stride = -1;
    var initialRemote = null;
    var afterNormalChange = null;
    var afterSyntheticChange = null;
    var normalAfterSynthetic = null;
    var restored = null;
    if (useBigInt && viewValid) {
      mark("fixed_alias_before_read");
      phase = "locate_fixed";
      for (var n = 0; n < 8; n++) {
        var position = 65528 + 65536 * n;
        if (synthetic[position] === 0x91) {
          stride = n + 1;
          initialRemote = synthetic[position];
          break;
        }
      }
      if (stride > 0) {
        var index = 65528 + 65536 * (stride - 1);
        phase = "normal_fixed_write";
        normal[0] = 0xa7;
        afterNormalChange = synthetic[index];
        mark("fixed_alias_normal_changed");
        if (afterNormalChange === 0xa7) {
          phase = "synthetic_fixed_write";
          synthetic[index] = 0xc4;
          afterSyntheticChange = synthetic[index];
          normalAfterSynthetic = normal[0];
          mark("fixed_alias_crosswritten");
          phase = "restore_fixed";
          synthetic[index] = 0x91;
          restored = normal[0];
          mark("fixed_alias_restored");
        } else {
          normal[0] = 0x91;
        }
      }
      phase = "inspect";
    }
    var expected = useBigInt ? viewValid && initialRemote === 0x91 &&
      afterNormalChange === 0xa7 && afterSyntheticChange === 0xc4 &&
      normalAfterSynthetic === 0xc4 && restored === 0x91 :
      output.first === output.second && Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      view_valid: viewValid,
      backing_length: target.byteLength,
      fixed_length: normal.length,
      fixed_stride: stride,
      initial_remote: initialRemote,
      after_normal_change: afterNormalChange,
      after_synthetic_change: afterSyntheticChange,
      normal_after_synthetic: normalAfterSynthetic,
      restored: restored,
      cloned_first: cloned[0],
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
var control = runCase("fixed_original_crosswrite_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "fixed_original_crosswrite_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("fixed_original_crosswrite_bigint_case", true)];
