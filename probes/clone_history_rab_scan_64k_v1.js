// Read-only 64 KiB scan beyond an eight-byte RAB with 24 cloned RAB markers.
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
    var filler = new Array(253);
    filler[0] = useBigInt ? BigInt(1) << BigInt(40) : 0;
    filler[1] = backing;
    for (var i = 2; i < 26; i++) {
      var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
      new Uint8Array(neighbor).fill(0x5a);
      filler[i] = neighbor;
    }
    for (var j = 26; j < filler.length; j++) filler[j] = {};
    var shared = { marker: 0x51515151 };
    var key = makeKey();
    var input = {};
    input.filler = filler;
    input.first = shared;
    input.second = shared;
    input[key] = 0;
    if (useBigInt) mark("scan_64k_ready");
    phase = "store";
    history.replaceState(input, "");
    if (useBigInt) mark("scan_64k_stored");
    phase = "load";
    var output = history.state;
    if (useBigInt) mark("scan_64k_loaded");
    phase = "inspect";
    var target = output.filler[1];
    var synthetic = output["\u0000"];
    var viewValid = synthetic instanceof Uint8Array && synthetic.buffer === target &&
      synthetic.byteOffset === 8 && synthetic.length > 1e12;
    var scanned = 0;
    var nonzero = 0;
    var markerCount = 0;
    var first = [];
    if (useBigInt && viewValid) {
      phase = "scan";
      for (var n = 0; n < 65536; n++) {
        var value = synthetic[n];
        scanned++;
        if (typeof value !== "number") throw new Error("non-numeric byte at " + n);
        if (value) {
          nonzero++;
          if (first.length < 16) first.push(n + ":" + value.toString(16));
        }
        if (value === 0x5a) markerCount++;
        if (n === 16383) mark("scan_64k_16k");
        if (n === 32767) mark("scan_64k_32k");
        if (n === 49151) mark("scan_64k_48k");
        if (n === 65535) mark("scan_64k_64k");
      }
      phase = "inspect";
    }
    var expected = useBigInt ? viewValid && scanned === 65536 :
      output.first === output.second && Object.prototype.hasOwnProperty.call(output, key) && output[key] === 0;
    result = { id: id, status: expected ? "pass" : "fail", details: {
      view_valid: viewValid,
      backing_length: target.byteLength,
      normal_extra_undefined: new Uint8Array(target)[8] === undefined,
      spray_first: new Uint8Array(output.filler[2])[0],
      spray_last: new Uint8Array(output.filler[25])[0],
      scanned: scanned,
      nonzero_count: nonzero,
      marker_count: markerCount,
      first_nonzero: first.join(","),
      first_canary: new Uint8Array(target)[0],
      last_canary: new Uint8Array(target)[7]
    } };
  } catch (error) {
    result = { id: id, status: "error", details: { phase: phase, error: String(error).slice(0, 200) } };
  }
  try { history.replaceState(null, ""); }
  catch (error) { result.status = "error"; result.details.cleanup_error = String(error).slice(0, 100); }
  return result;
}
var control = runCase("scan_64k_no_bigint_control", false);
if (control.status !== "pass")
  return [control, { id: "scan_64k_bigint_case", status: "unsupported", details: { reason: "control_failed" } }];
return [control, runCase("scan_64k_bigint_case", true)];
