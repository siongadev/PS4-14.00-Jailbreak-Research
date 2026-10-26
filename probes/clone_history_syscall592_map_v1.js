// Syscall 592→608 FULL module map: one 592 list call, then 608 per handle
// with the input size word (0x1a8) written at struct+0x00 (per walk v3b,
// capture 34bb5b57: 26/26 handles resolved, name at struct+0x10, base at
// struct+0x110). Every module is recorded as "id@base=name"; entries split
// across three detail fields to stay under the collector's 512-char string,
// 12-field, and 3600-char limits. Read-only in-process queries; wrappers
// byte-gated by v19; markers 6 of 8.
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
  function hex8(value) {
    return ("00000000" + value.toString(16)).slice(-8);
  }
  function readName() {
    var out = "";
    for (var i = 0x10; i < 0x30; i++) {
      var ch = frame[structOffset + i];
      if (ch === 0) break;
      if (ch >= 32 && ch < 127 && out.length < 26)
        out += String.fromCharCode(ch);
    }
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
  phase = "walk";
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_walk_before");
  var handles = [0x2001, 0x2, 0x10, 0x12, 0x13, 0x14, 0x16, 0x17,
    0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x2c, 0x2e, 0x2f, 0x30,
    0x31, 0x3a, 0x3b, 0x3c, 0x3d, 0x48, 0x49, 0x53];
  var fields = ["", "", ""];
  var walkOk = 0, walkFail = 0;
  var structOriginal = Array.from(frame.subarray(structOffset,
    structOffset + structLength));
  for (var m = 0; m < handles.length; m++) {
    frame.fill(0, structOffset, structOffset + structLength);
    frame[structOffset] = 0xa8; frame[structOffset + 1] = 0x01;
    var info = native.call("dynlib_info_ex",
      [handles[m], 0, structAddress]);
    var errnoW = (info.value === -1) ? native.readErrno() : null;
    var baseLo = (frame[structOffset + 0x110]) |
                 (frame[structOffset + 0x111] << 8) |
                 (frame[structOffset + 0x112] << 16) |
                 (frame[structOffset + 0x113] << 24);
    var baseHi = (frame[structOffset + 0x114]) |
                 (frame[structOffset + 0x115] << 8) |
                 (frame[structOffset + 0x116] << 16) |
                 (frame[structOffset + 0x117] << 24);
    var entry;
    if (info.value !== 0) {
      entry = handles[m].toString(16) + "@ERR" + errnoW + " ";
      walkFail += 1;
    } else {
      entry = handles[m].toString(16) + "@" +
        baseHi.toString(16) + hex8(baseLo) + "=" + readName() + " ";
      walkOk += 1;
    }
    fields[m < 9 ? 0 : (m < 18 ? 1 : 2)] += entry;
    for (var r0 = 0; r0 < structLength; r0++)
      frame[structOffset + r0] = structOriginal[r0];
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
  result = { id: "syscall592_map_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored && walkOk > 0 && walkFail === 0) ? "pass" : "fail",
    details: { ret592: call.value, errno592: errno,
      walk_ok: walkOk, walk_fail: walkFail,
      modules_a: fields[0].trim(), modules_b: fields[1].trim(),
      modules_c: fields[2].trim(),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall592_map_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
