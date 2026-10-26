// Test whether the fixed-buffer marker belongs to the stored History value.
function makeKey() {
  var bytes = [0, 0, 0, 0x16, 0x02, 8];
  for (var i = 1; i < 8; i++) bytes.push(0);
  bytes.push(0xf8);
  for (var j = 1; j < 8; j++) bytes.push(0xff);
  bytes.push(0x13, 3, 0, 0xff, 0xff, 0xff, 0xff);
  var chars = [];
  for (var k = 0; k < bytes.length; k += 2)
    chars.push(String.fromCharCode(bytes[k] | (bytes[k + 1] << 8)));
  return (chars.join("") + "A".repeat(256)).slice(0, 256);
}
function mark(name) {
  if (api && typeof api.markSync === "function") api.markSync(name);
}
return new Promise(function(resolve) {
  var phase = "build";
  var synthetic = null;
  var index = -1;
  var before = null;
  var settled = false;
  var timeout = null;
  function finish(status, details) {
    if (settled) return;
    settled = true;
    if (timeout !== null) clearTimeout(timeout);
    window.removeEventListener("popstate", onPop);
    if (synthetic && index >= 0) {
      try { synthetic[index] = before; details.restored_byte = synthetic[index]; }
      catch (error) { details.restore_error = String(error).slice(0, 100); }
    }
    try { history.replaceState(null, ""); }
    catch (error) { details.cleanup_error = String(error).slice(0, 100); }
    resolve([{ id: "stored_copy_alias", status: status, details: details }]);
  }
  function onPop(event) {
    mark("stored_copy_popstate");
    try {
      var state = history.state;
      var fixed = state && state.filler && state.filler[2];
      var bytes = fixed instanceof ArrayBuffer ? new Uint8Array(fixed) : null;
      var changedAt = -1;
      if (bytes) {
        for (var i = 0; i < bytes.length; i++) {
          if (bytes[i] !== 0x91) { changedAt = i; break; }
        }
      }
      var markerAfter = synthetic[index];
      finish(bytes && markerAfter === 0xa8 ? "pass" : "fail", {
        phase: "popstate", marker_before: before, marker_after: markerAfter,
        fixed_length: bytes ? bytes.length : -1,
        fixed_first: bytes ? bytes[0] : null,
        fixed_changed_index: changedAt,
        fixed_changed_value: changedAt >= 0 ? bytes[changedAt] : null,
        state_is_event_state: state === event.state
      });
    } catch (error) {
      finish("error", { phase: "popstate", error: String(error).slice(0, 200) });
    }
  }
  try {
    var backing = new ArrayBuffer(8, { maxByteLength: 16 });
    new Uint8Array(backing).fill(0x41);
    var fixed = new ArrayBuffer(65536);
    new Uint8Array(fixed).fill(0x91);
    var filler = new Array(253);
    filler[0] = BigInt(1) << BigInt(40);
    filler[1] = backing;
    filler[2] = fixed;
    for (var i = 3; i < 27; i++) {
      var neighbor = new ArrayBuffer(8, { maxByteLength: 16 });
      new Uint8Array(neighbor).fill(0x40 + i);
      filler[i] = neighbor;
    }
    for (var j = 27; j < filler.length; j++) filler[j] = {};
    var shared = { marker: 0x51515151 };
    var input = { filler: filler, first: shared, second: shared };
    input[makeKey()] = 0;
    mark("stored_copy_ready");
    phase = "store";
    history.replaceState(input, "");
    mark("stored_copy_stored");
    phase = "load";
    var output = history.state;
    mark("stored_copy_loaded");
    synthetic = output["\u0000"];
    var viewValid = synthetic instanceof Uint8Array &&
      synthetic.buffer === output.filler[1] && synthetic.byteOffset === 8 &&
      synthetic.length > 1e12;
    if (!viewValid) {
      synthetic = null;
      finish("fail", { phase: "load", view_valid: false });
      return;
    }
    for (var n = 0; n < 8; n++) {
      var at = 65528 + 65536 * n;
      if (synthetic[at] === 0x91) { index = at; break; }
    }
    if (index < 0) {
      finish("fail", { phase: "locate", marker_index: -1 });
      return;
    }
    before = synthetic[index];
    phase = "push";
    history.pushState({ fw14sentinel: 1 }, "");
    if (history.state.fw14sentinel !== 1) {
      finish("fail", { phase: "push", marker_index: index });
      return;
    }
    phase = "write";
    synthetic[index] = 0xa8;
    var writeBack = synthetic[index];
    mark("stored_copy_written");
    if (writeBack !== 0xa8) {
      finish("fail", { phase: "write", marker_index: index, write_back: writeBack });
      return;
    }
    window.addEventListener("popstate", onPop);
    timeout = setTimeout(function() {
      finish("fail", { phase: "wait_popstate", marker_index: index });
    }, 8000);
    mark("stored_copy_back_requested");
    history.back();
  } catch (error) {
    finish("error", { phase: phase, error: String(error).slice(0, 200) });
  }
});
