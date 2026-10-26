// Independent repeat of the historical 14.00 BigInt/History graph shape.
// This probe does not construct a forged view or modify native memory.
function runHistoryCase(id, large) {
  var phase = "build";
  var result;
  try {
    var shared = { marker: 0x51515151 };
    var filler = large ? new Array(0xfffd) : null;
    if (large) {
      filler[0] = BigInt(1) << BigInt(40);
      for (var i = 1; i < filler.length; i += 1) filler[i] = {};
    }
    var input = large ? new Array(0x10000) : new Array(3);
    input[0] = large ? filler : 0;
    input[1] = shared;
    input[2] = shared;
    if (large) input[0xffff] = -64000;
    if (large && api && typeof api.markSync === "function") api.markSync("bigint_large_ready");
    phase = "store";
    history.replaceState(input, "");
    phase = "load";
    var output = history.state;
    if (large && api && typeof api.markSync === "function") api.markSync("bigint_large_loaded");
    phase = "inspect";
    var alias = output[1] === output[2];
    var marker = output[2] && output[2].marker;
    var markerDetail = typeof marker === "string" ? marker.slice(0, 512) :
      typeof marker === "number" && isFinite(marker) ? marker :
      typeof marker === "boolean" ? marker : null;
    var correct = Array.isArray(output) && output.length === input.length &&
      alias && marker === 0x51515151 &&
      (!large || output[0xffff] === -64000);
    result = { id: id, status: correct ? "pass" : "fail", details: {
      input_length: input.length, output_length: output.length,
      input_alias: input[1] === input[2], output_alias: alias,
      slot1_type: typeof output[1], slot2_type: typeof output[2],
      slot2_marker: markerDetail,
      slot2_value: typeof output[2] === "bigint" ? String(output[2]).slice(0, 512) :
        typeof output[2] === "number" && isFinite(output[2]) ? output[2] : null,
      tail_ok: !large || output[0xffff] === -64000
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

var smallControl = runHistoryCase("small_number_control", false);
if (smallControl.status !== "pass") {
  return [smallControl, { id: "large_bigint_case", status: "unsupported",
    details: { reason: "small_control_failed" } }];
}
return [smallControl, runHistoryCase("large_bigint_case", true)];
