// Dynlib-block sweep: zero-arg admission + guarded arg-shape matrix for the
// unknown family around 592/608 — syscalls 593, 594, 595, 596, 598, 599,
// 600, 601, 602, 603, 604, 605, 606, 607 (608 = known info_ex). Zero-arg
// first per syscall (the proven-safe census pattern), then a guarded
// ptr/len shape against a position-encoded buffer, then a second guarded
// shape with a size pointer. Per-syscall classification: ret, errno,
// copyout extent, guard state, first bytes. All writes land in this
// process's own buffer; each syscall is an unknown but the family context
// (592/608 = read-only queries) and the census's wrapper admission make
// these the best-characterized unknowns available. Safe mark() helper;
// markers best-effort (cap-immune); ONE syscall per shape, stop-on-anything
// is the operator's call via capture review, not in-probe.
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
  var regionEnd = sizePtrOffset + 0x20;
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
  function putSize() {
    frame[sizePtrOffset] = 0x00; frame[sizePtrOffset + 1] = 0x10;
    frame[sizePtrOffset + 2] = 0; frame[sizePtrOffset + 3] = 0;
    frame[sizePtrOffset + 4] = 0; frame[sizePtrOffset + 5] = 0;
    frame[sizePtrOffset + 6] = 0; frame[sizePtrOffset + 7] = 0;
  }
  function arm() {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    frame.fill(0xa5, guardOffset, guardOffset + guardLength);
    putSize();
  }
  function callWrapper(name, args) {
    if (!native.wrappers[name])
      return { ret: null, errno: null, extent: 0, guard: true,
        hex: "", skipped: true };
    var call = native.call(name, args);
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
    return { ret: call.value, errno: errno,
      extent: (first === -1) ? 0 : last - first + 1,
      guard: guardIntact, hex: hex, skipped: false };
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("sys_block_preflight");
  var numbers = ["sys593", "sys594", "sys595", "sys596", "sys598",
    "sys599", "sys600", "sys601", "sys602", "sys603", "sys604",
    "sys605", "sys606", "sys607"];
  var lines = [];
  var bestHex = "", bestExtent = 0, bestName = "";
  for (var n = 0; n < numbers.length; n++) {
    var name = numbers[n];
    phase = name;
    if (!native.wrappers[name]) {
      lines.push(name.replace("sys", "") + ":absent");
      continue;
    }
    var line = name.replace("sys", "") + ":";
    var shapes = [
      { label: "z", args: [0, 0, 0, 0, 0, 0] },
      { label: "pl", args: [bufAddress, bufLength] },
      { label: "ps", args: [bufAddress, sizeAddress] }
    ];
    for (var s = 0; s < shapes.length; s++) {
      arm();
      var out = callWrapper(name, shapes[s].args);
      line += shapes[s].label + "(" + out.ret + "/" +
        (out.errno === null ? "ok" : out.errno) + "/" +
        out.extent + "/g" + (out.guard ? 1 : 0) + ")";
      if (out.extent > bestExtent) {
        bestExtent = out.extent; bestHex = out.hex; bestName =
          name.replace("sys", "") + "." + shapes[s].label;
      }
    }
    lines.push(line);
  }
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("sys_block_done");
  result = { id: "dynlib_block_sweep_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines: lines.join(" | "),
      best_pattern: bestName, best_extent: bestExtent,
      best_hex: bestHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "dynlib_block_sweep_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
