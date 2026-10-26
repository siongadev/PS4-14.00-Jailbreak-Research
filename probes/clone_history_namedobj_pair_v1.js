// Named-namespace pairing: allocate via the confirmed 557 name-keyed
// allocator, then feed the returned live IDs into the ESRCH-class
// siblings the sweep found (555/556/558/616 in the same number range,
// 595 in the dynlib block, 607 name lookup). Question: which of them
// accept 557 IDs (ESRCH -> 0), and does 607 resolve 557 names (ENOENT
// -> 0)? Order: lookups first, the once-crashing 595 LAST before the
// delete candidates, 556/558 on idB only, then a post-delete re-lookup
// and an allocator-continuity 557. All output buffers in this process's
// frame with position encoding + guard; full restore; PID verified.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress))
    throw new Error("chain_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x1000;
  var guardOffset = bufOffset + bufLength;
  var guardLength = 0x100;
  var nameOffset = 0x1400;
  var regionEnd = nameOffset + 32;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var nameAddress = address + nameOffset;
  var original = Array.from(frame.subarray(bufOffset, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function putName(text) {
    for (var i = 0; i < text.length; i++)
      frame[nameOffset + i] = text.charCodeAt(i);
    frame[nameOffset + text.length] = 0;
    for (var z = text.length + 1; z < 24; z++) frame[nameOffset + z] = 0;
  }
  function arm() {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    frame.fill(0xa5, guardOffset, guardOffset + guardLength);
    putName("PairProbe");
  }
  function probe(name, args, hexLen) {
    arm();
    var call = native.call(name, args);
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
      var dumpLength = Math.min(hexLen || 32, last - first + 1);
      for (var d = 0; d < dumpLength; d++)
        hex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
    }
    return { ret: call.value, errno: errno,
      extent: (first === -1) ? 0 : last - first + 1,
      guard: guardIntact, hex: hex };
  }
  function fmt(out) {
    return out.ret + "/" + (out.errno === null ? "ok" : out.errno) +
      "/" + out.extent + "/g" + (out.guard ? 1 : 0);
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("pair_preflight");
  var lines = [];
  function rec(label, out, hex) {
    var line = label + ":" + fmt(out);
    if (hex && out.hex) line += "h" + out.hex;
    lines.push(line);
  }
  // 1. allocate two live IDs
  putName("PairProbeA");
  var allocA = native.call("sys557", [nameAddress, 10]);
  var errnoA = (allocA.value === -1) ? native.readErrno() : null;
  putName("PairProbeB");
  var allocB = native.call("sys557", [nameAddress, 10]);
  var errnoB = (allocB.value === -1) ? native.readErrno() : null;
  var idA = allocA.value, idB = allocB.value;
  lines.push("allocA:" + idA + "/" + (errnoA === null ? "ok" : errnoA));
  lines.push("allocB:" + idB + "/" + (errnoB === null ? "ok" : errnoB));
  if (idA <= 0 || idA > 1000000 || errnoA !== null)
    throw new Error("alloc_a_failed");
  if (idB <= 0 || idB > 1000000 || errnoB !== null)
    throw new Error("alloc_b_failed");
  mark("pair_allocated");
  // 2. lookups with live IDs
  rec("s555_idA_buf", probe("sys555", [idA, bufAddress, bufLength], 48));
  rec("s555_idA_bare", probe("sys555", [idA, 0, 0], 0));
  rec("s555_idB_buf", probe("sys555", [idB, bufAddress, bufLength], 48));
  rec("s616_idA_buf", probe("sys616", [idA, bufAddress, bufLength], 48));
  rec("s616_idA_bare", probe("sys616", [idA, 0, 0], 0));
  mark("pair_lookups_done");
  // 3. name-namespace test via 607
  putName("PairProbeA");
  rec("s607_nameA", probe("sys607", [nameAddress, 10], 48));
  // 4. the once-crashing 595 with a live ID, proven 0x1000 geometry
  rec("s595_idA_buf", probe("sys595", [idA, bufAddress, bufLength], 48));
  mark("pair_595_done");
  // 5. delete candidates on idB only
  rec("s556_idB_bare", probe("sys556", [idB, 0, 0], 0));
  rec("s558_idB_bare", probe("sys558", [idB, 0, 0], 0));
  // 6. post-delete re-lookup of idB via 555
  rec("s555_idB_after", probe("sys555", [idB, bufAddress, bufLength], 48));
  // 7. allocator continuity
  putName("Post");
  var allocC = native.call("sys557", [nameAddress, 4]);
  var errnoC = (allocC.value === -1) ? native.readErrno() : null;
  lines.push("allocC:" + allocC.value + "/" +
    (errnoC === null ? "ok" : errnoC));
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("pair_done");
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "namedobj_pair_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "namedobj_pair_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
