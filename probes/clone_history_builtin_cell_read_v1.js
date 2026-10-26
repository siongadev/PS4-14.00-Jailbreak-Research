// Read-only 96-byte comparison of two live built-in function objects.
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
  phase = "read_builtins";
  var expWord = wordOf(Math.expm1);
  var logWord = wordOf(Math.log1p);
  var expIndex = Number(expWord) - base;
  var logIndex = Number(logWord) - base;
  if (!Number.isSafeInteger(expIndex) || !Number.isSafeInteger(logIndex) ||
      expIndex < 0 || logIndex < 0 ||
      expIndex + 95 >= 4194304 || logIndex + 95 >= 4194304)
    throw new Error("builtin_cell_outside_window");
  function read96(at) {
    var out = "";
    for (var b = 0; b < 96; b++)
      out += view[at + b].toString(16).padStart(2, "0");
    return out;
  }
  var expBytes = read96(expIndex);
  var logBytes = read96(logIndex);
  var normal = Math.abs(Math.expm1(1) - 1.718281828459045) < 1e-12 &&
    Math.abs(Math.log1p(1) - 0.6931471805599453) < 1e-12;
  result = { id: "builtin_cell_read",
    status: normal && state.array[0] === state.a ? "pass" : "fail",
    details: { base: "0x" + base.toString(16),
      expm1_word: expWord, expm1_index: expIndex,
      expm1_bytes: expBytes, log1p_word: logWord,
      log1p_index: logIndex, log1p_bytes: logBytes,
      normal: normal, array_restored: state.array[0] === state.a } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "builtin_cell_read", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
