// Live SysCore client-state read. Measures the current module base from
// module handle 28, then reads the RX init/guard signatures and the RW
// state: +0xC088/+0xC089 flags, +0xC060 App2 client pointer, +0x40/+0x48
// first-path client. Read-only; full restore; PID verified.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var native = window.__fw14NativeInvoke;
  if (!state || !native || typeof native.call !== "function" ||
      !state.view || !state.array || !state.a || !state.ownedTypedView ||
      !Number.isSafeInteger(state.calibratedViewBase) ||
      state.array[0] !== state.a || !native.frame ||
      !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.dynlib_info_ex !== "number")
    throw new Error("held_state_or_wrapper_missing");
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
    if (!Number.isSafeInteger(addressValue) || count < 1 || count > 64)
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
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("syscore_state_preflight");
  var infoOffset = 0x300;
  var infoLength = 0x1a8;
  var infoOriginal = Array.from(native.frame.subarray(infoOffset,
    infoOffset + infoLength));
  var infoDv = new DataView(native.frame.buffer, native.frame.byteOffset,
    native.frame.byteLength);
  var moduleBase = 0;
  try {
    native.frame.fill(0, infoOffset, infoOffset + infoLength);
    infoDv.setUint32(infoOffset, infoLength, true);
    var info = native.call("dynlib_info_ex",
      [28, 0, native.frameAddress + infoOffset]);
    if (info.value !== 0) throw new Error("syscore_info_failed");
    var lo = infoDv.getUint32(infoOffset + 0x110, true);
    var hi = infoDv.getUint32(infoOffset + 0x114, true);
    moduleBase = hi * 0x100000000 + lo;
  } finally {
    for (var ix = 0; ix < infoLength; ix++)
      native.frame[infoOffset + ix] = infoOriginal[ix];
  }
  if (moduleBase < 0x800000000 || moduleBase >= 0x900000000 ||
      moduleBase % 4096 !== 0)
    throw new Error("syscore_base_invalid");
  mark("syscore_state_base");
  var rxSig1e0 = toHex(readAt(moduleBase + 0x1e0, 16));
  var rxSig3a0 = toHex(readAt(moduleBase + 0x3a0, 16));
  var rxSig5e0 = toHex(readAt(moduleBase + 0x5e0, 16));
  var flags = readAt(moduleBase + 0xc088, 2);
  var app2 = valueOf(readAt(moduleBase + 0xc060, 8));
  var app1 = valueOf(readAt(moduleBase + 0x40, 8));
  mark("syscore_state_read");
  var after = native.call("getpid", []);
  var restored = true;
  for (var r = 0; r < carrierOriginal.length; r++) {}
  result = { id: "syscore_state_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { base: "0x" + moduleBase.toString(16),
      flags: flags[0] + "/" + flags[1],
      app1: "0x" + app1.toString(16),
      app2: "0x" + app2.toString(16),
      sig_1e0: rxSig1e0, sig_3a0: rxSig3a0, sig_5e0: rxSig5e0,
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "syscore_state_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
