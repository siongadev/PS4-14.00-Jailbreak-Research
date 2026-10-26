// Continue after release_two_v2: drop the last rooted stale wrapper that
// aliases the target, then observe collection and target behavior.
async function run() {
  var state = window.__fw14MultiStale;
  var previous = window.__fw14TwoStaleGc;
  if (!state || !previous || !previous.target || !previous.weak)
    return [{ id: "canvas_multi_stale_release_last", status: "error",
      details: { error: "missing_two_release_state" } }];
  var remaining = [];
  for (var i = 0; i < state.stale.length; i++) {
    if (state.stale[i] && state.stale[i].canvas === previous.target.canvas)
      remaining.push(i);
  }
  if (remaining.length !== 1)
    return [{ id: "canvas_multi_stale_release_last", status: "error",
      details: { error: "remaining_alias_count", count: remaining.length } }];
  await api.mark("before_last_release");
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weakLast;
  (function () {
    var wrapper = state.stale[remaining[0]];
    weakLast = new WeakRef(wrapper);
    registry.register(wrapper, "last_stale");
    state.stale[remaining[0]] = null;
  })();
  window.__fw14LastStaleGc = { weakLast: weakLast,
    registry: registry, events: events, target: previous.target };
  await api.mark("last_wrapper_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "multi-stale-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("last_gc_batch_" + batch);
  }
  var previousAlive = 0;
  for (var w = 0; w < previous.weak.length; w++)
    if (previous.weak[w].deref()) previousAlive++;
  var lastAlive = !!weakLast.deref();
  await api.mark("before_last_target_check");
  var target = previous.target;
  target.context.fillStyle = "#ff00ff";
  target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_multi_stale_release_last", status: "pass",
    details: { released_last: true, previous_weak_alive: previousAlive,
      previous_finalized: previous.events.length,
      last_weak_alive: lastAlive, last_finalized: events.length,
      target_pixel: pixel,
      target_context_same: target.canvas.getContext("2d") === target.context } }];
}
return run();
