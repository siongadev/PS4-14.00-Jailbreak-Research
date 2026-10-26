// K3: state-dependency test for the 661 killer. 661 dies on zero args
// AND on valid pointer shapes (bisect C marker zc_before_661; K2
// marker k2_before_661_buf). The faulting pointer must come from
// process/kernel state. Neighbor signatures: 659 z -> ENOMEM (it
// ALLOCATES at zero args — the only sibling that touches an
// allocator), 660 z -> EFAULT, 658 z -> errno 15. Question: does a
// 659 allocation (or a 660/658 call) first change the state 661
// reads, so 661 SURVIVES? Sequence: 658z, 659z, 660z (banked by
// markers), then 661 z. If 661 returns — state dependency found, the
// entry condition is steerable. If the page dies — 661 kills
// unconditionally in this process context. Mark before every call.
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
  mark("k3_preflight");
  mark("k3_before_658");
  var c658 = native.call("sys658", [0, 0, 0, 0, 0, 0]);
  var e658 = (c658.value === -1) ? native.readErrno() : null;
  mark("k3_before_659");
  var c659 = native.call("sys659", [0, 0, 0, 0, 0, 0]);
  var e659 = (c659.value === -1) ? native.readErrno() : null;
  mark("k3_before_660");
  var c660 = native.call("sys660", [0, 0, 0, 0, 0, 0]);
  var e660 = (c660.value === -1) ? native.readErrno() : null;
  mark("k3_before_661");
  var c661 = native.call("sys661", [0, 0, 0, 0, 0, 0]);
  var e661 = (c661.value === -1) ? native.readErrno() : null;
  mark("k3_after_661");
  var lines = ["658:" + c658.value + "/" + (e658 === null ? "ok" : e658),
    "659:" + c659.value + "/" + (e659 === null ? "ok" : e659),
    "660:" + c660.value + "/" + (e660 === null ? "ok" : e660),
    "661:" + c661.value + "/" + (e661 === null ? "ok" : e661)];
  var after = native.call("getpid", []);
  mark("k3_done");
  result = { id: "killer_k3_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 300),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "killer_k3_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
