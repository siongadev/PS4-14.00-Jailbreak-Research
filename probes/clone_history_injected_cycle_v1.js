// A 16-bit StringData header reinterpreted as ObjectReferenceTag should read
// pool index zero. Its first U+0000 and four U+FFFF characters then provide
// that index and the two array terminators, creating a self-reference.
function runCase(id, large, useBigInt) {
  var phase = "build";
  var result;
  try {
    var shared = { marker: 0x51515151 };
    var input;
    var payload = null;
    if (!large) {
      input = [0, shared, shared];
    } else {
      var filler = new Array(0xfffd);
      filler[0] = useBigInt ? BigInt(1) << BigInt(40) : {};
      for (var i = 1; i < filler.length; i += 1) filler[i] = {};
      payload = "\u0000" + "\uffff".repeat(4) + "A".repeat(0x1300 - 5);
      input = new Array(0x10001);
      input[0] = filler;
      input[1] = shared;
      input[2] = shared;
      input[0x10000] = payload;
      if (useBigInt && api && typeof api.markSync === "function")
        api.markSync("cycle_bigint_ready");
    }
    phase = "store";
    history.replaceState(input, "");
    phase = "load";
    var output = history.state;
    if (useBigInt && api && typeof api.markSync === "function")
      api.markSync("cycle_bigint_loaded");
    phase = "inspect";
    var alias = output[1] === output[2];
    var inserted = large ? output[0x100001] : null;
    var correct = Array.isArray(output) && output.length === input.length && alias &&
      output[2] && output[2].marker === 0x51515151 && (!large || output[0x10000] === payload);
    result = { id: id, status: correct ? "pass" : "fail", details: {
      input_length: input.length,
      output_length: typeof output.length === "number" ? output.length : null,
      output_alias: alias,
      tail_ok: !large || output[0x10000] === payload,
      inserted_type: large ? typeof inserted : null,
      inserted_is_self: large ? inserted === output : null,
      input_has_self_reference: large ? input[0x100001] === input : null,
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
    { id: "cycle_no_bigint_control", status: "unsupported", details: { reason: "small_control_failed" } },
    { id: "cycle_bigint_case", status: "unsupported", details: { reason: "small_control_failed" } }];
}
var control = runCase("cycle_no_bigint_control", true, false);
if (control.status !== "pass") {
  return [small, control,
    { id: "cycle_bigint_case", status: "unsupported", details: { reason: "large_control_failed" } }];
}
return [small, control, runCase("cycle_bigint_case", true, true)];
