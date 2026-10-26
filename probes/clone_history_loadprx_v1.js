// sys_dynlib_load_prx (594) — correct 6-arg ABI test. Public signature:
// load_prx(name, args, argsSize, flags, pad, status). The census never
// got past arg validation (EFAULT/EINVAL with 2-arg shapes); this probe
// supplies a real NUL-terminated module path, an empty args block, and
// a guarded 0x100-byte status struct. Outcomes: EINVAL/EFAULT = still
// wrong ABI; EPERM = capability gate reached (expected on retail);
// ENOENT-class = reached the VFS layer; 0 = module loaded (then 592
// list + status dump bank the evidence). Paths are standard system
// common-lib modules. Full restore, PID verified.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys594 !== "number" ||
      typeof native.wrappers.dynlib_list !== "number")
    throw new Error("chain_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var nameOff = 0x200;
  var argOff = 0x300;
  var statusOff = 0x400, statusLen = 0x100;
  var guardOff = statusOff + statusLen;
  var guardLen = 0x40;
  var listOff = 0x600, listLen = 0x1000;
  var regionEnd = listOff + listLen;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var nameAddress = address + nameOff;
  var argAddress = address + argOff;
  var statusAddress = address + statusOff;
  var listAddress = address + listOff;
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
  function listCount() {
    for (var i = 0; i < listLen; i++)
      frame[listOff + i] = (i * 7 + 3) & 255;
    var call = native.call("dynlib_list", [listAddress, listLen]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var extent = 0;
    for (var c = 0; c < listLen; c++)
      if (frame[listOff + c] !== ((c * 7 + 3) & 255)) extent = c + 1;
    var count = 0;
    for (var h = 0; h + 4 <= extent; h += 4) {
      var v = frame[listOff + h] + frame[listOff + h + 1] * 256;
      if (v !== 0) count++;
    }
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "/n" + count;
  }
  function loadAttempt(text) {
    putName(text);
    frame.fill(0, statusOff, statusOff + statusLen);
    frame.fill(0x5a, guardOff, guardOff + guardLen);
    frame[argOff] = 0; frame[argOff + 1] = 0;
    var call = native.call("sys594", [nameAddress, argAddress, 0,
      0, 0, statusAddress]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var guardIntact = true;
    for (var g = 0; g < guardLen; g++)
      if (frame[guardOff + g] !== 0x5a) { guardIntact = false; break; }
    var hex = "";
    for (var d = 0; d < 32; d++)
      hex += ("0" + frame[statusOff + d].toString(16)).slice(-2);
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "/g" + (guardIntact ? 1 : 0) + "st" + hex;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("lp_preflight");
  var lines = ["list_before:" + listCount()];
  mark("lp_list_before");
  var paths = [
    "/system/common/lib/libSceFios2.prx",
    "/system/common/lib/libSceNgsInternal.sprx",
    "/system/common/lib/libSceContentExport.sprx"
  ];
  for (var p = 0; p < paths.length; p++) {
    phase = "load_" + p;
    lines.push("load" + p + ":" + loadAttempt(paths[p]));
    mark("lp_load" + p);
  }
  phase = "list_after";
  lines.push("list_after:" + listCount());
  var pid = native.call("getpid", []);
  lines.push("pid:" + pid.value);
  mark("lp_list_after");
  for (var r = 0; r < original.length; r++)
    frame[nameOff + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[nameOff + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("lp_done");
  result = { id: "loadprx_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 480),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "loadprx_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
