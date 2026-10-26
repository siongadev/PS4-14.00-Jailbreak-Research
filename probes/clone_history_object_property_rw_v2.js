// Resolve an object's live int32 slot by mutation, then reversibly write it
// through the forged view and check that a second object is unaffected.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
var index = -1;
var original = [];
var viewChanged = false;
try {
  if (!state || !state.view || !state.array || !state.a || !state.c ||
      !state.d || state.array[0] !== state.a ||
      state.c.marker !== 0x11223344 || state.d.marker !== 0x21324354)
    throw new Error("held_object_preflight_failed");
  var view = state.view;
  function matches(at, value) {
    return view[at] === (value & 255) &&
      view[at + 1] === (value >>> 8 & 255) &&
      view[at + 2] === (value >>> 16 & 255) &&
      view[at + 3] === (value >>> 24 & 255);
  }
  var candidates = [];
  var count = 0;
  for (var i = 2097152; i + 3 < 4194304; i++) {
    if (matches(i, 0x11223344)) {
      count++;
      if (candidates.length < 32) candidates.push(i);
    }
  }
  if (!count || count > 32) throw new Error("candidate_count_" + count);
  phase = "resolve_live_slot";
  var changed = [];
  try {
    state.c.marker = 0x55667788;
    for (var j = 0; j < candidates.length; j++)
      if (matches(candidates[j], 0x55667788)) changed.push(candidates[j]);
  } finally {
    state.c.marker = 0x11223344;
  }
  if (changed.length !== 1 || !matches(changed[0], 0x11223344))
    throw new Error("live_slot_count_" + changed.length);
  index = changed[0];
  for (var b = 0; b < 4; b++) original.push(view[index + b]);
  if (api && typeof api.markSync === "function")
    api.markSync("property_rw_v2_before_write");
  phase = "view_write";
  var aliasChanged = false;
  var otherUnchanged = false;
  var aliasRestored = false;
  viewChanged = true;
  try {
    for (var w = 0; w < 4; w++)
      view[index + w] = (0x55667788 >>> (w * 8)) & 255;
    aliasChanged = state.c.marker === 0x55667788 &&
      matches(index, 0x55667788);
    otherUnchanged = state.d.marker === 0x21324354;
  } finally {
    for (var r = 0; r < 4; r++) view[index + r] = original[r];
    viewChanged = false;
    aliasRestored = state.c.marker === 0x11223344 &&
      matches(index, 0x11223344) && state.array[0] === state.a;
  }
  if (api && typeof api.markSync === "function")
    api.markSync("property_rw_v2_restored");
  result = { id: "object_property_rw_v2",
    status: aliasChanged && otherUnchanged && aliasRestored ? "pass" : "fail",
    details: { index: index, candidates: count,
      alias_changed: aliasChanged, other_unchanged: otherUnchanged,
      alias_restored: aliasRestored } };
} catch (error) {
  if (state && state.c) state.c.marker = 0x11223344;
  if (viewChanged && state && state.view && original.length === 4 && index >= 0)
    for (var x = 0; x < 4; x++) state.view[index + x] = original[x];
  result = { id: "object_property_rw_v2", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
