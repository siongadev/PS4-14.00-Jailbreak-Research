// MASSIVE argument brute-force across ALL available wrappers.
// Phase 1: handles from 557 and 624 fed into every ESRCH/EPERM syscall.
// Phase 2: every syscall hammered with integer sweeps (1,2,4,8,16,32,
//          64,128,0xFF,0x100,0x1000,0x10000,0xFFFFFFFF,0x80000000).
// Phase 3: string pointers to all syscalls.
// Phase 4: always-succeed class fed non-zero args (do they DO anything?).
// Phase 5: combined sequences (557 create → feed ID to every ESRCH
//          syscall; 624 alloc → feed to every syscall).
// All shapes use call64 where kernel ptrs might be relevant; otherwise
// native.call. Markers every 10 calls. Time-bounded by 30s harness.
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
  var bufOff = 0x200, bufLen = 0x1000;
  var strOff = 0x1400;
  var regionEnd = strOff + 256;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOff;
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
  var lines = [];
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("bf_preflight");

  // ── Get handles from 557 and 624 ──
  phase = "handles";
  putStr("BruteForceA");
  var h557a = native.call("sys557", [strAddress, 11]);
  putStr("BruteForceB");
  var h557b = native.call("sys557", [strAddress, 11]);
  var h624a = native.call("sys624", [0,0,0,0,0,0]);
  var h624b = native.call("sys624", [0,0,0,0,0,0]);
  var handles = [h557a.value, h557b.value, h624a.value, h624b.value];
  lines.push("handles:" + handles.join(","));

  // ── All available syscalls ──
  var allNames = Object.keys(native.wrappers).filter(function(k) {
    return k.indexOf("sys") === 0;
  }).sort();

  // ── Phase 1: feed handles into every syscall ──
  phase = "p1_handles";
  for (var ni = 0; ni < allNames.length; ni++) {
    var nm = allNames[ni];
    var results = [];
    for (var hi = 0; hi < handles.length; hi++) {
      var r = C(nm, [handles[hi], 0, 0, 0, 0, 0]);
      if (r !== null) results.push(r);
      else results.push("absent");
    }
    lines.push("p1_" + nm.slice(3) + ":" + results.join(","));
    if (lines.length % 10 === 0) mark("bf_p1_" + ni);
  }
  mark("bf_p1_done");

  // ── Phase 2: integer sweeps across ALL syscalls ──
  phase = "p2_ints";
  var intVals = [1, 2, 4, 8, 16, 0xFF, 0x100, 0x1000, 0xFFFFFFFF];
  for (var ni2 = 0; ni2 < allNames.length; ni2++) {
    var nm2 = allNames[ni2];
    var intResults = [];
    for (var iv = 0; iv < intVals.length; iv++) {
      var r2 = C(nm2, [intVals[iv], 0, 0, 0, 0, 0]);
      if (r2 !== null) intResults.push(intVals[iv].toString(16) +
        "=" + r2);
    }
    if (intResults.length > 0)
      lines.push("p2_" + nm2.slice(3) + ":" + intResults.join(","));
    if (lines.length % 10 === 0) mark("bf_p2_" + ni2);
  }
  mark("bf_p2_done");

  // ── Phase 3: string pointers to all syscalls ──
  phase = "p3_strings";
  putStr("/system/common/lib/");
  var strResults = [];
  for (var ni3 = 0; ni3 < allNames.length; ni3++) {
    var nm3 = allNames[ni3];
    putStr("/system/common/lib/");
    var r3 = C(nm3, [strAddress, 19, 0, 0, 0, 0]);
    if (r3 !== null) strResults.push(nm3.slice(3) + "=" + r3);
  }
  lines.push("p3_str:" + strResults.join(","));
  mark("bf_p3_done");

  // ── Phase 4: always-succeed class with varied args ──
  phase = "p4_always0";
  var always0 = ["sys548","sys560","sys563","sys564","sys565",
    "sys566","sys596","sys599","sys606","sys617","sys620",
    "sys639","sys640","sys643"];
  for (var ai = 0; ai < always0.length; ai++) {
    var nm4 = always0[ai];
    if (!native.wrappers[nm4]) continue;
    var r4a = C(nm4, [1, 0, 0, 0, 0, 0]);
    var r4b = C(nm4, [0, 1, 0, 0, 0, 0]);
    var r4c = C(nm4, [0, 0, bufAddress, 0x1000, 0, 0]);
    var r4d = C(nm4, [handles[0], handles[1], 0, 0, 0, 0]);
    lines.push("p4_" + nm4.slice(3) + ":1=" + r4a +
      ",b1=" + r4b + ",buf=" + r4c + ",h=" + r4d);
  }
  mark("bf_p4_done");

  // ── Phase 5: sequences ──
  phase = "p5_seq";
  // Create namedobj, feed to everything
  putStr("SeqObj");
  var seqH = native.call("sys557", [strAddress, 6]);
  var seqResults = [];
  for (var ni5 = 0; ni5 < allNames.length; ni5++) {
    var nm5 = allNames[ni5];
    var r5 = C(nm5, [seqH.value, bufAddress, 0x100, 0, 0, 0]);
    if (r5 !== null && r5 !== "0" && r5.indexOf("e3") !== 0)
      seqResults.push(nm5.slice(3) + "=" + r5);
  }
  lines.push("p5_seq557:" + (seqResults.join(",") || "all_ESRCH_or_0"));
  mark("bf_p5_done");

  // Cleanup
  native.call("sys558", [h557a.value, 0, 0, 0, 0, 0]);
  native.call("sys558", [h557b.value, 0, 0, 0, 0, 0]);

  var after = native.call("getpid", []);
  mark("bf_done");

  // Compress output
  var outA = [], outB = [], outC = [];
  for (var oi = 0; oi < lines.length; oi++) {
    if (outA.join("|").length + lines[oi].length < 440)
      outA.push(lines[oi]);
    else if (outB.join("|").length + lines[oi].length < 440)
      outB.push(lines[oi]);
    else if (outC.join("|").length + lines[oi].length < 440)
      outC.push(lines[oi]);
    else break;
  }
  result = { id: "brute_force_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { total_calls: callCount,
      lines_a: outA.join(" | "),
      lines_b: outB.join(" | "),
      lines_c: outC.join(" | "),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "brute_force_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180),
      calls_so_far: callCount } };
}
return [result];
