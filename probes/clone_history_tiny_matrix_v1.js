// Reduce the 14.00 History deserialization error to a small input shape.
function runCase(id, size, kind) {
  var phase = "build";
  var result;
  try {
    var shared = { marker: 0x51515151 };
    var input;
    if (size === 3) {
      input = [0, shared, shared];
    } else {
      var filler = new Array(size - 3);
      filler[0] = kind === "bigint" ? BigInt(1) << BigInt(40) : {};
      for (var i = 1; i < filler.length; i += 1) filler[i] = {};
      input = new Array(size);
      input[0] = filler;
      input[1] = shared;
      input[2] = shared;
      input[size - 1] = -64000;
      if (api && typeof api.markSync === "function") api.markSync(id + "_ready");
    }
    phase = "store";
    history.replaceState(input, "");
    phase = "load";
    var output = history.state;
    if (size !== 3 && api && typeof api.markSync === "function") api.markSync(id + "_loaded");
    phase = "inspect";
    var alias = output[1] === output[2];
    var marker = output[2] && output[2].marker;
    var valid = Array.isArray(output) && output.length === size && alias &&
      marker === 0x51515151 && (size === 3 || output[size - 1] === -64000);
    result = { id: id, status: valid ? "pass" : "fail", details: {
      input_length: size,
      output_length: typeof output.length === "number" ? output.length : null,
      output_alias: alias,
      slot1_type: typeof output[1],
      slot2_type: typeof output[2],
      slot2_marker: typeof marker === "number" && isFinite(marker) ? marker : null,
      slot2_value: typeof output[2] === "bigint" ? String(output[2]).slice(0, 128) :
        typeof output[2] === "number" && isFinite(output[2]) ? output[2] : null,
      tail_ok: size === 3 || output[size - 1] === -64000
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

var cases = [
  ["small_number_control", 3, "number"],
  ["nested_object_control", 4, "object"],
  ["bigint_size_4", 4, "bigint"],
  ["bigint_size_5", 5, "bigint"],
  ["bigint_size_8", 8, "bigint"],
  ["bigint_size_16", 16, "bigint"],
  ["bigint_size_32", 32, "bigint"],
  ["bigint_size_64", 64, "bigint"],
  ["bigint_size_128", 128, "bigint"],
  ["bigint_size_256", 256, "bigint"]
];
var checks = [];
var stopped = false;
for (var j = 0; j < cases.length; j += 1) {
  var item = cases[j];
  if (stopped) {
    checks.push({ id: item[0], status: "unsupported", details: { reason: "prior_error" } });
  } else {
    var check = runCase(item[0], item[1], item[2]);
    checks.push(check);
    if (check.status === "error" || check.details.cleanup_ok !== true) stopped = true;
  }
}
return checks;
