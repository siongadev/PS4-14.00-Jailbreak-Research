var state = window.__fw14ArrayState;
var result;
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || state.addressAnchor.marker !== 0x11223344 ||
      state.array[0] !== state.a)
    throw new Error("held_anchor_preflight_failed");
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
  result = { id: "anchor_word_only_v1", status: "pass",
    details: { anchor_word: hex, array_index: state.index,
      anchor_marker: state.addressAnchor.marker,
      array_restored: state.array[0] === state.a } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "anchor_word_only_v1", status: "error",
    details: { error: String(error).slice(0, 200) } };
}
return [result];
