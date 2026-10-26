// Read two live JSArray words, substitute one observed word, then restore.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
var changed = false;
var index = -1;
var original = [];
try {
  if (!state || !state.view || !state.array || !state.a || !state.b ||
      state.array.length !== 8192 || state.array[0] !== state.a ||
      state.array[1] !== state.a || !Number.isInteger(state.index) ||
      state.index < 0 || state.index % 8 !== 0)
    throw new Error("held_array_preflight_failed");
  index = state.index;
  var view = state.view;
  function readWord() {
    var out = [];
    for (var i = 0; i < 8; i++) out.push(view[index + i]);
    return out;
  }
  function hex(bytes) {
    var out = "0x";
    for (var i = 7; i >= 0; i--)
      out += bytes[i].toString(16).padStart(2, "0");
    return out;
  }
  original = readWord();
  state.array[0] = state.b;
  var replacement = readWord();
  state.array[0] = state.a;
  var assignmentRestored = state.array[0] === state.a &&
      readWord().join(",") === original.join(",");
  var byteDifferences = 0;
  for (var j = 0; j < 8; j++)
    if (original[j] !== replacement[j]) byteDifferences++;
  if (!assignmentRestored || byteDifferences === 0)
    throw new Error("assignment_word_not_stable");
  phase = "write_observed_word";
  if (api && typeof api.markSync === "function") api.markSync("array_word_before_write");
  changed = true;
  var aliasChanged = false;
  var aliasRestored = false;
  try {
    for (var w = 0; w < 8; w++) view[index + w] = replacement[w];
    aliasChanged = state.array[0] === state.b &&
        state.array[0].marker === "B" &&
        readWord().join(",") === replacement.join(",");
  } finally {
    for (var x = 0; x < 8; x++) view[index + x] = original[x];
    aliasRestored = state.array[0] === state.a &&
        state.array[0].marker === "A" &&
        readWord().join(",") === original.join(",");
  }
  changed = false;
  if (api && typeof api.markSync === "function") api.markSync("array_word_restored");
  result = { id: "jsarray_word_rw", status: aliasChanged && aliasRestored ? "pass" : "fail", details: {
    word_index: index, a_word: hex(original), b_word: hex(replacement),
    byte_differences: byteDifferences, assignment_restored: assignmentRestored,
    alias_changed: aliasChanged, alias_restored: aliasRestored
  } };
} catch (error) {
  if (changed && state && state.view && original.length === 8 && index >= 0)
    for (var y = 0; y < 8; y++) state.view[index + y] = original[y];
  result = { id: "jsarray_word_rw", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
