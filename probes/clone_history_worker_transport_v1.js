// Establish a current-project worker transport before attempting overlap tests.
// This probe performs no native calls and always terminates its worker.
return new Promise(function (resolve) {
  var worker = null;
  var workerUrl = null;
  var timer = null;
  var done = false;
  var sentAt = Date.now();
  function finish(status, details) {
    if (done) return;
    done = true;
    if (timer !== null) clearTimeout(timer);
    if (worker) worker.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    resolve([{ id: "worker_transport_v1", status: status, details: details }]);
  }
  try {
    if (typeof Worker !== "function" || typeof Blob !== "function" ||
        !URL || typeof URL.createObjectURL !== "function") {
      finish("unsupported", { phase: "capability", error: "worker_or_blob_unavailable" });
      return;
    }
    var workerSource = [
      "self.onmessage = function (event) {",
      "  var item = event.data;",
      "  var typed = new Uint32Array([0x11223344, 0xaabbccdd]);",
      "  self.postMessage({nonce: item.nonce, typed: typed,",
      "                    worker_kind: typeof WorkerGlobalScope});",
      "};"
    ].join("\n");
    workerUrl = URL.createObjectURL(new Blob([workerSource],
                                        { type: "text/javascript" }));
    worker = new Worker(workerUrl);
    timer = setTimeout(function () {
      finish("error", { phase: "reply", error: "worker_timeout" });
    }, 5000);
    worker.onerror = function (event) {
      finish("error", { phase: "worker", error: String(event.message || "worker_error").slice(0, 180) });
    };
    worker.onmessage = function (event) {
      var reply = event.data || {};
      var typed = reply.typed;
      var typedOk = typed instanceof Uint32Array && typed.length === 2 &&
        typed[0] === 0x11223344 && typed[1] === 0xaabbccdd;
      var nonceOk = reply.nonce === "fw14-worker-transport-v1";
      finish(typedOk && nonceOk ? "pass" : "fail",
             { nonce_ok: nonceOk, typed_ok: typedOk,
               worker_kind: String(reply.worker_kind).slice(0, 64),
               elapsed_ms: Date.now() - sentAt });
    };
    worker.postMessage({ nonce: "fw14-worker-transport-v1" });
  } catch (error) {
    finish("error", { phase: "create_or_send", error: String(error).slice(0, 180) });
  }
});
