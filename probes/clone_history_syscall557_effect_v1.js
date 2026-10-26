// Syscall 557 A/B effect probe. Observation: after four 557 allocations
// (v3), the 592 dylib list contained a {0,0} entry between handles 0x3d
// and 0x48 that the pre-allocation capture (v3b) lacked — something 557
// did touched the dylib table. This probe interleaves: 592 list capture →
// one 557(name) allocation → 592 list capture → next 557 call → … four
// iterations, reporting the copy extent and tail bytes after each
// allocation so the per-call delta is directly visible. New handles get a
// 608 lookup. Read-only 592/608; 557 allocations use innocuous
// process-local names; safe mark() helper; wrappers byte-gated by v20.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys557 !== "number" ||
      typeof native.wrappers.dynlib_list !== "number" ||
      typeof native.wrappers.dynlib_info_ex !== "number")
    throw new Error("chain_or_wrappers_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x1000;
  var structOffset = 0x1400, structLength = 0x1a8;
  var nameOffset = 0x1600, nameMax = 0x80;
  var regionEnd = nameOffset + nameMax;         // 0x1680
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var structAddress = address + structOffset;
  var nameAddress = address + nameOffset;
  var original = Array.from(frame.subarray(bufOffset, regionEnd));
  var structOriginal = Array.from(frame.subarray(structOffset,
    structOffset + structLength));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function hexAt(offset, count) {
    var out = "";
    for (var i = 0; i < count; i++)
      out += ("0" + frame[offset + i].toString(16)).slice(-2);
    return out;
  }
  function listSnapshot() {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    var call = native.call("dynlib_list", [bufAddress, bufLength]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var extent = 0;
    for (var c = 0; c < bufLength; c++) {
      if (frame[bufOffset + c] !== ((c * 7 + 3) & 255)) extent = c + 1;
    }
    var tail = hexAt(bufOffset + 0x50, 0x30);
    var handles = [];
    for (var w = 0; w + 4 <= extent; w += 4) {
      var v = (frame[bufOffset + w]) |
              (frame[bufOffset + w + 1] << 8) |
              (frame[bufOffset + w + 2] << 16) |
              (frame[bufOffset + w + 3] << 24);
      handles.push(v >>> 0);
    }
    return { ret: call.value, errno: errno, extent: extent,
      tail: tail, handles: handles };
  }
  function alloc557(text) {
    frame.fill(0, nameOffset, nameOffset + nameMax);
    for (var i = 0; i < text.length; i++)
      frame[nameOffset + i] = text.charCodeAt(i) & 255;
    var call = native.call("sys557", [nameAddress, text.length + 1]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    return { ret: call.value, errno: errno };
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync === "function")
    api.markSync("sys557_preflight");
  phase = "iterations";
  var iters = [];
  var newHandle = 0, newHandleInfo = "";
  for (var iter = 0; iter < 4; iter++) {
    mark("sys557_iter" + iter + "_list_before");
    var listA = listSnapshot();
    mark("sys557_iter" + iter + "_alloc_before");
    var alloc = alloc557("Fw14Iter" + iter);
    mark("sys557_iter" + iter + "_alloc_after");
    var listB = listSnapshot();
    mark("sys557_iter" + iter + "_list_after");
    var delta = "none";
    if (listB.handles.length > listA.handles.length) {
      for (var q = 0; q < listB.handles.length; q++) {
        var known = false;
        for (var p = 0; p < listA.handles.length; p++)
          if (listA.handles[p] === listB.handles[q]) { known = true; break; }
        if (!known) delta += " " + listB.handles[q];
        if (!known && newHandle === 0 && listB.handles[q] !== 0)
          newHandle = listB.handles[q];
      }
      delta = "grew:" + delta;
    } else if (listB.extent !== listA.extent) {
      delta = "extent" + listA.extent + "to" + listB.extent;
    }
    iters.push("it" + iter + ":592ext" + listA.extent +
      "/557ret" + alloc.ret + "/e" + alloc.errno +
      "/ext" + listB.extent + "/h" + listB.handles.length +
      "/delta:" + delta);
  }
  phase = "walk_new";
  mark("sys557_walk_before");
  var newHex = "";
  if (newHandle !== 0) {
    frame.fill(0, structOffset, structOffset + structLength);
    frame[structOffset] = 0xa8; frame[structOffset + 1] = 0x01;
    var info = native.call("dynlib_info_ex",
      [newHandle, 0, structAddress]);
    var werrno = (info.value === -1) ? native.readErrno() : null;
    var name = "";
    for (var n = 0x10; n < 0x30; n++) {
      var ch = frame[structOffset + n];
      if (ch === 0) break;
      if (ch >= 32 && ch < 127) name += String.fromCharCode(ch);
    }
    newHandleInfo = "h" + newHandle + ":ret" + info.value +
      "/e" + werrno + "/name:" + (name || "none") +
      "/head:" + hexAt(structOffset, 0x20);
  }
  mark("sys557_walk_after");
  phase = "restore";
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  for (var s = 0; s < structLength; s++)
    frame[structOffset + s] = structOriginal[s];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("sys557_done");
  result = { id: "syscall557_effect_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { iters: iters.join(" | "),
      new_handle: newHandle, new_handle_info: newHandleInfo,
      tail_sample: iters.length ? "" : "",
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall557_effect_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
