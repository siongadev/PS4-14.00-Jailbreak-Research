// Release every stale wrapper aliasing one live 2D context, after the
// non-aliased stale wrappers have been collected on this page.
async function run() {
  await api.mark("before_alias_scan");
  var state = window.__fw14MultiStale;
  if (!state || !state.stale || !state.fresh)
    return [{ id: "canvas_multi_stale_release_marked", status: "error",
      details: { error: "missing_multi_stale_state" } }];
  var bestIndex = -1;
  var indices = [];
  for (var i = 0; i < state.fresh.length; i++) {
    var matches = [];
    for (var j = 0; j < state.stale.length; j++) {
      if (state.stale[j] && state.stale[j].canvas === state.fresh[i].canvas)
        matches.push(j);
    }
    if (matches.length > indices.length) {
      bestIndex = i;
      indices = matches;
    }
  }
  if (indices.length < 2)
    return [{ id: "canvas_multi_stale_release_marked", status: "error",
      details: { error: "insufficient_aliases", count: indices.length } }];
  await api.mark("alias_scan_complete");
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak = [];
  for (var k = 0; k < indices.length; k++) {
    (function (slot) {
      var wrapper = state.stale[slot];
      weak.push(new WeakRef(wrapper));
      registry.register(wrapper, "alias_" + slot);
      state.stale[slot] = null;
    })(indices[k]);
  }
  var target = state.fresh[bestIndex];
  window.__fw14AliasMarkedGc = { target: target, indices: indices,
    weak: weak, registry: registry, events: events };
  await api.mark("aliases_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "multi-stale-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("alias_gc_batch_" + batch);
  }
  var weakAlive = 0;
  for (var w = 0; w < weak.length; w++)
    if (weak[w].deref()) weakAlive++;
  target.context.fillStyle = "#00ff00";
  target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_multi_stale_release_marked", status: "pass",
    details: { alias_count: indices.length,
      finalized_count: events.length, weak_alive_count: weakAlive,
      target_pixel: pixel,
      target_context_same: target.canvas.getContext("2d") === target.context } }];
}
return run();
