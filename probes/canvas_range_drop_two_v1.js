// Continue the dose test: remove two of the four remaining Range roots.
async function run() {
  await api.mark("before_two_range_drop");
  var gc = window.__fw14RangeGc;
  if (!gc || gc.indices.length < 3 || gc.events.length !== gc.indices.length ||
      gc.ranges.filter(Boolean).length !== 4)
    return [{ id: "canvas_range_drop_two", status: "error",
      details: { error: "unexpected_range_gc_state" } }];
  var slots = [];
  for (var i = 0; i < gc.ranges.length; i++)
    if (gc.ranges[i]) slots.push(i);
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak = [];
  for (var k = 0; k < 2; k++) {
    (function (slot) {
      var range = gc.ranges[slot];
      weak.push(new WeakRef(range));
      registry.register(range, "range_" + slot);
      gc.ranges[slot] = null;
    })(slots[k]);
  }
  window.__fw14RangeDropGc = { weak: weak, registry: registry,
    events: events, target: gc.target };
  await api.mark("two_ranges_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "range-drop-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("two_range_batch_" + batch);
  }
  var weakAlive = 0;
  for (var w = 0; w < weak.length; w++)
    if (weak[w].deref()) weakAlive++;
  await api.mark("before_two_range_check");
  var target = gc.target;
  target.context.fillStyle = "#ff00ff";
  target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_range_drop_two", status: "pass",
    details: { released_range_count: 2, remaining_range_count: gc.ranges.filter(Boolean).length,
      range_finalized_count: events.length, range_weak_alive_count: weakAlive,
      alias_finalized_count: gc.events.length, target_pixel: pixel,
      target_context_same: target.canvas.getContext("2d") === target.context } }];
}
return run();
