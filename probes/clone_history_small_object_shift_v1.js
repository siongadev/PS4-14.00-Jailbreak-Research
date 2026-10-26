// Test the 255/256 pool boundary with an object property name. The one-byte
// shift should turn a 16-bit property-name prefix into a self-reference.
function runCase(id, useBigInt) {
  var phase = "build";
  var result;
  try {
    var filler = new Array(253);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : 0;
    for (var i = 1; i < filler.length; i++) filler[i] = {};
    var shared = { marker: 0x51515151 };
    var key = "\u0000\u1300\u0000\uffff\uffff" + "A".repeat(251);
    var input = {};
    input.filler = filler;
    input.first = shared;
    input.second = shared;
    input[key] = 0;
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_object_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_object_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("small_object_loaded");
    phase = "inspect";
    var normal = output.filler && output.filler.length === 253 &&
      output.first === output.second && output.first.marker === 0x51515151;
    var selfReference = output["\u0000"] === output;
    var tailPreserved = Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    var expected = normal && (useBigInt ? selfReference && !tailPreserved : tailPreserved && !selfReference);
    result = { id: id, status: expected ? "pass" : "fail", details: {
      normal: normal,
      self_reference: selfReference,
      tail_preserved: tailPreserved,
      key_length: key.length,
      filler_length: output.filler ? output.filler.length : null,
      first_second_alias: output.first === output.second
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
var control = runCase("small_object_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "small_object_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("small_object_bigint_case", true)];
