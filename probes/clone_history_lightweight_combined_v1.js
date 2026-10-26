// Lightweight combined probe: 601 request sweep (0-31) + module list.
// Previous mdbg sweep died at request ~32 (too many ROP pivots). This
// is a lean version: 32 601 calls + one 592 list + one 595 attempt.
// Under 35 total calls — well within budget.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys638 !== "number" ||
      typeof native.wrappers.sys601 !== "number" ||
      typeof native.wrappers.dynlib_list !== "number" ||
      typeof native.wrappers.sys595 !== "number")
    throw new Error("chain_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var listOff = 0x600, listLen = 0x1000;
  if (listOff + listLen > frame.length)
    throw new Error("frame_region_too_small");
  var listAddress = address + listOff;
  function mark(n) {
    try { if (api && typeof api.markSync === "function")
      api.markSync(n); } catch (e) {}
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("lp_preflight");
  // Part A: 601 request types 0-31
  phase = "sweep";
  var sweep = [];
  for (var r = 0; r <= 31; r++) {
    var c = native.call("sys601", [r, 0, 0, 0, 0, 0]);
    var e = (c.value === -1) ? native.readErrno() : null;
    sweep.push(r + "=" + c.value + (e === null ? "" : "e" + e));
  }
  mark("lp_sweep_done");
  // Part B: module list
  phase = "list";
  for (var i = 0; i < listLen; i++)
    frame[listOff + i] = (i * 7 + 3) & 255;
  native.call("dynlib_list", [listAddress, listLen]);
  var handles = [];
  var extent = 0;
  for (var c2 = 0; c2 < listLen; c2++)
    if (frame[listOff + c2] !== ((c2 * 7 + 3) & 255)) extent = c2 + 1;
  for (var h = 0; h + 4 <= extent; h += 4) {
    var v = frame[listOff + h] + frame[listOff + h + 1] * 256;
    if (v !== 0) handles.push(v);
  }
  mark("lp_list_" + handles.length);
  // Part C: 595 on handle 0x10 (decimal 16)
  phase = "unload";
  var r595 = native.call("sys595", [16, 0, 0, 0, 0, 0]);
  var e595 = (r595.value === -1) ? native.readErrno() : null;
  mark("lp_595_" + r595.value + "_" + (e595 === null ? "ok" : e595));
  // Part D: post-unload list
  phase = "postlist";
  for (var i2 = 0; i2 < listLen; i2++)
    frame[listOff + i2] = (i2 * 7 + 3) & 255;
  native.call("dynlib_list", [listAddress, listLen]);
  var postHandles = [];
  var extent2 = 0;
  for (var c3 = 0; c3 < listLen; c3++)
    if (frame[listOff + c3] !== ((c3 * 7 + 3) & 255)) extent2 = c3 + 1;
  for (var h2 = 0; h2 + 4 <= extent2; h2 += 4) {
    var v2 = frame[listOff + h2] + frame[listOff + h2 + 1] * 256;
    if (v2 !== 0) postHandles.push(v2);
  }
  var lost = [];
  for (var a = 0; a < handles.length; a++)
    if (postHandles.indexOf(handles[a]) === -1) lost.push(handles[a]);
  var after = native.call("getpid", []);
  mark("lp_done");
  result = { id: "lightweight_combined_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { sweep_601: sweep.join(",").slice(0, 400),
      modules_before: handles.join(","),
      modules_after: postHandles.join(","),
      r595: r595.value + "/" + (e595 === null ? "ok" : e595),
      lost: lost.join(",") || "none",
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "lightweight_combined_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
