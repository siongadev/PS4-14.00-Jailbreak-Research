// Syscall 540 single instrumented trial. On 10/16 the EFAULT
// characterization recorded 540(ownedPtr,0,0,0,0) returning -1/errno 3 with
// the owned buffer untouched but the guard region AFTER it written
// (ownedGuardIntact=false), reproduced in three capture runs. The kernel
// wrote past a user buffer's end on an error path; the written extent and
// content were never captured. This probe repeats that exact argument shape
// once, with eight 64-byte guard bands carrying distinct fill bytes, and
// measures which bands changed, the first/last changed offsets, and the
// written bytes. ONE TRIAL ONLY: reboot the console before any further 540
// work so repeated kernel-side writes cannot accumulate. The write lands in
// this process's own memory; worst case is a WebProcess reload, not a
// console event.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys540 !== "number")
    throw new Error("chain_or_sys540_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var ownedOffset = 0x600, ownedLength = 0x100;
  var bandCount = 8, bandLength = 0x40;
  var guardOffset = ownedOffset + ownedLength;
  var regionEnd = guardOffset + bandCount * bandLength;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var ownedAddress = address + ownedOffset;
  var original = Array.from(frame.subarray(ownedOffset, regionEnd));
  function call540() {
    var call = native.call("sys540",
      [ownedAddress, 0, 0, 0, 0, 0]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    return { ret: call.value, errno: errno };
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync === "function")
    api.markSync("sys540_preflight");
  phase = "arm";
  frame.fill(0, ownedOffset, ownedOffset + ownedLength);
  for (var b = 0; b < bandCount; b++)
    frame.fill(0x11 * (b + 1), guardOffset + b * bandLength,
               guardOffset + (b + 1) * bandLength);
  var bands = [];
  for (var c = 0; c < bandCount; c++) bands.push(true);
  var extentFirst = -1, extentLast = -1;
  var guardHex = "";
  if (api && typeof api.markSync === "function")
    api.markSync("sys540_before");
  phase = "call";
  var call = call540();
  if (api && typeof api.markSync === "function")
    api.markSync("sys540_after");
  phase = "measure";
  var ownedIntact = true;
  for (var o = 0; o < ownedLength; o++)
    if (frame[ownedOffset + o] !== 0) { ownedIntact = false; break; }
  var hitCount = 0;
  for (var b2 = 0; b2 < bandCount; b2++) {
    var base = guardOffset + b2 * bandLength;
    for (var j = 0; j < bandLength; j++) {
      if (frame[base + j] !== 0x11 * (b2 + 1)) {
        bands[b2] = false;
        hitCount += 1;
        var offset = base + j - guardOffset;
        if (extentFirst === -1 || offset < extentFirst)
          extentFirst = offset;
        if (offset > extentLast) extentLast = offset;
      }
    }
  }
  if (extentFirst !== -1) {
    var dumpStart = guardOffset + extentFirst;
    var dumpLength = Math.min(64, extentLast - extentFirst + 1);
    for (var d = 0; d < dumpLength; d++)
      guardHex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
  }
  var restored = true;
  for (var r = 0; r < original.length; r++)
    if (frame[ownedOffset + r] !== original[r]) { restored = false; break; }
  var after = native.call("getpid", []);
  var extent = (extentFirst === -1) ? 0 : extentLast - extentFirst + 1;
  var bandsHit = 0;
  for (var b3 = 0; b3 < bandCount; b3++) if (!bands[b3]) bandsHit += 1;
  result = { id: "syscall540_probe_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { ret: call.ret, errno: call.errno,
      owned_intact: ownedIntact,
      bands_hit: bandsHit + "/" + bandCount,
      first_off: extentFirst, last_off: extentLast,
      extent_bytes: extent, guard_hex: guardHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall540_probe_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
