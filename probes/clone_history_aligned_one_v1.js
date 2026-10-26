// Independent 14.00 value-control test of the 16-to-32-bit pool crossover.
// -63744 serializes as 00 07 FF FF. With the predicted two-byte overread,
// the next array entry should be index 0x50001 with value 1 (OneTag).
function runCase(id, large, useBigInt) {
  var phase = "build";
  var result;
  try {
    var shared = { marker: 0x51515151 };
    var input;
    if (!large) {
      input = [0, shared, shared];
    } else {
      var filler = new Array(0xfffd);
      filler[0] = useBigInt ? BigInt(1) << BigInt(40) : {};
      for (var i = 1; i < filler.length; i += 1) filler[i] = {};
      input = new Array(0x10001);
      input[0] = filler;
      input[1] = shared;
      input[2] = shared;
      input[0x10000] = -63744;
      if (useBigInt && api && typeof api.markSync === "function")
        api.markSync("aligned_one_ready");
    }
    phase = "store";
    history.replaceState(input, "");
    phase = "load";
    var output = history.state;
    if (useBigInt && api && typeof api.markSync === "function")
      api.markSync("aligned_one_loaded");
    phase = "inspect";
    var alias = output[1] === output[2];
    var marker = output[2] && output[2].marker;
    var inserted = large ? output[0x50001] : null;
    var correct = Array.isArray(output) && output.length === input.length && alias &&
      marker === 0x51515151 && (!large || output[0x10000] === -63744);
    result = { id: id, status: correct ? "pass" : "fail", details: {
      input_length: input.length,
      output_length: typeof output.length === "number" ? output.length : null,
      output_alias: alias,
      slot2_type: typeof output[2],
      slot2_marker: typeof marker === "number" && isFinite(marker) ? marker : null,
      slot2_value: typeof output[2] === "number" && isFinite(output[2]) ? output[2] : null,
      tail_ok: !large || output[0x10000] === -63744,
      inserted_type: large ? typeof inserted : null,
      inserted_value: typeof inserted === "number" && isFinite(inserted) ? inserted : null
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
    { id: "aligned_one_no_bigint_control", status: "unsupported", details: { reason: "small_control_failed" } },
    { id: "aligned_one_bigint_case", status: "unsupported", details: { reason: "small_control_failed" } }];
}
var control = runCase("aligned_one_no_bigint_control", true, false);
if (control.status !== "pass") {
  return [small, control,
    { id: "aligned_one_bigint_case", status: "unsupported", details: { reason: "large_control_failed" } }];
}
return [small, control, runCase("aligned_one_bigint_case", true, true)];
