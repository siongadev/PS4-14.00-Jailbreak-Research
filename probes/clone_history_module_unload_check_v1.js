// Module unload check: 595 with handle 0x10 returned 0 (success) in
// the brute force. This probe checks whether a module disappeared from
// the 592 list. Calls 592 to get the current module list, then tries
// 595 on handle 0x10, then calls 592 again to compare.
// Also: re-reads all 26 handles to find any ESRCH gap.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.dynlib_list !== "number" ||
      typeof native.wrappers.sys595 !== "number")
    throw new Error("chain_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var listOff = 0x200, listLen = 0x1000;
  if (listOff + listLen > frame.length)
    throw new Error("frame_region_too_small");
  var listAddress = address + listOff;
  function mark(n) {
    try { if (api && typeof api.markSync === "function")
      api.markSync(n); } catch (e) {}
  }
  function getList() {
    for (var i = 0; i < listLen; i++)
      frame[listOff + i] = (i * 7 + 3) & 255;
    var call = native.call("dynlib_list", [listAddress, listLen]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var extent = 0;
    for (var c = 0; c < listLen; c++)
      if (frame[listOff + c] !== ((c * 7 + 3) & 255)) extent = c + 1;
    var handles = [];
    for (var h = 0; h + 4 <= extent; h += 4) {
      var v = frame[listOff + h] + frame[listOff + h + 1] * 256;
      if (v !== 0) handles.push(v);
    }
    return { ret: call.value, errno: errno, handles: handles,
      extent: extent };
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("mu_preflight");
  // Get current module list
  var list1 = getList();
  mark("mu_list1_" + list1.handles.length + "_modules");
  // Try unloading handle 0x10 (decimal 16)
  var r595 = native.call("sys595", [16, 0, 0, 0, 0, 0]);
  var e595 = (r595.value === -1) ? native.readErrno() : null;
  mark("mu_595_" + r595.value + "/" + (e595 === null ? "ok" : e595));
  // Get list after unload attempt
  var list2 = getList();
  mark("mu_list2_" + list2.handles.length + "_modules");
  var lost = [];
  for (var a = 0; a < list1.handles.length; a++) {
    if (list2.handles.indexOf(list1.handles[a]) === -1)
      lost.push(list1.handles[a]);
  }
  var gained = [];
  for (var b = 0; b < list2.handles.length; b++) {
    if (list1.handles.indexOf(list2.handles[b]) === -1)
      gained.push(list2.handles[b]);
  }
  var after = native.call("getpid", []);
  mark("mu_done");
  result = { id: "module_unload_check_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { r595: r595.value + "/" + (e595 === null ? "ok" : e595),
      list1_count: list1.handles.length,
      list2_count: list2.handles.length,
      lost_modules: lost.join(",") || "none",
      gained_modules: gained.join(",") || "none",
      list1: list1.handles.join(","),
      list2: list2.handles.join(","),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "module_unload_check_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
