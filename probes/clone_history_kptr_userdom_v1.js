// Cross-boundary relocation discriminator, SAFE half: user domains
// only. Matrix = {zero-arg, mapped-user pointer, unmapped-user
// pointer} x {596 dynlib_do_copy_relocations, 599
// dynlib_process_needed_and_relocate, 601 mdbg_service, 602
// randomized_path, 605 workaround8849, 606 is_development_mode, 617
// set_gpo}. All calls go through call64 (installer v26) with exact
// [lo,hi] pairs; a getpid sanity call validates call64 before the
// matrix. The unmapped-user address (0x700000000000) is expected to
// EFAULT anywhere the syscall actually derefs arg1; kernel domains
// are probe kptr_kerndom and run separately. Full restore, PID.
var result;
var phase = "preflight";
try {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  if (!state || !plan || !native ||
      typeof native.call !== "function" ||
      typeof native.call64 !== "function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress))
    throw new Error("chain_or_call64_missing");
  function mark(phaseName) {
    try {
      if (api && typeof api.markSync === "function")
        api.markSync(phaseName);
    } catch (markerError) {}
  }
  var before = native.call("getpid", []);
  if (before.high !== 0 || before.value < 1 || before.value > 100000)
    throw new Error("session_pid_changed");
  mark("k2a_preflight");
  // call64 sanity: getpid via the 64-bit path
  var sanity = native.call64("getpid", []);
  if (sanity.high !== 0 || sanity.value !== before.value)
    throw new Error("call64_sanity_failed");
  var frameLo = native.frameAddress % 0x100000000;
  var frameHi = Math.floor(native.frameAddress / 0x100000000);
  var muArg = [frameLo, frameHi];
  var uuArg = [0, 0x7000];
  var lenArg = [0x1000, 0];
  var names = ["sys596", "sys599", "sys601", "sys602",
    "sys605", "sys606", "sys617"];
  var lines = [];
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    phase = name;
    if (!native.wrappers[name]) {
      lines.push(name.slice(3) + ":absent");
      continue;
    }
    var zc = native.call64(name, []);
    var ze = (zc.value === -1) ? native.readErrno() : null;
    var mc = native.call64(name, [muArg, lenArg]);
    var me = (mc.value === -1) ? native.readErrno() : null;
    var uc = native.call64(name, [uuArg, lenArg]);
    var ue = (uc.value === -1) ? native.readErrno() : null;
    lines.push(name.slice(3) + ":z(" + zc.value + "/" +
      (ze === null ? "ok" : ze) + ") mu(" + mc.value + "/" +
      (me === null ? "ok" : me) + ") uu(" + uc.value + "/" +
      (ue === null ? "ok" : ue) + ")");
  }
  var after = native.call("getpid", []);
  mark("k2a_done");
  var linesA = [], linesB = [];
  for (var li = 0; li < lines.length; li++) {
    if (linesA.join(" | ").length + lines[li].length < 440)
      linesA.push(lines[li]);
    else linesB.push(lines[li]);
  }
  result = { id: "kptr_userdom_v1",
    status: (after.value === before.value && after.high === 0) ?
      "pass" : "fail",
    details: { lines_a: linesA.join(" | "),
      lines_b: linesB.join(" | "),
      pid_ok: after.value === before.value && after.high === 0 } };
} catch (error) {
  result = { id: "kptr_userdom_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
}
return [result];
