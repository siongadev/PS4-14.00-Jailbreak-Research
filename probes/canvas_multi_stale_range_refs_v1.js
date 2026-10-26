// Hold additional native Node references to the aliased canvas through
// live DOM Range boundaries before releasing all stale context wrappers.
async function run() {
  await api.mark("before_range_scan");
  var state = window.__fw14MultiStale;
  if (!state || !state.stale || !state.fresh)
    return [{ id: "canvas_multi_stale_range_refs", status: "error",
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
  if (indices.length < 3)
    return [{ id: "canvas_multi_stale_range_refs", status: "error",
      details: { error: "need_three_aliases", count: indices.length } }];
  var target = state.fresh[bestIndex];
  var ranges = [];
  for (var r = 0; r < 8; r++) {
    var range = document.createRange();
    range.selectNodeContents(target.canvas);
    if (range.startContainer !== target.canvas ||
        range.endContainer !== target.canvas)
      return [{ id: "canvas_multi_stale_range_refs", status: "error",
        details: { error: "range_did_not_hold_canvas", index: r } }];
    ranges.push(range);
  }
  await api.mark("range_refs_created");
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
  window.__fw14RangeGc = { target: target, ranges: ranges,
    indices: indices, weak: weak, registry: registry, events: events };
  await api.mark("range_aliases_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "multi-stale-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("range_gc_batch_" + batch);
  }
  var weakAlive = 0;
  for (var w = 0; w < weak.length; w++)
    if (weak[w].deref()) weakAlive++;
  target.context.fillStyle = "#00ff00";
  target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_multi_stale_range_refs", status: "pass",
    details: { alias_count: indices.length, range_count: ranges.length,
      range_boundaries_on_target: ranges.every(function (item) {
        return item.startContainer === target.canvas &&
          item.endContainer === target.canvas;
      }), weak_alive_count: weakAlive, finalized_count: events.length,
      target_pixel: pixel,
      target_context_same: target.canvas.getContext("2d") === target.context } }];
}
return run();
