// Remove one of the remaining Range roots after the stale wrappers have
// finalized; may be repeated once after a completed liveness check.
async function run() {
  await api.mark("before_single_drop");
  var gc = window.__fw14RangeGc;
  if (!gc || gc.events.length !== gc.indices.length)
    return [{ id: "canvas_range_drop_one", status: "error",
      details: { error: "unexpected_alias_state" } }];
  var before = gc.ranges.filter(Boolean).length;
  if (before < 1 || before > 2)
    return [{ id: "canvas_range_drop_one", status: "error",
      details: { error: "unexpected_range_count", count: before } }];
  var slot = gc.ranges.findIndex(Boolean);
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak;
  (function () {
    var range = gc.ranges[slot];
    weak = new WeakRef(range);
    registry.register(range, "range_" + slot);
    gc.ranges[slot] = null;
  })();
  window.__fw14RangeDropGc = { weak: [weak], registry: registry,
    events: events, target: gc.target };
  await api.mark("one_range_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "range-drop-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("single_gc_batch_" + batch);
  }
  var weakAlive = !!weak.deref();
  await api.mark("before_single_target");
  var target = gc.target;
  target.context.fillStyle = before === 2 ? "#ff8800" : "#8800ff";
  target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_range_drop_one", status: "pass",
    details: { before_range_count: before, remaining_range_count: gc.ranges.filter(Boolean).length,
      range_finalized_count: events.length, range_weak_alive: weakAlive,
      alias_finalized_count: gc.events.length, target_pixel: pixel,
      target_context_same: target.canvas.getContext("2d") === target.context } }];
}
return run();
