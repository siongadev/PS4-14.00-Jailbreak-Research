// Read-only comparison of callable object cells allocated on this page.
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
    api.markSync("callable_matrix_base_calibrated");
  phase = "callables";
  function ordinary(x) { return x + 11; }
  var boundJs = ordinary.bind(null);
  var boundNative = Math.expm1.bind(null);
  var boundDom = document.createElement.bind(document);
  state.callableMatrix = [ordinary, boundJs, boundNative, boundDom];
  function read32(at) {
    var out = "";
    for (var b = 0; b < 32; b++)
      out += view[at + b].toString(16).padStart(2, "0");
    return out;
  }
  function row(value) {
    var word = wordOf(value);
    var index = Number(word) - base;
    return word + ":" + index + ":" +
      (Number.isSafeInteger(index) && index >= 0 && index + 31 < 4194304 ?
        read32(index) : "outside");
  }
  var normal = ordinary(5) === 16 && boundJs(5) === 16 &&
    Math.abs(boundNative(1) - Math.expm1(1)) < 1e-12 &&
    boundDom("span").nodeName === "SPAN";
  result = { id: "callable_cell_matrix",
    status: normal && state.array[0] === state.a ? "pass" : "fail",
    details: { base: "0x" + base.toString(16),
      ordinary: row(ordinary), bound_js: row(boundJs),
      bound_native: row(boundNative), bound_dom: row(boundDom),
      expm1: row(Math.expm1), normal: normal,
      array_restored: state.array[0] === state.a } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "callable_cell_matrix", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
