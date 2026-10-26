async function run() {
  var state = window.__fw14RefcountState;
  if (!state || !state.textNode || !state.weak)
    return [{ id: "list_release_observe", status: "error", details: {
      error: "missing_release_state"
    } }];
  for (var batch = 1; batch <= 5; batch++) {
    var debris = [];
    for (var i = 0; i < 10000; i++)
      debris.push({ number: i, label: "refcount-gc" });
    debris = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    if (api && typeof api.mark === "function")
      await api.mark("list_gc_batch_" + batch);
  }
  await new Promise(function (resolve) { setTimeout(resolve, 50); });
  var weakAlive = !!state.weak.deref();
  var finalized = state.events.indexOf("list") >= 0;
  if (api && typeof api.markSync === "function") api.markSync("list_before_text_access");
  var data = state.textNode.data;
  var type = state.textNode.nodeType;
  var detached = state.textNode.parentNode === null;
  return [{ id: "list_release_observe", status: "pass", details: {
    mode: state.mode, list_weak_alive: weakAlive,
    list_finalized: finalized, text_data: data,
    text_type: type, text_detached: detached, batches: 5
  } }];
}
return run();
