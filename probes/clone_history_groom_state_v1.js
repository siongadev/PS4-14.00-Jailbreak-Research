var state = window.__fw14ArrayState;
var result;
try {
  if (!state || !state.view || !state.array || !state.a ||
      state.array[0] !== state.a)
    throw new Error("groom_state_missing");
  var batches = state.groomBatches ? state.groomBatches.length : 0;
  var anchor = state.addressAnchor;
  var base = state.calibratedViewBase;
  var word = 0;
  var index = -1;
  var live = false;
  if (anchor && Number.isSafeInteger(base)) {
    var hex = "0x";
    try {
      state.array[0] = anchor;
      for (var w = 7; w >= 0; w--)
        hex += state.view[state.index + w].toString(16).padStart(2, "0");
    } finally {
      state.array[0] = state.a;
    }
    word = Number(hex);
    index = word + 8 - base;
    live = Number.isSafeInteger(index) && index >= 0 &&
      index + 3 < 2097152 && anchor.marker === 0x11223344 &&
      state.view[index] === 0x44 && state.view[index + 1] === 0x33 &&
      state.view[index + 2] === 0x22 && state.view[index + 3] === 0x11;
  }
  result = { id: "groom_state_v1", status: "pass", details: {
    batches: batches, anchor_present: !!anchor,
    base: Number.isSafeInteger(base) ? "0x" + base.toString(16) : "none",
    word: word ? "0x" + word.toString(16) : "none",
    index: index, live: live
  } };
} catch (error) {
  result = { id: "groom_state_v1", status: "error",
    details: { error: String(error).slice(0, 200) } };
} finally {
  if (state && state.array && state.a) state.array[0] = state.a;
}
return [result];
