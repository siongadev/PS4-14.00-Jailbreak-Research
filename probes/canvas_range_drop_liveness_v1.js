async function run() {
  await api.mark("before_drop_liveness");
  var drop = window.__fw14RangeDropGc;
  var gc = window.__fw14RangeGc;
  if (!drop || !gc)
    return [{ id: "canvas_range_drop_liveness", status: "error",
      details: { error: "missing_range_drop_state" } }];
  var weakAlive = 0;
  for (var i = 0; i < drop.weak.length; i++)
    if (drop.weak[i].deref()) weakAlive++;
  var remaining = gc.ranges.filter(Boolean);
  var bound = remaining.filter(function (item) {
    return item.startContainer === gc.target.canvas &&
      item.endContainer === gc.target.canvas;
  }).length;
  gc.target.context.fillStyle = "#00ffff";
  gc.target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    gc.target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_range_drop_liveness", status: "pass",
    details: { dropped_range_finalized_count: drop.events.length,
      dropped_range_weak_alive_count: weakAlive,
      remaining_range_count: remaining.length, bound_range_count: bound,
      alias_finalized_count: gc.events.length,
      target_pixel: pixel,
      target_context_same:
        gc.target.canvas.getContext("2d") === gc.target.context } }];
}
return run();
