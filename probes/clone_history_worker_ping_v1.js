// Minimal pre-groom Blob-worker transport check: transfer a 16-byte marker
// to a fresh worker, compare the echoed bytes, then repeat with a second
// worker. No exploit chain, no native calls, no groom dependency; run this
// FIRST on a fresh session to isolate worker-creation health from the
// chain-prep stages (the 2026-10-21 boot saw worker_create ping_mismatch
// only after the full groom sequence had run).
var phase = "preflight";
function runOne(index) {
  return new Promise(function (resolve) {
    var marker = [0x14, 0x00, 0x00, 0x00, 0x63, 0x00, 0x00, 0x00,
                  0xa5, 0x31, 0x00, 0x00, 0xef, 0xbe, 0x00, 0x00];
    var source = "self.onmessage=function(e){var d=e.data;" +
                 "var u=new Uint8Array(d.buf);" +
                 "var out=[];for(var i=0;i<16;i++)out.push(u[i]);" +
                 "self.postMessage({id:d.id,words:out});};";
    var url = URL.createObjectURL(new Blob([source],
                   { type: "application/javascript" }));
    var worker = null;
    var started = Date.now();
    var timer = setTimeout(function () {
      finish(new Error("worker_timeout"));
    }, 8000);
    function finish(error) {
      clearTimeout(timer);
      if (worker) try { worker.terminate(); } catch (e) {}
      try { URL.revokeObjectURL(url); } catch (e) {}
      resolve({ ok: !error, ms: Date.now() - started,
                error: error ? String(error).slice(0, 120) : null });
    }
    try {
      worker = new Worker(url);
      if (api && typeof api.markSync === "function" && index === 0)
        api.markSync("worker_ping_created");
      worker.onerror = function (event) {
        finish(new Error("worker_error:" +
          String(event.message || "unknown").slice(0, 80)));
      };
      worker.onmessage = function (event) {
        var data = event.data;
        if (!data || data.id !== index || !data.words ||
            data.words.length !== 16) {
          finish(new Error("worker_ping_mismatch"));
          return;
        }
        for (var i = 0; i < 16; i++)
          if (data.words[i] !== marker[i]) {
            finish(new Error("worker_marker_mismatch_at_" + i));
            return;
          }
        finish(null);
      };
      var buffer = new ArrayBuffer(16);
      new Uint8Array(buffer).set(marker);
      worker.postMessage({ id: index, buf: buffer }, [buffer]);
    } catch (error) {
      finish(error);
    }
  });
}
return runOne(0).then(function (first) {
  return runOne(1).then(function (second) {
    return [{ id: "worker_ping_v1",
      status: (first.ok && second.ok) ? "pass" : "fail",
      details: { first_ok: first.ok, first_ms: first.ms,
        first_error: first.error, second_ok: second.ok,
        second_ms: second.ms, second_error: second.error } }];
  });
}).catch(function (error) {
  return [{ id: "worker_ping_v1", status: "error",
    details: { phase: phase, error: String(error).slice(0, 180) } }];
});
