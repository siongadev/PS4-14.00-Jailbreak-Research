// Keep all stale wrappers rooted while applying the same allocation pressure
// as the release probe. This isolates finalization from generic GC pressure.
async function run() {
  var state = window.__fw14MultiStale;
  if (!state || !state.stale || !state.fresh)
    return [{ id: "canvas_multi_stale_pressure_control", status: "error",
      details: { error: "missing_multi_stale_state" } }];
  var bestIndex = -1;
  var bestCount = 0;
  for (var i = 0; i < state.fresh.length; i++) {
    var count = 0;
    for (var j = 0; j < state.stale.length; j++)
      if (state.stale[j] && state.stale[j].canvas === state.fresh[i].canvas) count++;
    if (count > bestCount) {
      bestCount = count;
      bestIndex = i;
    }
  }
  if (bestCount < 2)
    return [{ id: "canvas_multi_stale_pressure_control", status: "pass",
      details: { multi_alias_found: false, best_alias_count: bestCount } }];
  await api.mark("before_rooted_pressure");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "multi-stale-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("rooted_gc_batch_" + batch);
  }
  await api.mark("before_rooted_target_check");
  var target = state.fresh[bestIndex];
  target.context.fillStyle = "#00ff00";
  target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_multi_stale_pressure_control", status: "pass",
    details: { multi_alias_found: true, alias_count: bestCount,
      target_index: bestIndex, stale_rooted_count: state.stale.filter(Boolean).length,
      target_pixel: pixel,
      target_context_same: target.canvas.getContext("2d") === target.context } }];
}
return run();
