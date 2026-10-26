// Syscall 557 characterization, v2. v1 finding: 557 with zero args Ã¢â€ â€™
// -1/EINVAL(22); with a position-encoded buffer pointer in arg1 Ã¢â€ â€™
// -1/ENAMETOOLONG(63) on every shape, no copyout. The kernel treats arg1
// as a STRING (first NUL at byte 219 of the fill exceeded the name limit).
// v2 passes real NUL-terminated names: a garbage name first (ENOENT would
// confirm name-lookup semantics), then a REAL module name from tonight's
// 592/608 map Ã¢â‚¬â€ with arg2 as both 0 and strlen+1. Real-name calls may
// allocate or reference a kernel object; that is the experiment. Markers
// 8/8 localize any death to a single call.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys557 !== "number")
    throw new Error("chain_or_sys557_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var nameOffset = 0x200, nameMax = 0x100;
  var outOffset = 0x400, outLength = 0x100;
  var guardOffset = outOffset + outLength;      // 0x500
  var regionEnd = guardOffset + 0x100;          // 0x600
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var nameAddress = address + nameOffset;
  var outAddress = address + outOffset;
  var original = Array.from(frame.subarray(nameOffset, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function putName(text) {
    frame.fill(0, nameOffset, nameOffset + nameMax);
    for (var i = 0; i < text.length; i++)
      frame[nameOffset + i] = text.charCodeAt(i) & 255;
  }
  function call557(args) {
    var call = native.call("sys557", args);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var changed = false, hex = "";
    for (var i = 0; i < outLength; i++) {
      if (frame[outOffset + i] !== 0) { changed = true; break; }
    }
    if (changed) {
      var dumpLength = 64;
      for (var d = 0; d < dumpLength; d++)
        hex += ("0" + frame[outOffset + d].toString(16)).slice(-2);
    }
    var nameEcho = "";
    for (var n = 0; n < 16; n++) {
      var ch = frame[nameOffset + n];
      nameEcho += (ch >= 32 && ch < 127) ?
        String.fromCharCode(ch) : ".";
    }
    return { ret: call.value, errno: errno, changed: changed,
      hex: hex, name_echo: nameEcho };
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("sys557_preflight");
  var trials = [
    { name: "garbage_len0", text: "Fw14ProbeName", args: [nameAddress, 0] },
    { name: "garbage_len", text: "Fw14ProbeName",
      args: [nameAddress, 14] },
    { name: "module_len0", text: "libSceVideoOut.sprx",
      args: [nameAddress, 0] },
    { name: "module_len", text: "libSceVideoOut.sprx",
      args: [nameAddress, 20] }
  ];
  var summaries = [];
  var outHex = "";
  for (var p = 0; p < trials.length; p++) {
    phase = "trial_" + trials[p].name;
    putName(trials[p].text);
    frame.fill(0, outOffset, outOffset + outLength);
    mark("sys557_" + trials[p].name + "_before");
    var out = call557(trials[p].args);
    mark("sys557_" + trials[p].name + "_after");
    summaries.push(trials[p].name + ":ret" + out.ret +
      "/e" + out.errno + "/chg" + (out.changed ? 1 : 0) +
      "/ne" + out.name_echo);
    if (out.changed && outHex === "") outHex = out.hex;
  }
  for (var r = 0; r < original.length; r++)
    frame[nameOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[nameOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("sys557_done");
  result = { id: "syscall557_probe_v3",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { trials: summaries.join(" | "),
      first_changed_hex: outHex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall557_probe_v3", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
