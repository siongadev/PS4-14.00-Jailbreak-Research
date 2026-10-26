// 594 disambiguation: is EINVAL pre-file (capability/ABI gate) or
// path-dependent? Three calls: (real path, 16-byte args, size 0x10),
// (garbage path, same), (real path, NULL args, 0). Identical EINVAL
// across real+garbage = rejected before the VFS layer = closed.
// Any divergence (ENOENT on garbage) = we reached the file layer and
// the capability check lives deeper. Guards + restore + PID.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys594 !== "number")
    throw new Error("chain_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var nameOff = 0x200;
  var argOff = 0x300, argLen = 0x10;
  var statusOff = 0x400, statusLen = 0x100;
  var regionEnd = statusOff + statusLen;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var nameAddress = address + nameOff;
  var argAddress = address + argOff;
  var statusAddress = address + statusOff;
  var original = Array.from(frame.subarray(nameOff, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function putName(text) {
    for (var i = 0; i < text.length; i++)
      frame[nameOff + i] = text.charCodeAt(i);
    frame[nameOff + text.length] = 0;
    for (var z = text.length + 1; z < 200; z++) frame[nameOff + z] = 0;
  }
  function attempt(text, withArgs) {
    putName(text);
    frame.fill(0, statusOff, statusOff + statusLen);
    for (var i = 0; i < argLen; i++) frame[argOff + i] = 0x41;
    var call = withArgs ?
      native.call("sys594", [nameAddress, argAddress, 0x10,
        0, 0, statusAddress]) :
      native.call("sys594", [nameAddress, 0, 0, 0, 0, statusAddress]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var st = "";
    for (var d = 0; d < 16; d++)
      st += ("0" + frame[statusOff + d].toString(16)).slice(-2);
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "st" + st;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("lpd_preflight");
  var lines = [];
  phase = "real_args";
  lines.push("real16:" + attempt(
    "/system/common/lib/libSceFios2.prx", true));
  mark("lpd_real");
  phase = "garbage_args";
  lines.push("garbage16:" + attempt(
    "/app0/definitely_not_here.xyz", true));
  mark("lpd_garbage");
  phase = "real_nullargs";
  lines.push("realnull:" + attempt(
    "/system/common/lib/libSceFios2.prx", false));
  mark("lpd_null");
  for (var r = 0; r < original.length; r++)
    frame[nameOff + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[nameOff + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("lpd_done");
  result = { id: "loadprx_disambig_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 400),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "loadprx_disambig_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
