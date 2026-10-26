// Named-object bracket + post-dynlib sweep, second census batch:
// syscalls 555/556/558/559/560 (siblings of the confirmed 557 name-keyed
// allocator — the classic PS4 namedobj kernel-exploit family shape),
// 597 (dynlib gap), and 609-621 (between dynlib 608 and ipmimgr 622).
// Four shapes per syscall: z = zero args (proven-safe census opener),
// pl = buf+0x1000 len, ps = buf+sizePtr(0x1000), nm = namePtr("Fw14Probe
// Name")+13. The five bracket syscalls also get ns = name+len+0x1000
// size. All buffers live in this process's own frame with position-
// encoding + 0xa5 guard + size word, full restore, PID-verified.
// Safe mark() helper; markers best-effort; ONE call per shape.
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
  var sizePtrOffset = 0x1400;
  var nameOffset = 0x1500;
  var regionEnd = nameOffset + 16;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var sizeAddress = address + sizePtrOffset;
  var nameAddress = address + nameOffset;
  var original = Array.from(frame.subarray(bufOffset, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function putSize() {
    frame[sizePtrOffset] = 0x00; frame[sizePtrOffset + 1] = 0x10;
    frame[sizePtrOffset + 2] = 0; frame[sizePtrOffset + 3] = 0;
    frame[sizePtrOffset + 4] = 0; frame[sizePtrOffset + 5] = 0;
    frame[sizePtrOffset + 6] = 0; frame[sizePtrOffset + 7] = 0;
  }
  function putName() {
    var nm = "Fw14ProbeName";
    for (var i = 0; i < nm.length; i++)
      frame[nameOffset + i] = nm.charCodeAt(i);
    frame[nameOffset + nm.length] = 0;
    for (var z = nm.length + 1; z < 16; z++) frame[nameOffset + z] = 0;
  }
  function arm() {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    frame.fill(0xa5, guardOffset, guardOffset + guardLength);
    putSize();
    putName();
  }
  function callWrapper(name, args) {
    if (!native.wrappers[name])
      return { ret: null, errno: null, extent: 0, guard: true,
        hex: "", skipped: true };
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
      var dumpLength = Math.min(48, last - first + 1);
      for (var d = 0; d < dumpLength; d++)
        hex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
    }
    return { ret: call.value, errno: errno,
      extent: (first === -1) ? 0 : last - first + 1,
      guard: guardIntact, hex: hex, skipped: false };
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("bracket_sweep_preflight");
  var bracket = { sys555: 1, sys556: 1, sys558: 1, sys559: 1, sys560: 1 };
  var numbers = ["sys555", "sys556", "sys558", "sys559", "sys560",
    "sys597", "sys609", "sys610", "sys611", "sys612", "sys613",
    "sys614", "sys615", "sys616", "sys617", "sys618", "sys619",
    "sys620", "sys621"];
  var linesA = [], linesB = [];
  var absent = [];
  var bestHex = "", bestExtent = 0, bestName = "";
  for (var n = 0; n < numbers.length; n++) {
    var name = numbers[n];
    phase = name;
    if (!native.wrappers[name]) {
      absent.push(name.replace("sys", ""));
      continue;
    }
    var line = name.replace("sys", "") + ":";
    var shapes = [
      { label: "z", args: [0, 0, 0, 0, 0, 0] },
      { label: "pl", args: [bufAddress, bufLength] },
      { label: "ps", args: [bufAddress, sizeAddress] },
      { label: "nm", args: [nameAddress, 13] }
    ];
    if (bracket[name])
      shapes.push({ label: "ns", args: [nameAddress, 13, 0x1000] });
    for (var s = 0; s < shapes.length; s++) {
      arm();
      var out = callWrapper(name, shapes[s].args);
      line += shapes[s].label + "(" + out.ret + "/" +
        (out.errno === null ? "ok" : out.errno) + "/" +
        out.extent + "/g" + (out.guard ? 1 : 0) + ")";
      if (out.extent > bestExtent) {
        bestExtent = out.extent; bestHex = out.hex; bestName =
          name.replace("sys", "") + "." + shapes[s].label;
      }
    }
    if (n < 10) linesA.push(line);
    else linesB.push(line);
    if (n === 9) mark("bracket_sweep_mid");
  }
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("bracket_sweep_done");
  result = { id: "namedobj_sweep_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      absent: absent.join(","),
      best_pattern: bestName, best_extent: bestExtent,
      best_hex: bestHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "namedobj_sweep_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
