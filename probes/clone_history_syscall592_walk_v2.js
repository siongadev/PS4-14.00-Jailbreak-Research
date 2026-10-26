// Syscall 592→608 module walk, v2. v1 findings: the 592 copyout is exactly
// 108 bytes; v1's u32 walk polluted its tail with the position-encoded fill
// bytes past the copy end, and every 608(dynlib_info_ex) call returned -1
// with errno uncaptured and no positive control. v2: (1) capture the RAW
// copyout bytes (256B window) un-parsed for offline structure analysis;
// (2) run a positive control — 608 with handles 27 and 28, known-good in
// prior sessions; (3) record errno on every 608 call; (4) parse handles
// only from the true 108-byte copy extent. Read-only; wrappers byte-gated
// by v19; markers 6 of 8.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
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
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_preflight");
  phase = "list_call";
  for (var i = 0; i < bufLength; i++)
    frame[bufOffset + i] = (i * 7 + 3) & 255;
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_list_before");
  var call = native.call("dynlib_list", [bufAddress, bufLength]);
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_list_after");
  var errno = (call.value === -1) ? native.readErrno() : null;
  var copyExtent = 0;
  for (var c = 0; c < bufLength; c++) {
    if (frame[bufOffset + c] !== ((c * 7 + 3) & 255)) copyExtent = c + 1;
  }
  var copyHex = hexAt(bufOffset, Math.min(copyExtent, 256));
  phase = "control";
  var structOriginal = Array.from(frame.subarray(structOffset,
    structOffset + structLength));
  var controls = "";
  for (var h = 0; h < 2; h++) {
    var handle = (h === 0) ? 27 : 28;
    frame.fill(0, structOffset, structOffset + structLength);
    var info = native.call("dynlib_info_ex",
      [handle, 0, structAddress]);
    var werrno = (info.value === -1) ? native.readErrno() : null;
    controls += handle + ":ret" + info.value + "/e" + werrno + " ";
  }
  phase = "walk";
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_walk_before");
  var handles = [0x2001, 0x2, 0x10, 0x12, 0x13, 0x14, 0x16, 0x17,
    0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x2c, 0x2e, 0x2f, 0x30,
    0x31, 0x3a, 0x3b, 0x3c, 0x3d, 0x48, 0x49, 0x53];
  var walk = "";
  var walkOk = 0, firstOkHex = "";
  for (var m = 0; m < handles.length; m++) {
    frame.fill(0, structOffset, structOffset + structLength);
    var info2 = native.call("dynlib_info_ex",
      [handles[m], 0, structAddress]);
    var werrno2 = (info2.value === -1) ? native.readErrno() : null;
    walk += handles[m].toString(16) + ":r" + info2.value +
      "/e" + werrno2 + " ";
    if (info2.value === 0) {
      walkOk += 1;
      if (firstOkHex === "")
        firstOkHex = hexAt(structOffset, 0x40);
    }
  }
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_walk_after");
  phase = "restore";
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  for (var s = 0; s < structLength; s++)
    frame[structOffset + s] = structOriginal[s];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_done");
  result = { id: "syscall592_walk_v2",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { ret592: call.value, errno592: errno,
      copy_extent: copyExtent, copy_hex: copyHex,
      controls: controls.trim(),
      walk_ok: walkOk, walk_errnos: walk.trim(),
      first_ok_struct_hex: firstOkHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall592_walk_v2", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
