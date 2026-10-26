// Named-object slot mechanics: create (557), delete (558) — the pair
// that just proved live (558 succeeded on a reused low-slot ID while
// 555/556/616/595 all ESRCH'd). This probe maps the table: fresh-ID
// sequence, delete consumes (2nd delete ESRCH?) or not, immediate slot
// reuse after delete (LIFO free-list = controllable reclaim), whether
// our first boot-ID (8289, never lookable) is deletable, and re-delete
// of the system slot 103. All shapes already proven safe this session;
// the only novel behavior is delete-of-deleted, which a guarded kernel
// answers with ESRCH. Output buffers + guards + full restore + PID.
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
  var nameOffset = 0x200;
  var regionEnd = nameOffset + 32;
  if (regionEnd > frame.length)
    throw new Error("frame_region_too_small");
  var nameAddress = address + nameOffset;
  var original = Array.from(frame.subarray(nameOffset, regionEnd));
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  function alloc(text) {
    for (var i = 0; i < text.length; i++)
      frame[nameOffset + i] = text.charCodeAt(i);
    frame[nameOffset + text.length] = 0;
    for (var z = text.length + 1; z < 24; z++) frame[nameOffset + z] = 0;
    var call = native.call("sys557", [nameAddress, text.length]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    return { id: call.value, errno: errno };
  }
  function del(id) {
    var call = native.call("sys558", [id, 0, 0]);
    var errno = (call.value === -1) ? native.readErrno() : null;
    return { ret: call.value, errno: errno };
  }
  var lines = [];
  function rec(label, obj, key) {
    lines.push(label + ":" + obj[key] + "/" +
      (obj.errno === null ? "ok" : obj.errno));
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("slots_preflight");
  // 1. fresh sequence of three allocations
  var h1 = alloc("SlotA");
  rec("alloc_h1", h1, "id");
  var h2 = alloc("SlotB");
  rec("alloc_h2", h2, "id");
  var h3 = alloc("SlotC");
  rec("alloc_h3", h3, "id");
  if (h1.errno !== null || h2.errno !== null || h3.errno !== null)
    throw new Error("alloc_failed");
  mark("slots_allocated");
  // 2. delete h2 once, then twice (double-delete behavior)
  rec("del_h2_1", del(h2.id), "ret");
  rec("del_h2_2", del(h2.id), "ret");
  mark("slots_h2_deleted");
  // 3. immediate reuse probe: two fresh allocations after the delete
  var h4 = alloc("SlotD");
  rec("alloc_h4", h4, "id");
  var h5 = alloc("SlotE");
  rec("alloc_h5", h5, "id");
  // 4. is the never-lookable boot ID deletable? (allocA 8289 analog)
  var probeId = h1.id + 0;
  rec("del_h1", del(h1.id), "ret");
  // 5. re-delete of the system low-slot 103 from the pair probe
  rec("del_103", del(103), "ret");
  // 6. post-state: sequence after all deletions
  var h6 = alloc("SlotF");
  rec("alloc_h6", h6, "id");
  var h7 = alloc("SlotG");
  rec("alloc_h7", h7, "id");
  mark("slots_sequence_done");
  // 7. cleanup: delete every live handle we still hold
  rec("del_h3", del(h3.id), "ret");
  rec("del_h4", del(h4.id), "ret");
  rec("del_h5", del(h5.id), "ret");
  rec("del_h6", del(h6.id), "ret");
  rec("del_h7", del(h7.id), "ret");
  // 8. allocator health check
  var h8 = alloc("SlotH");
  rec("alloc_h8", h8, "id");
  rec("del_h8", del(h8.id), "ret");
  var probeIdOut = probeId;
  for (var r = 0; r < original.length; r++)
    frame[nameOffset + r] = original[r];
  var restored = true;
  for (var r2 = 0; r2 < original.length; r2++)
    if (frame[nameOffset + r2] !== original[r2]) { restored = false; break; }
  var after = native.call("getpid", []);
  mark("slots_done");
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "namedobj_slots_v1",
    status: (after.value === before.value && after.high === 0 &&
      restored) ? "pass" : "fail",
    details: { lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      h1_id: String(probeIdOut),
      pid_ok: after.value === before.value && after.high === 0,
      region_restored: restored } };
} catch (error) {
  result = { id: "namedobj_slots_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
