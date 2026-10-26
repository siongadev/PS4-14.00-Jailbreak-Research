// Bisect C: zero-arg-only walk of 658-662 with a marker BEFORE each
// syscall. Bisect A (all four shapes over 658-662) died after
// preflight; the crasher is one of these five. z-shape only + one
// mark per syscall means the LAST marker received names the killer
// exactly (or clears all five if the crash needs pointer shapes —
// then per-syscall shape escalation follows). PID + restore checked.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress))
    throw new Error("chain_missing");
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("zc_preflight");
  var numbers = ["sys658", "sys659", "sys660", "sys661", "sys662"];
  var lines = [];
  for (var n = 0; n < numbers.length; n++) {
    var name = numbers[n];
    phase = name;
    if (!native.wrappers[name]) {
      lines.push(name.replace("sys", "") + ":absent");
      continue;
    }
    mark("zc_before_" + name.replace("sys", ""));
    var call = native.call(name, [0, 0, 0, 0, 0, 0]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    lines.push(name.replace("sys", "") + ":z(" + call.value + "/" +
      (errno === null ? "ok" : errno) + ")");
  }
  var after = native.call("getpid", []);
  mark("zc_done");
  result = { id: "bisect_c_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 400),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "bisect_c_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
