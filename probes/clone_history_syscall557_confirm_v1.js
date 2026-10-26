// Syscall 557 allocation CONFIRMATION. v3 established 557(name,len) is a
// handle allocator: four calls returned the monotonic IDs 107/108/109/110
// (names "Fw14ProbeName" ×2, "libSceVideoOut.sprx" ×2). This probe checks
// whether those handles persisted into the 592 (dynlib_list) table and what
// 608 (dynlib_info_ex) reports for them: re-run 592 (copy_extent growth
// from the baseline 108 = new entries), then 608 on handles 107/108/109/110
// with full struct-head dumps (name field at +0x10, base at +0x110).
// Read-only; wrappers byte-gated by v20; safe mark() helper (cap-immune);
// markers 6 of 8.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys557 !== "number" ||
      typeof native.wrappers.dynlib_list !== "number" ||
      typeof native.wrappers.dynlib_info_ex !== "number")
    throw new Error("chain_or_wrappers_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x1000;
  var structOffset = 0x1400, structLength = 0x1a8;
  var regionEnd = structOffset + structLength;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var structAddress = address + structOffset;
  var original = Array.from(frame.subarray(bufOffset, regionEnd));
  function hexAt(offset, count) {
    var out = "";
    for (var i = 0; i < count; i++)
      out += ("0" + frame[offset + i].toString(16)).slice(-2);
    return out;
  }
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync === "function")
    api.markSync("sys557_preflight");
  phase = "list_call";
  for (var i = 0; i < bufLength; i++)
    frame[bufOffset + i] = (i * 7 + 3) & 255;
  mark("sys557_list_before");
  var call = native.call("dynlib_list", [bufAddress, bufLength]);
  mark("sys557_list_after");
  var errno = (call.value === -1) ? native.readErrno() : null;
  var copyExtent = 0;
  for (var c = 0; c < bufLength; c++) {
    if (frame[bufOffset + c] !== ((c * 7 + 3) & 255)) copyExtent = c + 1;
  }
  var copyHex = hexAt(bufOffset, Math.min(copyExtent, 256));
  var found = "";
  var wanted = [107, 108, 109, 110];
  for (var w = 0; w + 4 <= copyExtent; w += 4) {
    var v = (frame[bufOffset + w]) |
            (frame[bufOffset + w + 1] << 8) |
            (frame[bufOffset + w + 2] << 16) |
            (frame[bufOffset + w + 3] << 24);
    for (var q = 0; q < wanted.length; q++)
      if (v === wanted[q]) found += v + " ";
  }
  phase = "walk";
  mark("sys557_walk_before");
  var structOriginal = Array.from(frame.subarray(structOffset,
    structOffset + structLength));
  var walk = "";
  var firstHex = "";
  for (var m = 0; m < wanted.length; m++) {
    frame.fill(0, structOffset, structOffset + structLength);
    frame[structOffset] = 0xa8; frame[structOffset + 1] = 0x01;
    var info = native.call("dynlib_info_ex",
      [wanted[m], 0, structAddress]);
    var werrno = (info.value === -1) ? native.readErrno() : null;
    var baseLo = (frame[structOffset + 0x110]) |
                 (frame[structOffset + 0x111] << 8) |
                 (frame[structOffset + 0x112] << 16) |
                 (frame[structOffset + 0x113] << 24);
    var baseHi = (frame[structOffset + 0x114]) |
                 (frame[structOffset + 0x115] << 8) |
                 (frame[structOffset + 0x116] << 16) |
                 (frame[structOffset + 0x117] << 24);
    walk += wanted[m] + ":r" + info.value + "/e" + werrno +
      "/b" + baseHi.toString(16) + hex8(baseLo) + " ";
    if (info.value === 0 && firstHex === "")
      firstHex = hexAt(structOffset, 0x40);
  }
  function hex8(value) {
    return ("00000000" + value.toString(16)).slice(-8);
  }
  mark("sys557_walk_after");
  phase = "restore";
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  for (var s = 0; s < structLength; s++)
    frame[structOffset + s] = structOriginal[s];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("sys557_done");
  result = { id: "syscall557_confirm_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { ret592: call.value, errno592: errno,
      copy_extent: copyExtent, copy_hex: copyHex,
      new_handles_found: found.trim(),
      walk: walk.trim(), first_struct_hex: firstHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall557_confirm_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
