// Root a bounded batch of ordinary objects, then disclose one new marker cell.
var state = window.__fw14ArrayState;
var result;
try {
  if (!state || !state.view || !state.array || !state.a ||
      state.array[0] !== state.a || !Number.isInteger(state.index))
    throw new Error("held_array_preflight_failed");
  var batch = [];
  for (var i = 0; i < 32768; i++) batch.push({ pad: i });
  if (!state.anchorSpacers) state.anchorSpacers = [];
  state.anchorSpacers.push(batch);
  var anchor = { marker: 0x11223344 };
  state.addressAnchor = anchor;
  var bytes = [];
  try {
    state.array[0] = anchor;
    for (var j = 0; j < 8; j++)
      bytes.push(state.view[state.index + j]);
  } finally {
    state.array[0] = state.a;
  }
  var hex = "0x";
  for (var k = 7; k >= 0; k--)
    hex += bytes[k].toString(16).padStart(2, "0");
  result = { id: "anchor_advance_v1", status: "pass",
    details: { anchor_word: hex, batches: state.anchorSpacers.length,
      rooted_objects: state.anchorSpacers.length * 32768,
      marker: anchor.marker, array_restored: state.array[0] === state.a } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "anchor_advance_v1", status: "error",
    details: { error: String(error).slice(0, 200) } };
}
return [result];
