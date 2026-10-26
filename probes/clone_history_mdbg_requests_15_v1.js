// Six previously untested request selectors, with a marker before each call.
// The last marker identifies the attempted selector if the page stops.
var result;
var phase = "preflight";
try {
  var native = window.__fw14NativeInvoke;
  if (!native || typeof native.call !== "function" ||
      typeof native.wrappers.sys601 !== "number")
    throw new Error("native_caller_missing");
  function mark(s) {
    try { if (api && typeof api.markSync === "function") api.markSync(s); }
    catch (_) {}
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("pid_invalid");
  var START = 15;
  mark("m15_start");
  var rows = [];
  for (var req = START; req < START + 6; req++) {
    phase = "request_" + req;
    mark("m15_before_" + req);
    var c = native.call("sys601", [req,0,0,0,0,0]);
    var e = c.value === -1 ? native.readErrno() : null;
    rows.push(req + ":" + c.value + "/" + c.high.toString(16) +
      "/" + (e === null ? "ok" : e));
  }
  var after = native.call("getpid", []);
  result = { id:"mdbg_requests_15_v1",
    status: after.value === before.value && after.high === 0 ? "pass":"fail",
    details:{pid:before.value, rows:rows.join("|")} };
} catch (error) {
  result = {id:"mdbg_requests_15_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}
return [result];

