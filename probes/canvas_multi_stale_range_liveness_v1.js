// Follow up after the release command has returned and GC had an idle turn.
async function run() {
  await api.mark("before_range_liveness");
  var gc = window.__fw14RangeGc;
  if (!gc)
    return [{ id: "canvas_multi_stale_range_liveness", status: "error",
      details: { error: "missing_range_gc_state" } }];
  var weakAlive = 0;
  for (var i = 0; i < gc.weak.length; i++)
    if (gc.weak[i].deref()) weakAlive++;
  var bound = 0;
  for (var r = 0; r < gc.ranges.length; r++)
    if (gc.ranges[r].startContainer === gc.target.canvas &&
        gc.ranges[r].endContainer === gc.target.canvas) bound++;
  gc.target.context.fillStyle = "#0000ff";
  gc.target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    gc.target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_multi_stale_range_liveness", status: "pass",
    details: { alias_count: gc.indices.length,
      weak_alive_count: weakAlive, finalized_count: gc.events.length,
      range_count: gc.ranges.length, bound_range_count: bound,
      target_pixel: pixel,
      target_context_same:
        gc.target.canvas.getContext("2d") === gc.target.context } }];
}
return run();
