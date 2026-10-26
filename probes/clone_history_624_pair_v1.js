// 624 allocator pairing. Census v5 found 624 returns incrementing positive
// IDs on every shape (z/pl/ps/nm), while 632/633/634 are ESRCH-by-ID
// lookups. Question: do any of 632/633/634 resolve a 624-created ID, and
// do they copy data? One 624 allocation, then three lookup shapes per
// sibling, plus an invalid-ID control. No delete (no known delete sibling
// for 624); one object at most, frame restored, PID verified.
var result;
var phase = "preflight";
try {
  var native = window.__fw14NativeInvoke;
  if (!native || typeof native.call !== "function" || !native.frame ||
      !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys624 !== "number")
    throw new Error("chain_or_wrapper_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x400;
  var guardOffset = bufOffset + bufLength;
  var guardLength = 0x100;
  var sizePtrOffset = 0x800;
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
    frame[sizePtrOffset] = 0x00;
    frame[sizePtrOffset + 1] = 0x10;
    for (var z = 2; z < 8; z++) frame[sizePtrOffset + z] = 0;
  }
  function call(name, args) {
    if (!native.wrappers[name])
      return { ret: null, errno: null, extent: 0, guard: true,
        hex: "", absent: true };
    arm();
    var c = native.call(name, args);
    var errno = (c.value === -1) ? native.readErrno() : null;
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
      var dumpLength = Math.min(48, last - first + 1);
      for (var d = 0; d < dumpLength; d++)
        hex += ("0" + frame[bufOffset + first + d].toString(16)).slice(-2);
    }
    return { ret: c.value, errno: errno,
      extent: (first === -1) ? 0 : last - first + 1,
      guard: guardIntact, hex: hex, absent: false };
  }
  function fmt(out) {
    if (out.absent) return "absent";
    return out.ret + "/" + (out.errno === null ? "ok" : out.errno) +
      "/x" + out.extent + "/g" + (out.guard ? 1 : 0) +
      (out.hex ? "/h" + out.hex : "");
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("pair624_preflight");
  phase = "alloc";
  var id1 = native.call("sys624", [0, 0, 0, 0, 0, 0]);
  var err1 = (id1.value === -1) ? native.readErrno() : null;
  var id2 = native.call("sys624", [bufAddress, bufLength, 0, 0, 0, 0]);
  var err2 = (id2.value === -1) ? native.readErrno() : null;
  var lines = [];
  lines.push("id1:" + id1.value + "/" + (err1 === null ? "ok" : err1));
  lines.push("id2:" + id2.value + "/" + (err2 === null ? "ok" : err2));
  var id = (err1 === null && id1.value > 0 && id1.value < 0x1000000)
    ? id1.value
    : ((err2 === null && id2.value > 0 && id2.value < 0x1000000)
      ? id2.value : -1);
  if (id < 0)
    throw new Error("no_624_id");
  mark("pair624_allocated");
  phase = "lookups";
  var targets = ["sys632", "sys633", "sys634"];
  for (var t = 0; t < targets.length; t++) {
    var name = targets[t];
    lines.push(name + "_buf:" + fmt(call(name, [id, bufAddress, bufLength])));
    lines.push(name + "_bare:" + fmt(call(name, [id, 0, 0])));
    lines.push(name + "_sp:" + fmt(call(name, [id, bufAddress, sizeAddress])));
  }
  lines.push("ctl_bad:" + fmt(call("sys632", [0xdead, bufAddress, bufLength])));
  mark("pair624_lookups_done");
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("pair624_done");
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "pair_624_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { id: String(id), lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "pair_624_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
