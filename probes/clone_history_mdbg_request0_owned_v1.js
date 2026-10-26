// Compare selector 0's null-pointer EFAULT with a zeroed owned input.
var result, phase = "preflight";
var native = window.__fw14NativeInvoke;
var frame, original, off = 0x800, len = 0x100;
try {
  if (!native || typeof native.call !== "function" || !native.frame ||
      !Number.isSafeInteger(native.frameAddress) ||
      !native.wrappers.sys601 || !native.wrappers.sys585 ||
      !native.wrappers.sys606 || !native.wrappers.sys600)
    throw new Error("caller_missing");
  frame = native.frame;
  if (off + len + 0x40 >= frame.length) throw new Error("frame_small");
  original = Array.from(frame.subarray(off, off + len + 0x40));
  function indicator(name) {
    var c = native.call(name, [0,0,0,0,0,0]);
    return c.value + (c.value === -1 ? "/" + native.readErrno() : "");
  }
  function indicators() {
    return [indicator("sys585"),indicator("sys606"),
            indicator("sys600")].join(",");
  }
  var pid = native.call("getpid", []);
  if (pid.high !== 0 || pid.value < 1 || pid.value > 100000)
    throw new Error("pid_invalid");
  var before = indicators();
  frame.fill(0,off,off+len);
  frame.fill(0xa5,off+len,off+len+0x40);
  phase = "selector_0";
  if (api && typeof api.markSync === "function") api.markSync("mdbg0_owned_before");
  var c = native.call("sys601", [0,native.frameAddress+off,0,0,0,0]);
  var errno = c.value === -1 ? native.readErrno() : null;
  if (api && typeof api.markSync === "function") api.markSync("mdbg0_owned_after");
  var first = -1, changed = 0, hex = "";
  for (var j = 0; j < len; j++)
    if (frame[off+j] !== 0) {
      if (first < 0) first = j;
      changed++;
    }
  if (first >= 0) for (var k = 0; k < 16; k++)
    hex += ("0"+frame[off+first+k].toString(16)).slice(-2);
  var guard = true;
  for (var g = off+len; g < off+len+0x40; g++)
    if (frame[g] !== 0xa5) guard = false;
  var after = indicators();
  var endPid = native.call("getpid", []);
  result = {id:"mdbg_request0_owned_v1",
    status:endPid.high===0 && endPid.value===pid.value ? "pass":"fail",
    details:{selector:0,pid:pid.value,ret:c.value,high:c.high,
      errno:errno===null?"ok":errno,before:before,after:after,
      changed:changed,first:first,hex:hex,guard:guard}};
} catch(error) {
  result={id:"mdbg_request0_owned_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
} finally {
  if (frame && original)
    for (var r=0;r<original.length;r++) frame[off+r]=original[r];
}
return [result];

