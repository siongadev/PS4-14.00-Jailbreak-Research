// Forge a bounded OOB Uint8Array over a resizable buffer and inspect metadata.
// The buffer has length 8, max length 16; the view requests 9 bytes. No OOB read.
function makeKey() {
  var bytes = [0, 0, 0, 0x16, 0x02];
  for (var i = 0; i < 8; i++) bytes.push(0);
  bytes.push(9);
  for (var j = 1; j < 8; j++) bytes.push(0);
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
    var ordinary = new Uint8Array(backing);
    for (var i = 0; i < ordinary.length; i++) ordinary[i] = 0x41 + i;
    var filler = new Array(253);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : 0;
    filler[1] = backing;
    for (var j = 2; j < filler.length; j++) filler[j] = {};
    var shared = { marker: 0x51515151 };
    var key = makeKey();
    var input = {};
    input.filler = filler;
    input.first = shared;
    input.second = shared;
    input[key] = 0;
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_rab_oob_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_rab_oob_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_rab_oob_loaded");
    phase = "inspect";
    var target = output.filler[1];
    var synthetic = output["\u0000"];
    var isView = synthetic instanceof Uint8Array;
    var tailPreserved = Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    var expected = useBigInt ? isView && synthetic.buffer === target &&
      target.byteLength === 8 && target.maxByteLength === 16 &&
      synthetic.byteLength === 0 && synthetic.length === 0 &&
      synthetic[0] === undefined && !tailPreserved :
      output.first === output.second && tailPreserved &&
      target.byteLength === 8 && target.maxByteLength === 16;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      synthetic_is_view: isView,
      synthetic_buffer_is_target: isView ? synthetic.buffer === target : false,
      synthetic_byte_offset: isView ? synthetic.byteOffset : null,
      synthetic_byte_length: isView ? synthetic.byteLength : null,
      synthetic_length: isView ? synthetic.length : null,
      synthetic_zero_type: isView ? typeof synthetic[0] : null,
      backing_length: target.byteLength,
      backing_max: target.maxByteLength,
      backing_canary: new Uint8Array(target)[0],
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
var control = runCase("small_rab_oob_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "small_rab_oob_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("small_rab_oob_bigint_case", true)];
