// 14.00 differential for the argument-sensitive number-619 wrapper.
// Checks return/errno, a process-owned output buffer, and its guard.
var result;
var phase = "preflight";
try {
  var native = window.__fw14NativeInvoke;
  if (!native || typeof native.call !== "function" ||
      typeof native.wrappers.sys619 !== "number" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress))
    throw new Error("native_caller_missing");
  var frame = native.frame;
  var off = 0x200, len = 0x100, guard = off + len;
  if (guard + 0x40 >= frame.length) throw new Error("frame_small");
  var original = Array.from(frame.subarray(off, guard + 0x40));
  function mark(s) {
    try { if (api && typeof api.markSync === "function") api.markSync(s); }
    catch (_) {}
  }
  function arm() {
    for (var i = 0; i < len; i++) frame[off + i] = (i * 7 + 3) & 255;
    frame.fill(0xa5, guard, guard + 0x40);
  }
  function observe() {
    var first = -1, count = 0, h = "";
    for (var i = 0; i < len; i++) {
      if (frame[off + i] !== ((i * 7 + 3) & 255)) {
        if (first < 0) first = i;
        count++;
      }
    }
    if (first >= 0) for (var j = 0; j < 12; j++)
      h += ("0" + frame[off + first + j].toString(16)).slice(-2);
    var intact = true;
    for (var k = guard; k < guard + 0x40; k++)
      if (frame[k] !== 0xa5) intact = false;
    return { first:first, count:count, hex:h, guard:intact };
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("pid_invalid");
  mark("b619_start");
  var vals = [0, 2, 3, 4, 16, 0x7fffffff, 0x80000000, 0xffffffff];
  var rows = [];
  for (var n = 0; n < vals.length; n++) {
    phase = "arg_" + vals[n].toString(16);
    if (n === 2 || n === 4 || n === 6) mark("b619_" + n);
    for (var p = 0; p < 2; p++) {
      arm();
      var c = native.call("sys619",
        [vals[n], p ? native.frameAddress + off : 0, 0x100, 0, 0, 0]);
      var e = c.value === -1 ? native.readErrno() : null;
      var b = observe();
      rows.push(vals[n].toString(16) + (p ? "p" : "z") + ":" +
        c.value + "/" + c.high.toString(16) + "/" +
        (e === null ? "ok" : e) + "/" + b.first + "/" + b.count +
        "/" + (b.guard ? 1 : 0) + (b.hex ? "/" + b.hex : ""));
    }
  }
  var after = native.call("getpid", []);
  mark("b619_done");
  result = { id:"argmatrix_619_v1",
    status: after.value === before.value && after.high === 0 ? "pass" : "fail",
    details: { pid:before.value, rows_a:rows.slice(0,4).join("|"),
      rows_b:rows.slice(4,8).join("|"),
      rows_c:rows.slice(8,12).join("|"),
      rows_d:rows.slice(12).join("|") } };
  for (var x = 0; x < original.length; x++) frame[off+x] = original[x];
} catch (error) {
  result = { id:"argmatrix_619_v1", status:"error",
    details:{phase:phase,error:String(error).slice(0,160)} };
}
return [result];


