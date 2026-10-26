// 659 layout probe. Size-only calls return ENOMEM; (size, 0x1000) returns
// EFAULT, so arg2 looks like an output pointer, not an alignment. Feed a
// valid mapped frame buffer in arg2/arg3/arg4/arg5 with size/flags
// variations, guarded and position-encoded. One call per shape; no delete;
// PID verified.
var result;
var phase = "preflight";
try {
  var native = window.__fw14NativeInvoke;
  if (!native || typeof native.call !== "function" || !native.frame ||
      !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys659 !== "number")
    throw new Error("chain_or_wrapper_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x100;
  var guardOffset = bufOffset + bufLength, guardLength = 0x80;
  var regionEnd = guardOffset + guardLength;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
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
  }
  function call(args) {
    arm();
    var c = native.call("sys659", args);
    var errno = (c.value === -1) ? native.readErrno() : null;
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
      var dumpLength = Math.min(48, last - first + 1);
      for (var d = 0; d < dumpLength; d++)
        hex += ("0" + frame[bufOffset + first + d].toString(16)).slice(-2);
    }
    return (errno === null ? c.value + "/ok" : c.value + "/e" + errno) +
      "/x" + ((first === -1) ? 0 : last - first + 1) +
      "/g" + (guardIntact ? 1 : 0) + (hex ? "/h" + hex : "");
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("layout659_preflight");
  var lines = [];
  var shapes = [
    ["arg2_0", [0x10000, bufAddress, 0, 0, 0, 0]],
    ["arg2_1k", [0x10000, bufAddress, 0x1000, 0, 0, 0]],
    ["arg2_3", [0x10000, bufAddress, 3, 0, 0, 0]],
    ["arg2_1k3", [0x10000, bufAddress, 0x1000, 3, 0, 0]],
    ["arg3", [0x10000, 0, bufAddress, 0, 0, 0]],
    ["arg4", [0x10000, 0, 0, bufAddress, 0, 0]],
    ["arg5", [0x10000, 0, 0, 0, bufAddress, 0]]
  ];
  for (var i = 0; i < shapes.length; i++) {
    phase = shapes[i][0];
    lines.push(shapes[i][0] + ":" + call(shapes[i][1]));
  }
  mark("layout659_done");
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  result = { id: "layout_659_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 600),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "layout_659_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
