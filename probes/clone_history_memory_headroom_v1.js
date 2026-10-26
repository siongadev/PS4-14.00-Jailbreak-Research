// Compare the current browser's mapped virtual bytes with its resource-10
// limit. Both native outputs use owned scratch and are restored afterward.
var result, phase = "preflight", frame = null, saved = null;
try {
  var native = window.__fw14NativeInvoke;
  var state = window.__fw14ArrayState;
  if (!native || !native.frame || !native.wrappers ||
      !native.wrappers.getrlimit || !native.wrappers.sysctl ||
      !Number.isSafeInteger(native.frameAddress) || !state ||
      state.array[0] !== state.a)
    throw new Error("current_page_native_call_missing");
  frame = native.frame;
  if (frame.length < 0x9020) throw new Error("frame_too_short");
  saved = Array.from(frame.subarray(0x200, 0x9020));
  var address = native.frameAddress;
  var dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("pid_invalid");

  phase = "limit";
  frame.fill(0xa5, 0x300, 0x310);
  var limitCall = native.call("getrlimit", [10, address + 0x300]);
  if (limitCall.value !== 0 || limitCall.high !== 0)
    throw new Error("getrlimit_failed_" +
      (limitCall.value === -1 ? native.readErrno() : limitCall.value));
  var softLo = dv.getUint32(0x300, true);
  var softHi = dv.getUint32(0x304, true);
  var hardLo = dv.getUint32(0x308, true);
  var hardHi = dv.getUint32(0x30c, true);
  if (softLo === 0xa5a5a5a5 && softHi === 0xa5a5a5a5)
    throw new Error("limit_output_unchanged");
  var soft = softLo + softHi * 4294967296;
  if (!Number.isSafeInteger(soft) || soft < 1)
    throw new Error("soft_limit_invalid");

  phase = "vmmap";
  frame.fill(0xa5, 0x200, 0x9020);
  dv.setUint32(0x200, 32768, true);
  dv.setUint32(0x204, 0, true);
  dv.setUint32(0x400, 1, true);
  dv.setUint32(0x404, 14, true);
  dv.setUint32(0x408, 32, true);
  dv.setUint32(0x40c, before.value, true);
  if (api && typeof api.markSync === "function")
    api.markSync("memory_headroom_vmmap_before");
  var mapCall = native.call("sysctl", [address + 0x400, 4,
    address + 0x1000, address + 0x200, 0, 0]);
  var size = dv.getUint32(0x200, true);
  if (mapCall.value !== 0 || mapCall.high !== 0 ||
      size < 136 || size > 32768)
    throw new Error("vmmap_failed_" +
      (mapCall.value === -1 ? native.readErrno() : mapCall.value));
  var cursor = 0, count = 0, mapped = 0, unreadable = 0;
  while (cursor + 136 <= size && count < 500) {
    var at = 0x1000 + cursor;
    var recordSize = dv.getUint32(at, true);
    if (recordSize < 136 || recordSize > 1160 ||
        cursor + recordSize > size)
      throw new Error("vmmap_record_invalid");
    var start = dv.getUint32(at + 8, true) +
      dv.getUint32(at + 12, true) * 4294967296;
    var end = dv.getUint32(at + 16, true) +
      dv.getUint32(at + 20, true) * 4294967296;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        end <= start)
      throw new Error("vmmap_address_invalid");
    var span = end - start;
    mapped += span;
    if (dv.getUint32(at + 56, true) === 0) unreadable += span;
    cursor += recordSize;
    count++;
  }
  if (cursor !== size || count < 1 ||
      !Number.isSafeInteger(mapped) || mapped < 1)
    throw new Error("vmmap_not_fully_decoded");
  var after = native.call("getpid", []);
  if (after.high !== 0 || after.value !== before.value)
    throw new Error("pid_changed");
  var mappedMiB = +(mapped / 1048576).toFixed(2);
  var softMiB = +(soft / 1048576).toFixed(2);
  var headroomMiB = +((soft - mapped) / 1048576).toFixed(2);
  if (api && typeof api.log === "function")
    api.log("MEMORY SNAPSHOT\nlimit  " + softMiB + " MiB\n" +
      "mapped " + mappedMiB + " MiB (" + count + " regions)\n" +
      "difference " + headroomMiB + " MiB");
  result = {id: "memory_headroom_v1", status: "pass",
    details: {pid: before.value, soft_bytes: soft,
      hard_hex: "0x" + ("00000000" + hardHi.toString(16)).slice(-8) +
        ("00000000" + hardLo.toString(16)).slice(-8),
      mapped_bytes: mapped, unreadable_bytes: unreadable,
      map_count: count, mapped_mib: mappedMiB,
      difference_mib: headroomMiB}};
} catch (error) {
  result = {id: "memory_headroom_v1", status: "error",
    details: {phase: phase, error: String(error).slice(0, 180)}};
} finally {
  if (frame && saved)
    for (var i = 0; i < saved.length; i++) frame[0x200 + i] = saved[i];
  if (window.__fw14ArrayState && window.__fw14ArrayState.array &&
      window.__fw14ArrayState.a)
    window.__fw14ArrayState.array[0] = window.__fw14ArrayState.a;
}
if (result && frame && saved) {
  var restored = saved.every(function (value, index) {
    return frame[0x200 + index] === value;
  });
  result.details.frame_restored = restored;
  if (!restored) result.status = "fail";
}
return [result];
