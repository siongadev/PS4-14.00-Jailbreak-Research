// Syscall 592→608 module walk, v1. Step 1: 592(dynlib_list) copies the
// loaded-module ID table (108 bytes of small u32 handles observed in
// syscall592_dump_v2, capture c28d235b). Step 2: walk each captured ID
// through 608 (dynlib_info_ex) — an ABI already proven on this console by
// the moduleBase() probes: (handle, 0, structPtr) with a 0x1a8-byte struct,
// module base at struct+0x110. Capture base per ID, plus the first 0x40
// struct bytes for the first three IDs to locate any name field. All calls
// are read-only in-process queries; both wrappers are byte-gated by
// installer v19. Marker budget: 6 of the collector's 8 cap.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native || typeof native.call !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      typeof native.wrappers.dynlib_list !== "number" ||
      typeof native.wrappers.dynlib_info_ex !== "number")
    throw new Error("chain_or_wrappers_missing");
  var frame = native.frame;
  var address = native.frameAddress;
  var bufOffset = 0x200, bufLength = 0x1000;
  var structOffset = 0x1400, structLength = 0x1a8;
  var regionEnd = structOffset + structLength;  // 0x15a8 < 0x2000
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var structAddress = address + structOffset;
  var original = Array.from(frame.subarray(bufOffset, regionEnd));
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_preflight");
  phase = "list_call";
  for (var i = 0; i < bufLength; i++)
    frame[bufOffset + i] = (i * 7 + 3) & 255;
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_list_before");
  var call = native.call("dynlib_list", [bufAddress, bufLength]);
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_list_after");
  var errno = (call.value === -1) ? native.readErrno() : null;
  var ids = [];
  for (var w = 0; w + 4 <= bufLength; w += 4) {
    var v = (frame[bufOffset + w]) |
            (frame[bufOffset + w + 1] << 8) |
            (frame[bufOffset + w + 2] << 16) |
            (frame[bufOffset + w + 3] << 24);
    if (v === 0) continue;
    var dup = false;
    for (var q = 0; q < ids.length; q++)
      if (ids[q] === v) { dup = true; break; }
    if (!dup) ids.push(v >>> 0);
    if (ids.length >= 32) break;
  }
  var idsHex = "";
  for (var e = 0; e < ids.length; e++)
    idsHex += ("00000000" + ids[e].toString(16)).slice(-8);
  phase = "walk";
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_walk_before");
  var walkOk = 0, bases = "", nameSample = "";
  var structOriginal = Array.from(frame.subarray(structOffset,
    structOffset + structLength));
  for (var m = 0; m < ids.length; m++) {
    frame.fill(0, structOffset, structOffset + structLength);
    var info = native.call("dynlib_info_ex",
      [ids[m], 0, structAddress]);
    if (info.value !== 0) {
      bases += ids[m].toString(16) + ":err" + info.value + " ";
      continue;
    }
    walkOk += 1;
    var baseLo = (frame[structOffset + 0x110]) |
                 (frame[structOffset + 0x111] << 8) |
                 (frame[structOffset + 0x112] << 16) |
                 (frame[structOffset + 0x113] << 24);
    var baseHi = (frame[structOffset + 0x114]) |
                 (frame[structOffset + 0x115] << 8) |
                 (frame[structOffset + 0x116] << 16) |
                 (frame[structOffset + 0x117] << 24);
    bases += ids[m].toString(16) + ":" +
      ("00000000" + baseHi.toString(16)).slice(-8) +
      ("00000000" + baseLo.toString(16)).slice(-8) + " ";
    if (m < 3) {
      for (var b = 0; b < 0x40; b++)
        nameSample += ("0" + frame[structOffset + b].toString(16)).slice(-2);
      nameSample += " ";
    }
    for (var r0 = 0; r0 < structLength; r0++)
      frame[structOffset + r0] = structOriginal[r0];
  }
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_walk_after");
  phase = "restore";
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  if (api && typeof api.markSync === "function")
    api.markSync("sys592_done");
  result = { id: "syscall592_walk_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored && ids.length > 0) ? "pass" : "fail",
    details: { ret592: call.value, errno592: errno,
      id_count: ids.length, ids_hex: idsHex,
      walk_ok: walkOk, bases: bases.trim(),
      struct_head_hex: nameSample.trim(),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "syscall592_walk_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
