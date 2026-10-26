// Query the browser's live resource-10 limit through the byte-checked
// fixed-194 wrapper. The 16-byte output lives in an owned frame and is restored.
var result, frame = null, original = null, offset = 0x300;
var phase = "preflight";
try {
  var native = window.__fw14NativeInvoke;
  var state = window.__fw14ArrayState;
  if (!native || !native.frame || !native.wrappers ||
      !native.wrappers.getrlimit || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0] !== state.a)
    throw new Error("current_page_native_call_missing");
  frame = native.frame;
  if (frame.length < offset + 16) throw new Error("frame_too_short");
  original = Array.from(frame.subarray(offset, offset + 16));
  frame.fill(0xa5, offset, offset + 16);
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("pid_invalid");
  if (api && typeof api.markSync === "function")
    api.markSync("getrlimit10_before");
  phase = "getrlimit";
  var call = native.call("getrlimit", [10, native.frameAddress + offset]);
  if (api && typeof api.markSync === "function")
    api.markSync("getrlimit10_after");
  var dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  var softLo = dv.getUint32(offset, true);
  var softHi = dv.getUint32(offset + 4, true);
  var hardLo = dv.getUint32(offset + 8, true);
  var hardHi = dv.getUint32(offset + 12, true);
  var after = native.call("getpid", []);
  if (after.high !== 0 || after.value !== before.value)
    throw new Error("pid_changed");
  function wordHex(hi, lo) {
    return "0x" + ("00000000" + hi.toString(16)).slice(-8) +
      ("00000000" + lo.toString(16)).slice(-8);
  }
  function limitText(hi, lo) {
    var raw = wordHex(hi, lo);
    if (hi === 0xffffffff && lo === 0xffffffff)
      return "unlimited (" + raw + ")";
    var mib = hi * 4096 + lo / 1048576;
    if (hi <= 0x1000 && mib === Math.floor(mib))
      return mib + " MiB (" + raw + ")";
    return raw;
  }
  var errno = call.value === 0 ? 0 : native.readErrno();
  if (call.value === 0 && call.high === 0) {
    if (softLo === 0xa5a5a5a5 && softHi === 0xa5a5a5a5 &&
        hardLo === 0xa5a5a5a5 && hardHi === 0xa5a5a5a5)
      throw new Error("output_unchanged");
    if (api && typeof api.log === "function")
      api.log("MEMORY LIMIT (resource 10)\nsoft  " +
        limitText(softHi, softLo) + "\nhard  " +
        limitText(hardHi, hardLo));
    result = { id: "getrlimit10_v1", status: "pass",
      details: { pid: before.value, return_value: call.value,
        soft: wordHex(softHi, softLo), hard: wordHex(hardHi, hardLo),
        errno: errno } };
  } else {
    if (api && typeof api.log === "function")
      api.log("Memory limit query failed (return " + call.value +
        ", errno " + errno + ").");
    result = { id: "getrlimit10_v1", status: "fail",
      details: { pid: before.value, return_value: call.value,
        return_high: call.high, errno: errno } };
  }
} catch (error) {
  result = { id: "getrlimit10_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
} finally {
  if (frame && original)
    for (var i = 0; i < original.length; i++)
      frame[offset + i] = original[i];
  if (window.__fw14ArrayState && window.__fw14ArrayState.array &&
      window.__fw14ArrayState.a)
    window.__fw14ArrayState.array[0] = window.__fw14ArrayState.a;
}
if (result && frame && original) {
  var restored = original.every(function (byte, index) {
    return frame[offset + index] === byte;
  });
  result.details.frame_restored = restored;
  if (!restored) result.status = "fail";
}
return [result];
