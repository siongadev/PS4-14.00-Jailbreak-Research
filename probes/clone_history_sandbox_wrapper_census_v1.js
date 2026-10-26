// Recount the three live 14.00 syscall-wrapper pages. This only reads memory.
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
  var anchor = plan.target - 0xb60;
  if (anchor % 4096 !== 0 ||
      hexForward(readAddress(plan.target, 16)) !==
        "48c7c0140000004989ca0f057201c348" ||
      hexForward(readAddress(anchor + 0x5c0, 16)) !==
        "48c7c0c80100004989ca0f057201c348")
    throw new Error("live_wrapper_anchor_changed");
  var pages = [readAddress(anchor - 4096, 4096),
    readAddress(anchor, 4096), readAddress(anchor + 4096, 4096)];
  function wrappersIn(page) {
    var found = [];
    for (var o = 0; o <= page.length - 15; o++) {
      if (page[o] !== 0x48 || page[o + 1] !== 0xc7 ||
          page[o + 2] !== 0xc0 || page[o + 7] !== 0x49 ||
          page[o + 8] !== 0x89 || page[o + 9] !== 0xca ||
          page[o + 10] !== 0x0f || page[o + 11] !== 0x05 ||
          page[o + 12] !== 0x72 || page[o + 13] !== 0x01 ||
          page[o + 14] !== 0xc3)
        continue;
      var num = page[o + 3] + page[o + 4] * 256 +
        page[o + 5] * 65536 + page[o + 6] * 16777216;
      found.push(num);
    }
    return found;
  }
  var first = wrappersIn(pages[0]);
  var middle = wrappersIn(pages[1]);
  var last = wrappersIn(pages[2]);
  var all = first.concat(middle, last);
  var restored = hexLE(bytesAt(slot, 8)) === hexLE(original) &&
    carrier[0] === 0x31 && carrier[7] === 0xa8 &&
    state.array[0] === state.a;
  result = { id: "sandbox_wrapper_census_v1",
    status: restored && middle.indexOf(20) >= 0 &&
      middle.indexOf(456) >= 0 && all.length >= 200 ? "pass" : "fail",
    details: { anchor: "0x" + anchor.toString(16),
      before_count: first.length, anchor_count: middle.length,
      after_count: last.length, total_count: all.length,
      has_221: all.indexOf(221) >= 0,
      has_222: all.indexOf(222) >= 0,
      has_510: all.indexOf(510) >= 0,
      view_restored: restored } };
} catch (error) {
  if (slot >= 0 && original.length === 8 && state && state.view)
    for (var y = 0; y < 8; y++) state.view[slot + y] = original[y];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "sandbox_wrapper_census_v1", status: "error",
    details: { error: String(error).slice(0, 200) } };
}
return [result];
