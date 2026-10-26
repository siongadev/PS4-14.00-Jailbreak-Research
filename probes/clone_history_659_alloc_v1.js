// 659 allocator probe. Zero args returns ENOMEM, suggesting a size-driven
// allocator (not a killer like its neighbor 661). Test a small size sweep
// and one alignment shape; record the full 64-bit return and errno. No
// copyout expected, no delete (unknown), no pointer dereference. PID
// verified.
var result;
var phase = "preflight";
try {
  var native = window.__fw14NativeInvoke;
  if (!native || typeof native.call !== "function" ||
      typeof native.wrappers.sys659 !== "number")
    throw new Error("chain_or_wrapper_missing");
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function u64(c) {
    return c.high * 0x100000000 + (c.value >>> 0);
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("alloc659_preflight");
  var lines = [];
  var shapes = [
    { label: "z", args: [0, 0, 0, 0, 0, 0] },
    { label: "s1k", args: [0x1000, 0, 0, 0, 0, 0] },
    { label: "s10k", args: [0x10000, 0, 0, 0, 0, 0] },
    { label: "s100k", args: [0x100000, 0, 0, 0, 0, 0] },
    { label: "s10k_a1k", args: [0x10000, 0x1000, 0, 0, 0, 0] }
  ];
  for (var i = 0; i < shapes.length; i++) {
    phase = shapes[i].label;
    var c = native.call("sys659", shapes[i].args);
    var errno = (c.value === -1) ? native.readErrno() : null;
    lines.push(shapes[i].label + ":" + c.value + "/h" + c.high +
      "/" + (errno === null ? "ok" : errno) +
      (errno === null ? "/u" + u64(c) : ""));
  }
  mark("alloc659_done");
  var after = native.call("getpid", []);
  result = { id: "alloc_659_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { lines: lines.join(" | ").slice(0, 500),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "alloc_659_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
