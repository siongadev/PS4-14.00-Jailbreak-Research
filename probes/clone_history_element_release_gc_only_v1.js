// Finalize the released list without accessing the potentially stale Element.
async function run() {
  var state = window.__fw14ElementState;
  if (!state || !state.weak || !state.node)
    return [{ id: "element_release_gc_only", status: "error", details: {
      error: "missing_element_release_state"
    } }];
  for (var batch = 1; batch <= 5; batch++) {
    var debris = [];
    for (var i = 0; i < 10000; i++)
      debris.push({ number: i, label: "element-gc" });
    debris = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    if (api && typeof api.mark === "function")
      await api.mark("element_gc_batch_" + batch);
  }
  await new Promise(function (resolve) { setTimeout(resolve, 50); });
  var weakAlive = !!state.weak.deref();
  var finalized = state.events.indexOf("list") >= 0;
  if (api && typeof api.markSync === "function") api.markSync("element_gc_complete");
  return [{ id: "element_release_gc_only", status: "pass", details: {
    mode: state.mode, list_weak_alive: weakAlive,
    list_finalized: finalized, batches: 5
  } }];
}
return run();
