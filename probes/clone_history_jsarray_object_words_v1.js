// Read JSArray element words for three owned values and one native function.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
try {
  if (!state || !state.view || !state.array || !state.a || !state.b ||
      state.array.length !== 8192 || state.array[0] !== state.a ||
      !Number.isInteger(state.index) || state.index < 0 ||
      state.index % 8 !== 0 || typeof Math.expm1 !== "function")
    throw new Error("held_array_preflight_failed");
  var view = state.view;
  var index = state.index;
  var c = { marker: "C" };
  var nativeFunction = Math.expm1;
  state.c = c;
  state.nativeFunction = nativeFunction;
  function word() {
    var out = "0x";
    for (var i = 7; i >= 0; i--)
      out += view[index + i].toString(16).padStart(2, "0");
    return out;
  }
  var aWord = word();
  var bWord = "";
  var cWord = "";
  var functionWord = "";
  var bIdentity = false;
  var cIdentity = false;
  var functionIdentity = false;
  var restored = false;
  phase = "assignments";
  try {
    state.array[0] = state.b;
    bWord = word();
    bIdentity = state.array[0] === state.b && state.array[0].marker === "B";
    state.array[0] = c;
    cWord = word();
    cIdentity = state.array[0] === c && state.array[0].marker === "C";
    state.array[0] = nativeFunction;
    functionWord = word();
    functionIdentity = state.array[0] === Math.expm1 &&
        state.array[0](1) === Math.expm1(1);
  } finally {
    state.array[0] = state.a;
    restored = state.array[0] === state.a && word() === aWord;
  }
  var distinct = aWord !== bWord && aWord !== cWord &&
      aWord !== functionWord && bWord !== cWord &&
      bWord !== functionWord && cWord !== functionWord;
  result = { id: "jsarray_object_words", status:
    bIdentity && cIdentity && functionIdentity && restored && distinct ?
        "pass" : "fail", details: {
      word_index: index, a_word: aWord, b_word: bWord, c_word: cWord,
      function_word: functionWord, b_identity: bIdentity,
      c_identity: cIdentity, function_identity: functionIdentity,
      restored: restored, distinct: distinct
    } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "jsarray_object_words", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
