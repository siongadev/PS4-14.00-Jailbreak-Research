// Drop only the stale wrapper after confirmed slot reuse; retain the new
// canvas and context, then compare GC progress and canvas behavior.
async function run() {
  var state = window.__fw14CanvasReuseWrite;
  if (!state || !state.inner || !state.held)
    return [{ id: "canvas_alias_finalization", status: "error",
      details: { error: "missing_rooted_alias_state" } }];
  var aliasIndex = state.held.findIndex(function (item) {
    return item.canvas === state.inner.canvas;
  });
  if (aliasIndex < 0 || state.inner === state.held[aliasIndex].context)
    return [{ id: "canvas_alias_finalization", status: "error",
      details: { error: "no_distinct_alias", alias_index: aliasIndex } }];
  await api.mark("before_alias_release");
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak;
  (function () {
    var stale = state.inner;
    weak = new WeakRef(stale);
    registry.register(stale, "stale_wrapper");
    state.inner = null;
  })();
  var gcState = { weak: weak, registry: registry, events: events,
    target: state.held[aliasIndex] };
  window.__fw14CanvasAliasGc = gcState;
  await api.mark("alias_wrapper_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var i = 0; i < 10000; i++)
      pressure.push({ batch: batch, index: i, text: "gc-pressure-" + i });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("alias_gc_batch_" + batch);
  }
  var target = gcState.target;
  var weakAlive = !!weak.deref();
  var finalized = events.indexOf("stale_wrapper") >= 0;
  await api.mark("before_target_post_gc");
  target.context.fillStyle = "#00ff00";
  target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_alias_finalization", status: "pass",
    details: { alias_index: aliasIndex, weak_alive: weakAlive,
      finalized: finalized, event_count: events.length,
      target_context_same: target.canvas.getContext("2d") === target.context,
      target_pixel: pixel } }];
}
return run();
