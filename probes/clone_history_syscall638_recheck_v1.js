// Syscall 638 recheck on a fresh boot: sel=0 re-derives this boot's base
// pointer and the candidate kbase via the 10/17 offset 0x3B1AABA0, and the
// two wrapped selectors re-test the arg3 divergence seen at 0x7FFFFFFF /
// 0xFFFFFFFF on 10/17 (arg3[0:7] left the fixed value there). The in-window
// uniformity question is NOT re-run: 12 page-spaced selectors 0..0x545F
// were already constant on 10/17 (deep_638_read_test_result). All u64
// values are handled as 32-bit halves; no Number above 2^53.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys638 !== "number")
    throw new Error("chain_or_sys638_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var outOffset = 0x600, structOffset = 0x620;
  var outAddress = address + outOffset;
  var structAddress = address + structOffset;
  var original = Array.from(frame.subarray(outOffset, structOffset + 0x10));
  function put32(offset, value) {
    frame[offset] = value & 255; frame[offset + 1] = (value >>> 8) & 255;
    frame[offset + 2] = (value >>> 16) & 255;
    frame[offset + 3] = (value >>> 24) & 255;
  }
  function hexAt(offset, count) {
    var out = "";
    for (var i = count - 1; i >= 0; i--)
      out += ("0" + frame[offset + i].toString(16)).slice(-2);
    return out;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  function call638(sel) {
    frame.fill(0x41, outOffset, structOffset + 0x10);
    var call = native.call("sys638",
      [sel, outAddress, structAddress]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    return { ret: call.value, ret_high: call.high, errno: errno,
      out_hex: hexAt(outOffset, 8),
      ptr_hex: hexAt(structOffset, 8),
      lo_hex: hexAt(structOffset + 8, 4),
      out_prefill: hexAt(outOffset, 8).indexOf("41") === 0 &&
        frame[outOffset] === 0x41 };
  }
  if (api && typeof api.markSync === "function")
    api.markSync("sys638_preflight");
  phase = "sel0";
  var base = call638(0);
  if (api && typeof api.markSync === "function")
    api.markSync("sys638_base");
  // kbase candidate = base - 0x3B1AABA0 in 32-bit halves
  var baseHi = parseInt(base.out_hex.slice(0, 8), 16) >>> 0;
  var baseLo = parseInt(base.out_hex.slice(8, 16), 16) >>> 0;
  var kbaseLo = (baseLo - 0x3b1aaba0) >>> 0;
  var borrow = (baseLo >>> 0) < 0x3b1aaba0 ? 1 : 0;
  var kbaseHi = (baseHi - borrow) >>> 0;
  var kbaseHex = ("00000000" + kbaseHi.toString(16)).slice(-8) +
                 ("00000000" + kbaseLo.toString(16)).slice(-8);
  phase = "wrapped";
  var wrapA = call638(0x7fffffff);
  var wrapB = call638(0xffffffff);
  if (api && typeof api.markSync === "function")
    api.markSync("sys638_wrapped");
  for (var i = 0; i < original.length; i++)
    frame[outOffset + i] = original[i];
  var restored = true;
  for (var i = 0; i < original.length; i++)
    if (frame[outOffset + i] !== original[i]) { restored = false; break; }
  var after = native.call("getpid", []);
  var sameAs1017 = base.out_hex === "ffffffffffffaba0";
  result = { id: "syscall638_recheck_v1",
    status: (base.ret === 0 && after.value === before.value &&
      after.high === 0 && restored) ? "pass" : "fail",
    details: { ret: base.ret, errno: base.errno,
      base_hex: base.out_hex,
      kbase_cand_hex: kbaseHex,
      base_same_1017: sameAs1017,
      ptr_at_base_hex: base.ptr_hex,
      lo32_hex: base.lo_hex,
      wrap7f_out_hex: wrapA.out_hex,
      wrap7f_ptr_hex: wrapA.ptr_hex,
      wrapff_out_hex: wrapB.out_hex,
      wrapff_ptr_hex: wrapB.ptr_hex,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall638_recheck_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
