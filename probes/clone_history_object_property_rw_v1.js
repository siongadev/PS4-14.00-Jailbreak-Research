// Reversibly write one rooted object's inline int32 property through the
// forged byte view. The unique signature must be rediscovered in this run.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
var index = -1;
var original = [];
var changed = false;
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
  var count = 0;
  for (var i = 2097152; i + 3 < 4194304; i++) {
    if (matches(i, 0x11223344)) {
      count++;
      index = i;
      if (count > 1) break;
    }
  }
  if (count !== 1) throw new Error("signature_not_unique_" + count);
  for (var b = 0; b < 4; b++) original.push(view[index + b]);
  if (api && typeof api.markSync === "function")
    api.markSync("property_rw_before_write");
  phase = "write";
  var aliasChanged = false;
  var otherUnchanged = false;
  var aliasRestored = false;
  changed = true;
  try {
    for (var w = 0; w < 4; w++)
      view[index + w] = (0x55667788 >>> (w * 8)) & 255;
    aliasChanged = state.c.marker === 0x55667788 &&
      matches(index, 0x55667788);
    otherUnchanged = state.d.marker === 0x21324354;
  } finally {
    for (var r = 0; r < 4; r++) view[index + r] = original[r];
    aliasRestored = state.c.marker === 0x11223344 &&
      matches(index, 0x11223344) && state.array[0] === state.a;
    changed = false;
  }
  if (api && typeof api.markSync === "function")
    api.markSync("property_rw_restored");
  result = { id: "object_property_rw",
    status: aliasChanged && otherUnchanged && aliasRestored ? "pass" : "fail",
    details: { index: index, candidates: count,
      alias_changed: aliasChanged, other_unchanged: otherUnchanged,
      alias_restored: aliasRestored } };
} catch (error) {
  if (changed && state && state.view && original.length === 4 && index >= 0)
    for (var x = 0; x < 4; x++) state.view[index + x] = original[x];
  result = { id: "object_property_rw", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
