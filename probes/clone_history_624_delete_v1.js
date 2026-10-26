// 624 handle-class check. 624 returns incrementing IDs (0x4050/0x4051 in
// the pairing run), which fit the NamedObj (generation << 13) | slot
// layout. 632/633/634 reject those IDs. Question: does 558 delete them,
// i.e. is 624 another creator in the same typed handle table? Two 624
// allocations, delete each, then double-delete the first as a guard.
// Self-created objects only; no module handles; PID verified.
var result;
var phase = "preflight";
try {
  var native = window.__fw14NativeInvoke;
  if (!native || typeof native.call !== "function" ||
      typeof native.wrappers.sys624 !== "number" ||
      typeof native.wrappers.sys558 !== "number")
    throw new Error("chain_or_wrapper_missing");
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function call(name, args) {
    var c = native.call(name, args);
    var errno = (c.value === -1) ? native.readErrno() : null;
    return { ret: c.value, errno: errno };
  }
  function fmt(o) {
    return o.ret + "/" + (o.errno === null ? "ok" : o.errno);
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("del624_preflight");
  phase = "alloc";
  var a = call("sys624", [0, 0, 0, 0, 0, 0]);
  var b = call("sys624", [0, 0, 0, 0, 0, 0]);
  var lines = ["a:" + fmt(a), "b:" + fmt(b)];
  if (a.errno !== null || a.ret <= 0 || b.errno !== null || b.ret <= 0)
    throw new Error("alloc_failed");
  mark("del624_allocated");
  phase = "delete";
  var da = call("sys558", [a.ret, 0, 0]);
  var db = call("sys558", [b.ret, 0, 0]);
  var da2 = call("sys558", [a.ret, 0, 0]);
  lines.push("del_a:" + fmt(da));
  lines.push("del_b:" + fmt(db));
  lines.push("del_a_again:" + fmt(da2));
  mark("del624_deleted");
  var after = native.call("getpid", []);
  mark("del624_done");
  result = { id: "del_624_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 400),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "del_624_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
