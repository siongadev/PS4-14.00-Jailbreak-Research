// Release two of several stale wrappers that alias one live 2D context.
// The other stale wrappers and the target canvas/context remain rooted.
async function run() {
  var state = window.__fw14MultiStale;
  if (!state || !state.stale || !state.fresh)
    return [{ id: "canvas_multi_stale_release_two", status: "error",
      details: { error: "missing_multi_stale_state" } }];
  var targetIndex = -1;
  var aliases = [];
  for (var i = 0; i < state.fresh.length; i++) {
    var matches = [];
    for (var j = 0; j < state.stale.length; j++)
      if (state.stale[j] && state.stale[j].canvas === state.fresh[i].canvas)
        matches.push(j);
    if (matches.length > aliases.length) {
      aliases = matches;
      targetIndex = i;
    }
  }
  if (aliases.length < 4)
    return [{ id: "canvas_multi_stale_release_two", status: "pass",
      details: { four_aliases_found: false, best_alias_count: aliases.length } }];
  await api.mark("before_release_two");
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak = [];
  for (var k = 0; k < 2; k++) {
    (function (slot) {
      var wrapper = state.stale[slot];
      weak.push(new WeakRef(wrapper));
      registry.register(wrapper, "stale_" + slot);
      state.stale[slot] = null;
    })(aliases[k]);
  }
  var target = state.fresh[targetIndex];
  window.__fw14TwoStaleGc = { target: target, weak: weak,
    registry: registry, events: events };
  await api.mark("two_wrappers_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "multi-stale-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("two_gc_batch_" + batch);
  }
  var weakAlive = 0;
  for (var w = 0; w < weak.length; w++)
    if (weak[w].deref()) weakAlive++;
  await api.mark("before_two_target_check");
  target.context.fillStyle = "#00ff00";
  target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_multi_stale_release_two", status: "pass",
    details: { four_aliases_found: true, target_index: targetIndex,
      released_count: 2, retained_aliases: aliases.length - 2,
      finalized_count: events.length, weak_alive_count: weakAlive,
      target_pixel: pixel,
      target_context_same: target.canvas.getContext("2d") === target.context } }];
}
return run();
