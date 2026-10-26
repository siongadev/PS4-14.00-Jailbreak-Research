// 551<->557 named-namespace pairing. Sweep v3 found 551 is name-keyed
// with the SAME name-limit behavior as 557 (ENAMETOOLONG on long
// shapes, ESRCH on a short unknown name) and sits in the 557/558
// number region. Question: does 551 resolve 557-created names, and
// where does it copy output? Sequence: negative control lookup, create
// via 557, bare lookup, lookup with out-buf, lookup with sizePtr,
// by-handle shape, delete via 558, post-delete lookup. Guards +
// position encoding + full restore + PID verified. Markers 4 of 8.
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
  var bufOffset = 0x200, bufLength = 0x1000;
  var guardOffset = bufOffset + bufLength;
  var guardLength = 0x100;
  var sizePtrOffset = 0x1400;
  var nameOffset = 0x1500;
  var regionEnd = nameOffset + 32;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var bufAddress = address + bufOffset;
  var sizeAddress = address + sizePtrOffset;
  var nameAddress = address + nameOffset;
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
  function arm() {
    for (var i = 0; i < bufLength; i++)
      frame[bufOffset + i] = (i * 7 + 3) & 255;
    frame.fill(0xa5, guardOffset, guardOffset + guardLength);
    frame[sizePtrOffset] = 0x00; frame[sizePtrOffset + 1] = 0x10;
    for (var z = 2; z < 8; z++) frame[sizePtrOffset + z] = 0;
  }
  function probe(name, args, hexLen) {
    arm();
    putName("PairX");
    var call = native.call(name, args);
    var errno = (call.value === -1) ? native.readErrno() : null;
    var first = -1, last = -1;
    for (var i = 0; i < bufLength; i++) {
      if (frame[bufOffset + i] !== ((i * 7 + 3) & 255)) {
        if (first === -1) first = i;
        last = i;
      }
    }
    var guardIntact = true;
    for (var g = 0; g < guardLength; g++)
      if (frame[guardOffset + g] !== 0xa5) { guardIntact = false; break; }
    var hex = "";
    if (first !== -1) {
      var dumpStart = bufOffset + first;
      var dumpLength = Math.min(hexLen || 32, last - first + 1);
      for (var d = 0; d < dumpLength; d++)
        hex += ("0" + frame[dumpStart + d].toString(16)).slice(-2);
    }
    return call.value + "/" + (errno === null ? "ok" : errno) +
      "/x" + ((first === -1) ? 0 : last - first + 1) +
      "/g" + (guardIntact ? 1 : 0) +
      (hex ? "h" + hex : "");
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("pair551_preflight");
  var lines = [];
  // a. negative control: name not created yet
  lines.push("ctl_pre:" + probe("sys551", [nameAddress, 5], 32));
  // b. create via 557
  arm();
  putName("PairX");
  var alloc = native.call("sys557", [nameAddress, 5]);
  var allocErrno = (alloc.value === -1) ? native.readErrno() : null;
  var handle = alloc.value;
  lines.push("create:" + handle + "/" +
    (allocErrno === null ? "ok" : allocErrno));
  if (allocErrno !== null || handle <= 0 || handle > 1000000)
    throw new Error("create_failed");
  mark("pair551_created");
  // c. bare lookup
  lines.push("lk_bare:" + probe("sys551", [nameAddress, 5], 32));
  // d. lookup with out-buf
  lines.push("lk_buf:" + probe("sys551",
    [nameAddress, 5, bufAddress, bufLength], 48));
  // e. lookup with sizePtr
  lines.push("lk_sp:" + probe("sys551",
    [nameAddress, 5, bufAddress, sizeAddress], 48));
  // f. by-handle shape
  lines.push("lk_id:" + probe("sys551",
    [handle, bufAddress, bufLength], 48));
  mark("pair551_paired");
  // g. delete via 558
  var del = native.call("sys558", [handle, 0, 0]);
  var delErrno = (del.value === -1) ? native.readErrno() : null;
  lines.push("delete:" + del.value + "/" +
    (delErrno === null ? "ok" : delErrno));
  // h. post-delete lookup
  lines.push("ctl_post:" + probe("sys551", [nameAddress, 5], 32));
  mark("pair551_done");
  for (var r = 0; r < original.length; r++)
    frame[bufOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[bufOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "pair551_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "pair551_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
