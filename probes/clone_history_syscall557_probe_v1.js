// Syscall 557 characterization, v1. 557 is Sony-custom (absent upstream),
// census-located on the after page, with NO prior shaped call anywhere in
// the project record — completely unknown semantics. This probe runs a
// zero-arg call first (the proven-safe census pattern), then FOUR guarded
// argument shapes against one position-encoded buffer, classifying return,
// errno, and any copyout per shape. Marker budget 8/8: preflight, zero
// before/after, pattern-1 before/after, pattern-2 before/after, done —
// patterns 3-4 run unmarked (a death there localizes to "after pattern 2").
// All guarded shapes write only into this process's own buffer; unknown-
// syscall risk is inherent and acknowledged.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys557 !== "number")
    throw new Error("chain_or_sys557_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x1000;
  var guardOffset = bufOffset + bufLength;
  var guardLength = 0x100;
  var sizePtrOffset = 0x1400;
  var regionEnd = sizePtrOffset + 0x20;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var sizeAddress = address + sizePtrOffset;
  var original = Array.from(frame.subarray(bufOffset, regionEnd));
  function putSize() {
    frame[sizePtrOffset] = 0x00; frame[sizePtrOffset + 1] = 0x10;
    frame[sizePtrOffset + 2] = 0; frame[sizePtrOffset + 3] = 0;
    frame[sizePtrOffset + 4] = 0; frame[sizePtrOffset + 5] = 0;
    frame[sizePtrOffset + 6] = 0; frame[sizePtrOffset + 7] = 0;
  }
  function armBuffer() {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    frame.fill(0xa5, guardOffset, guardOffset + guardLength);
    putSize();
  }
  function call557(args) {
    var call = native.call("sys557", args);
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
      var dumpLength = Math.min(64, last - first + 1);
      for (var d = 0; d < dumpLength; d++)
        hex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
    }
    return { ret: call.value, errno: errno,
      extent: (first === -1) ? 0 : last - first + 1,
      first: first, guard_intact: guardIntact, hex: hex };
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync === "function")
    api.markSync("sys557_preflight");
  phase = "zero";
  armBuffer();
  if (api && typeof api.markSync === "function")
    api.markSync("sys557_zero_before");
  var zero = call557([0, 0, 0, 0, 0, 0]);
  if (api && typeof api.markSync === "function")
    api.markSync("sys557_zero_after");
  var patterns = [
    { name: "ptr_len", args: [bufAddress, bufLength], marked: true },
    { name: "ptr_sizeptr", args: [bufAddress, sizeAddress], marked: true },
    { name: "ptr_sizeptr_len",
      args: [bufAddress, sizeAddress, bufLength], marked: false },
    { name: "bare_ptr", args: [bufAddress, 0, 0, 0, 0, 0], marked: false }
  ];
  var summaries = ["zero:ret" + zero.ret + "/e" + zero.errno +
    "/ext" + zero.extent + "/g" + (zero.guard_intact ? 1 : 0)];
  var bestHex = "", bestExtent = 0, bestName = "";
  for (var p = 0; p < patterns.length; p++) {
    phase = "pattern_" + patterns[p].name;
    armBuffer();
    if (patterns[p].marked && api &&
        typeof api.markSync === "function")
      api.markSync("sys557_" + patterns[p].name + "_before");
    var out = call557(patterns[p].args);
    if (patterns[p].marked && api &&
        typeof api.markSync === "function")
      api.markSync("sys557_" + patterns[p].name + "_after");
    if (out.extent > bestExtent) {
      bestExtent = out.extent; bestHex = out.hex;
      bestName = patterns[p].name;
    }
    summaries.push(patterns[p].name + ":ret" + out.ret +
      "/e" + out.errno + "/ext" + out.extent +
      "/g" + (out.guard_intact ? 1 : 0));
  }
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  if (api && typeof api.markSync === "function")
    api.markSync("sys557_done");
  result = { id: "syscall557_probe_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { zero_ret: zero.ret, zero_errno: zero.errno,
      patterns: summaries.join(" | "),
      best_pattern: bestName, best_extent: bestExtent,
      best_hex: bestHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall557_probe_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
