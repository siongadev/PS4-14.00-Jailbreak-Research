// 601 FULL REQUEST-TYPE SWEEP: arg1 = 0..255 through 601 mdbg_service.
// The brute force found arg1=4 returns 0 while 1/10/100/ffffffff all
// fail differently. This maps the complete request-type dispatch table.
// Each call: 601(arg1=N, 0, 0, 0, 0, 0) → record ret/errno.
// Markers every 32 requests. Process-local, read-only probing.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      typeof native.wrappers.sys601 !== "number")
    throw new Error("chain_missing");
  function mark(n) {
    try { if (api && typeof api.markSync === "function")
      api.markSync(n); } catch (e) {}
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("sw_preflight");
  var results = [];
  for (var req = 0; req <= 255; req++) {
    phase = "req_" + req;
    var c = native.call("sys601", [req, 0, 0, 0, 0, 0]);
    var e = (c.value === -1) ? native.readErrno() : null;
    var r = req + ":" + c.value + (e === null ? "" : "e" + e);
    results.push(r);
    if (req % 32 === 0) mark("sw_" + req);
  }
  mark("sw_done");
  var after = native.call("getpid", []);
  // Split into output fields
  var half = Math.ceil(results.length / 2);
  var loHalf = results.slice(0, half).join(",");
  var hiHalf = results.slice(half).join(",");
  result = { id: "mdbg_sweep_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { results_lo: loHalf.slice(0, 500),
      results_hi: hiHalf.slice(0, 500),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "mdbg_sweep_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
