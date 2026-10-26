// Census batch sweep part 1: syscalls 545-554 (thread-control
// territory ahead of the namedobj bracket) and 561-572 (the start of
// the VM/dmem-adjacent block between namedobj and dynlib). Four shapes
// per syscall: z = zero args (proven-safe census opener),
// pl = buf+0x1000 len, ps = buf+sizePtr(0x1000), nm = namePtr("Fw14Probe
// Name")+13. All buffers live in this process's own frame with
// position-encoding + 0xa5 guard + size word, full restore,
// PID-verified. Safe mark() helper; markers best-effort; ONE call per
// shape.
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
  mark("census3_sweep_preflight");
  var numbers = ["sys545", "sys546", "sys547", "sys548", "sys549",
    "sys550", "sys551", "sys552", "sys553", "sys554",
    "sys561", "sys562", "sys563", "sys564", "sys565", "sys566",
    "sys567", "sys568", "sys569", "sys570", "sys571", "sys572"];
  var linesA = [], linesB = [], linesC = [];
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
    var lines = [linesA, linesB, linesC];
    var placed = false;
    for (var lg = 0; lg < 3; lg++) {
      if (lines[lg].join(" | ").length + line.length < 440) {
        lines[lg].push(line);
        placed = true;
        break;
      }
    }
    if (!placed) linesC.push(line.slice(0, 150));
    if (n === 9) mark("census3_sweep_mid");
  }
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("census3_sweep_done");
  result = { id: "census_sweep_v3",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      lines_c: linesC.join(" | "),
      absent: absent.join(","),
      best_pattern: bestName, best_extent: bestExtent,
      best_hex: bestHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "census_sweep_v3", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
