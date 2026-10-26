// Collect the released list without touching the possibly stale Text wrapper.
async function run() {
  var state = window.__fw14RefcountState;
  if (!state || !state.weak || !state.textNode)
    return [{ id: "list_release_gc_only", status: "error", details: {
      error: "missing_release_state"
    } }];
  for (var batch = 1; batch <= 5; batch++) {
    var debris = [];
    for (var i = 0; i < 10000; i++)
      debris.push({ number: i, label: "refcount-gc" });
    debris = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    if (api && typeof api.mark === "function")
      await api.mark("list_gc_only_batch_" + batch);
  }
  await new Promise(function (resolve) { setTimeout(resolve, 50); });
  var weakAlive = !!state.weak.deref();
  var finalized = state.events.indexOf("list") >= 0;
  if (api && typeof api.markSync === "function") api.markSync("list_gc_only_complete");
  return [{ id: "list_release_gc_only", status: "pass", details: {
    mode: state.mode, list_weak_alive: weakAlive,
    list_finalized: finalized, batches: 5
  } }];
}
return run();
