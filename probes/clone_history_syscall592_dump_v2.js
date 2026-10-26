// Syscall 592 (dynlib_list) copyout characterization, v2. v1 lost pattern 4
// to the collector's hard 8-marker-per-command cap (control.py: count>=8 →
// "marker count exceeded"; v1's 9 markers hit it on the last one). v2 uses
// exactly 8: preflight, before/after for the three shaped patterns, and a
// final done marker. The bare_ptr control runs WITHOUT dedicated markers
// (it is the zero-effect shape). Everything else matches v1: four guarded
// argument shapes against one position-encoded buffer, per-shape diff and
// hex capture. All shapes are read-only in-process queries; the census
// proved the wrapper admitted and safe.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.dynlib_list !== "number")
    throw new Error("chain_or_dynlib_list_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x1000;
  var guardOffset = bufOffset + bufLength;      // 0x1200
  var guardLength = 0x100;
  var sizePtrOffset = 0x1400;                   // u64 in/out size
  var regionEnd = sizePtrOffset + 0x20;         // 0x1420
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
  function diffBuffer() {
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
      var dumpLength = Math.min(96, last - first + 1);
      for (var d = 0; d < dumpLength; d++)
        hex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
    }
    return { first: first, last: last,
      extent: (first === -1) ? 0 : last - first + 1,
      guard_intact: guardIntact, hex: hex };
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_preflight");
  var patterns = [
    { name: "ptr_len", args: [bufAddress, bufLength], marked: true },
    { name: "ptr_sizeptr", args: [bufAddress, sizeAddress], marked: true },
    { name: "ptr_sizeptr_len",
      args: [bufAddress, sizeAddress, bufLength], marked: true },
    { name: "bare_ptr", args: [bufAddress, 0, 0, 0, 0, 0], marked: false }
  ];
  var summaries = [];
  var bestHex = "", bestExtent = 0, bestName = "";
  for (var p = 0; p < patterns.length; p++) {
    phase = "pattern_" + patterns[p].name;
    armBuffer();
    if (patterns[p].marked && api &&
        typeof api.markSync === "function")
      api.markSync("sys592_" + patterns[p].name + "_before");
    var call = native.call("dynlib_list", patterns[p].args);
    if (patterns[p].marked && api &&
        typeof api.markSync === "function")
      api.markSync("sys592_" + patterns[p].name + "_after");
    var errno = (call.value === -1) ? native.readErrno() : null;
    var sizeLeft = ((frame[sizePtrOffset]) |
                    (frame[sizePtrOffset + 1] << 8)) >>> 0;
    var d = diffBuffer();
    if (d.extent > bestExtent) {
      bestExtent = d.extent; bestHex = d.hex; bestName = patterns[p].name;
    }
    summaries.push(patterns[p].name + ":ret" + call.value +
      "/e" + errno + "/ext" + d.extent +
      "/g" + (d.guard_intact ? 1 : 0) +
      "/sz" + sizeLeft);
  }
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_done");
  result = { id: "syscall592_dump_v2",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { patterns: summaries.join(" | "),
      best_pattern: bestName, best_extent: bestExtent,
      best_hex: bestHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall592_dump_v2", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
