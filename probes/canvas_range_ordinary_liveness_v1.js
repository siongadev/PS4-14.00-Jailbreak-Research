async function run() {
  await api.mark("before_ordinary_liveness");
  var gc = window.__fw14OrdinaryRange;
  if (!gc)
    return [{ id: "canvas_range_ordinary_liveness", status: "error",
      details: { error: "missing_ordinary_state" } }];
  var alive = !!gc.weak.deref();
  var bound = gc.retained.startContainer === gc.canvas &&
    gc.retained.endContainer === gc.canvas;
  gc.context.fillStyle = "#0000ff";
  gc.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    gc.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_range_ordinary_liveness", status: "pass",
    details: { released_weak_alive: alive,
      released_finalized_count: gc.events.length,
      retained_bound: bound, target_pixel: pixel,
      target_context_same: gc.canvas.getContext("2d") === gc.context } }];
}
return run();
