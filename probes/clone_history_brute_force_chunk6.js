// Chunked brute-force: calls a range of syscalls with handles from
// 557/624, integer sweep, and string pointer. Designed to stay under
// 30s/memory limits by covering ~18 syscalls per command.
// Pass the chunk number in the probe filename (bf_chunk_0, bf_chunk_1, etc).
// Chunk ranges:
//   0: 532-549   1: 550-567   2: 568-585
//   3: 586-603   4: 604-621   5: 622-639   6: 640-668
var CHUNK = 6; // ← CHANGE PER FILE
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
  var strOff = 0x1400;
  if (strOff + 256 > frame.length)
    throw new Error("frame_region_too_small");
  var strAddress = address + strOff;
  function mark(n) {
    try { if (api && typeof api.markSync === "function")
      api.markSync(n); } catch (e) {}
  }
  function putStr(s) {
    for (var i = 0; i < s.length; i++)
      frame[strOff + i] = s.charCodeAt(i);
    frame[strOff + s.length] = 0;
  }
  var callCount = 0;
  function C(name, args) {
    if (!native.wrappers[name]) return null;
    callCount++;
    var c = native.call(name, args || [0,0,0,0,0,0]);
    var e = (c.value === -1) ? native.readErrno() : null;
    return c.value + (e === null ? "" : "e" + e);
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("bf" + CHUNK + "_preflight");

  // Get handles
  putStr("BF" + CHUNK + "A");
  var hA = native.call("sys557", [strAddress, 8]);
  var hB = native.call("sys624", [0,0,0,0,0,0]);
  var handles = [hA.value, hB.value];
  putStr("/system/common/lib/");

  // All available syscalls sorted
  var allNames = Object.keys(native.wrappers).filter(function(k) {
    return k.indexOf("sys") === 0;
  }).sort();
  // Filter to this chunk's range
  var ranges = [[532,549],[550,567],[568,585],[586,603],[604,621],[622,639],[640,668]];
  var lo = ranges[Math.min(CHUNK, ranges.length - 1)][0];
  var hi = ranges[Math.min(CHUNK, ranges.length - 1)][1];
  var chunkNames = allNames.filter(function(k) {
    var n = parseInt(k.slice(3));
    return n >= lo && n <= hi;
  });

  var lines = [];
  var intVals = [1, 4, 16, 0x100, 0xFFFFFFFF];

  // Sub-phase A: handles → each syscall
  for (var ni = 0; ni < chunkNames.length; ni++) {
    var nm = chunkNames[ni];
    var rA = C(nm, [handles[0], 0, 0, 0, 0, 0]);
    var rB = C(nm, [handles[1], 0, 0, 0, 0, 0]);
    lines.push(nm.slice(3) + ":hA=" + rA + ",hB=" + rB);
  }
  mark("bf" + CHUNK + "_handles_done");

  // Sub-phase B: integer sweep → each syscall (first arg)
  for (var ni2 = 0; ni2 < chunkNames.length; ni2++) {
    var nm2 = chunkNames[ni2];
    var ints = [];
    for (var iv = 0; iv < intVals.length; iv++) {
      var r = C(nm2, [intVals[iv], 0, 0, 0, 0, 0]);
      ints.push(intVals[iv].toString(16) + "=" + r);
    }
    lines.push(nm2.slice(3) + ":ints(" + ints.join(",") + ")");
  }
  mark("bf" + CHUNK + "_ints_done");

  // Sub-phase C: string pointer → each syscall
  for (var ni3 = 0; ni3 < chunkNames.length; ni3++) {
    var nm3 = chunkNames[ni3];
    putStr("/system/common/lib/");
    var r3 = C(nm3, [strAddress, 19, 0, 0, 0, 0]);
    lines.push(nm3.slice(3) + ":str=" + r3);
  }
  mark("bf" + CHUNK + "_str_done");

  var after = native.call("getpid", []);
  mark("bf" + CHUNK + "_done");

  var outA = [], outB = [];
  for (var oi = 0; oi < lines.length; oi++) {
    if (outA.join("|").length + lines[oi].length < 440)
      outA.push(lines[oi]);
    else if (outB.join("|").length + lines[oi].length < 440)
      outB.push(lines[oi]);
  }
  result = { id: "brute_force_chunk" + CHUNK,
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { chunk: CHUNK, calls: callCount,
      range: lo + "-" + hi,
      lines_a: outA.join(" | "), lines_b: outB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "brute_force_chunk" + CHUNK, status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
