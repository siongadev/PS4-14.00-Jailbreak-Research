// Map every fixed-buffer marker against the original and cloned live buffers.
function makeKey() {
  var bytes = [0, 0, 0, 0x16, 0x02, 8];
  for (var i = 1; i < 8; i++) bytes.push(0);
  bytes.push(0xf8);
  for (var j = 1; j < 8; j++) bytes.push(0xff);
  bytes.push(0x13, 3, 0, 0xff, 0xff, 0xff, 0xff);
  var chars = [];
  for (var k = 0; k < bytes.length; k += 2)
    chars.push(String.fromCharCode(bytes[k] | (bytes[k + 1] << 8)));
  return (chars.join("") + "A".repeat(256)).slice(0, 256);
}
function mark(name) {
  if (api && typeof api.markSync === "function") api.markSync(name);
}
function runCase(id, useBigInt) {
  var phase = "build";
  var result;
  try {
    var backing = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(backing).fill(0x41);
    var fixed = new ArrayBuffer(65536);
    var original = new Uint8Array(fixed);
    original.fill(0x91);
    var filler = new Array(253);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : 0;
    filler[1] = backing;
    filler[2] = fixed;
    for (var i = 3; i < 27; i++) {
      var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
      new Uint8Array(neighbor).fill(0x40 + i);
      filler[i] = neighbor;
    }
    for (var j = 27; j < filler.length; j++) filler[j] = {};
    var shared = { marker: 0x51515151 };
    var key = makeKey();
    var input = {};
    input.filler = filler;
    input.first = shared;
    input.second = shared;
    input[key] = 0;
    if (useBigInt) mark("fixed_map_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt) mark("fixed_map_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt) mark("fixed_map_loaded");
    phase = "inspect";
    var target = output.filler[1];
    var synthetic = output["\u0000"];
    var cloned = new Uint8Array(output.filler[2]);
    var viewValid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
      synthetic.byteOffset === 8 && synthetic.length > 1e12;
    var before = [];
    var afterOriginalFill = [];
    var afterOriginalRestore = [];
    var afterCloneFill = [];
    var afterCloneRestore = [];
    if (useBigInt && viewValid) {
      function scan() {
        var values = [];
        for (var n = 0; n < 8; n++) values.push(synthetic[65528 + 65536 * n]);
        return values;
      }
      before = scan();
      phase = "fill_original";
      original.fill(0xa7);
      afterOriginalFill = scan();
      mark("fixed_map_original_filled");
      original.fill(0x91);
      afterOriginalRestore = scan();
      phase = "fill_clone";
      cloned.fill(0xc4);
      afterCloneFill = scan();
      mark("fixed_map_clone_filled");
      cloned.fill(0x91);
      afterCloneRestore = scan();
      mark("fixed_map_restored");
      phase = "inspect";
    }
    var expected = useBigInt ? viewValid && before.length === 8 &&
      before.join(",") === afterOriginalRestore.join(",") &&
      before.join(",") === afterCloneRestore.join(",") :
      output.first === output.second && Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      view_valid: viewValid,
      marker_before: before.join(","),
      after_original_fill: afterOriginalFill.join(","),
      after_original_restore: afterOriginalRestore.join(","),
      after_clone_fill: afterCloneFill.join(","),
      after_clone_restore: afterCloneRestore.join(","),
      original_first: original[0],
      cloned_first: cloned[0],
      target_first: new Uint8Array(target)[0],
      target_last: new Uint8Array(target)[7]
    } };
  } catch (error) {
    result = { id: id, status: "error", details: { phase: phase, error: String(error).slice(0, 200) } };
  }
  try { history.replaceState(null, ""); }
  catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
  return result;
}
var control = runCase("fixed_map_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "fixed_map_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("fixed_map_bigint_case", true)];
