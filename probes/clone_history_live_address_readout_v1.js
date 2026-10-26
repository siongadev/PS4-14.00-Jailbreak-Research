// Print the current page's measured userland addresses on the PS4 screen.
// KBASE remains unverified: syscall 638 was a time conversion, not a leak.
var result, phase = "preflight", frame = null, savedBuffer = null;
var savedSize = null, root = null, pid = null, modules = null;
try {
  var native = window.__fw14NativeInvoke;
  var state = window.__fw14ArrayState;
  var census = window.__fw14BulkModules;
  if (!native || !native.frame || !native.wrappers ||
      !native.wrappers.sys598 || !native.wrappers.getpid ||
      !Number.isSafeInteger(native.frameAddress) || !state ||
      state.array[0] !== state.a || !census ||
      !Array.isArray(census.modules))
    throw new Error("current_page_inventory_missing");
  frame = native.frame;
  modules = census.modules.filter(function (entry) {
    return /\.sprx$/.test(entry.name);
  });
  if (frame.length < 0x1e08 || modules.length < 1 ||
      modules.length !== census.modules.length - 1)
    throw new Error("module_count_invalid");
  var identity = native.call("getpid", []);
  pid = identity.value;
  if (identity.high !== 0 || pid !== census.pid)
    throw new Error("module_pid_changed");
  savedBuffer = Array.from(frame.subarray(0x200, 0x210));
  savedSize = Array.from(frame.subarray(0x1e00, 0x1e08));
  var dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  frame.fill(0, 0x200, 0x210);
  dv.setUint32(0x1e00, 0x1000, true);
  dv.setUint32(0x1e04, 0, true);
  phase = "root_query";
  var call = native.call("sys598", [native.frameAddress + 0x200,
    native.frameAddress + 0x1e00, 0, 0, 0, 0]);
  if (call.value !== 0) throw new Error("root_query_" + call.value);
  root = dv.getUint32(0x200, true) +
    dv.getUint32(0x204, true) * 0x100000000;
  if (!Number.isSafeInteger(root) || root < 0x10000000 ||
      root >= 0x1000000000000 || root % 4096 !== 0)
    throw new Error("root_pointer_invalid");
} catch (error) {
  result = { id: "live_address_readout_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } };
} finally {
  if (frame && savedBuffer && savedSize) {
    for (var i = 0; i < savedBuffer.length; i++)
      frame[0x200 + i] = savedBuffer[i];
    for (var j = 0; j < savedSize.length; j++)
      frame[0x1e00 + j] = savedSize[j];
  }
  if (window.__fw14ArrayState && window.__fw14ArrayState.array &&
      window.__fw14ArrayState.a)
    window.__fw14ArrayState.array[0] = window.__fw14ArrayState.a;
}
if (!result) {
  var restored = savedBuffer.every(function (byte, index) {
    return frame[0x200 + index] === byte;
  }) && savedSize.every(function (byte, index) {
    return frame[0x1e00 + index] === byte;
  });
  if (!restored) {
    result = { id: "live_address_readout_v1", status: "fail",
      details: { error: "frame_not_restored" } };
  } else {
    var lines = [
      "KBASE       unverified",
      "ROOTBASE    0x" + root.toString(16) + " (browser ProcParam)",
      "PID         " + pid,
      "",
      "LOADED SPRX (" + modules.length + ")"
    ];
    modules.forEach(function (entry) {
      lines.push("0x" + entry.base.toString(16) + "  " + entry.name);
    });
    if (api && typeof api.log === "function") {
      api.log(lines.join("\n"));
    } else {
      var readout = document.getElementById("fw14-live-readout");
      if (!readout) {
        readout = document.createElement("pre");
        readout.id = "fw14-live-readout";
        readout.style.cssText = "margin:20px 18px;color:#c8ced8;" +
          "font:14px/1.55 Consolas,monospace;white-space:pre-wrap;" +
          "overflow-wrap:anywhere";
        document.body.appendChild(readout);
      }
      readout.textContent = lines.join("\n");
    }
    result = { id: "live_address_readout_v1", status: "pass",
      details: { pid: pid, root_base: "0x" + root.toString(16),
        sprx_count: modules.length, visible: true, frame_restored: true } };
  }
}
return [result];
