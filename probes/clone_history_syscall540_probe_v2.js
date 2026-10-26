// Syscall 540 instrumented trial, v2. v1 result (2026-10-21, boot with
// installer v19): 540(ownedPtr,0,0,0,0,0) returned -1/errno 3 with ZERO
// guard hits across owned+0x100..+0x300, while the 10/16 harness caught its
// guard break at owned_end with OWNED_PAD=0x400. Working hypothesis: the
// kernel writes at a FIXED offset near +0x400 from the pointer, so v1's
// scan window simply did not reach it. v2 scans owned+0x000..+0x1000 with a
// position-encoded fill so the first and last changed offsets directly give
// the write placement, and dumps the written bytes. ALSO fixes v1's editing
// bug: the original region is now restored AND verified (v1 checked without
// restoring, so region_restored:false there was a probe bug, not a console
// event). ONE TRIAL ONLY: reboot the console before any further 540 work.
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
  var scanOffset = ownedOffset;                 // 0x600
  var scanLength = 0x1000;                      // owned .. owned+0x1000
  var regionEnd = scanOffset + scanLength;      // 0x1600 < 0x2000
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var ownedAddress = address + ownedOffset;
  var original = Array.from(frame.subarray(scanOffset, regionEnd));
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
  for (var i = ownedLength; i < scanLength; i++)
    frame[scanOffset + i] = (i * 7 + 3) & 255;
  var armed = [];
  for (var a = 0; a < scanLength; a++) armed.push(frame[scanOffset + a]);
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
  var firstOff = -1, lastOff = -1;
  for (var s = ownedLength; s < scanLength; s++) {
    if (frame[scanOffset + s] !== armed[s]) {
      if (firstOff === -1) firstOff = s;
      lastOff = s;
    }
  }
  var guardHex = "";
  if (firstOff !== -1) {
    var dumpStart = scanOffset + firstOff;
    var dumpLength = Math.min(128, lastOff - firstOff + 1);
    for (var d = 0; d < dumpLength; d++)
      guardHex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
  }
  for (var r = 0; r < original.length; r++)
    frame[scanOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[scanOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  result = { id: "syscall540_probe_v2",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { ret: call.ret, errno: call.errno,
      owned_intact: ownedIntact,
      first_off: firstOff, last_off: lastOff,
      extent_bytes: (firstOff === -1) ? 0 : lastOff - firstOff + 1,
      guard_hex: guardHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall540_probe_v2", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
