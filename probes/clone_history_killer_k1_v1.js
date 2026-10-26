// K1: bank the zero-arg results of 658/659/660 — the three syscalls
// bisect C proved z-safe before dying inside 661. Their ret/errno was
// lost with the crashed probe. Safe by construction (same z shape
// already survived on a prior page); PID + marker bookends.
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
  mark("k1_preflight");
  var numbers = ["sys658", "sys659", "sys660"];
  var lines = [];
  for (var n = 0; n < numbers.length; n++) {
    var name = numbers[n];
    phase = name;
    if (!native.wrappers[name]) {
      lines.push(name.replace("sys", "") + ":absent");
      continue;
    }
    var call = native.call(name, [0, 0, 0, 0, 0, 0]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    lines.push(name.replace("sys", "") + ":z(" + call.value + "/" +
      (errno === null ? "ok" : errno) + ")");
  }
  var after = native.call("getpid", []);
  mark("k1_done");
  result = { id: "killer_k1_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 400),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "killer_k1_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
