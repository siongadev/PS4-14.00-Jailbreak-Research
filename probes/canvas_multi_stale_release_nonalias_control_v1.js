// Release displaced wrappers that do not alias the selected live target.
// Keep the aliases rooted, and apply the same allocation pressure as the
// target-alias release probe.
async function run() {
  await api.mark("before_nonalias_scan");
  var state = window.__fw14MultiStale;
  if (!state || !state.stale || !state.fresh)
    return [{ id: "canvas_multi_stale_release_nonalias_control", status: "error",
      details: { error: "missing_multi_stale_state" } }];
  var bestIndex = -1;
  var aliases = [];
  for (var i = 0; i < state.fresh.length; i++) {
    var matches = [];
    for (var j = 0; j < state.stale.length; j++) {
      if (state.stale[j] && state.stale[j].canvas === state.fresh[i].canvas)
        matches.push(j);
    }
    if (matches.length > aliases.length) {
      bestIndex = i;
      aliases = matches;
    }
  }
  if (aliases.length < 2)
    return [{ id: "canvas_multi_stale_release_nonalias_control", status: "pass",
      details: { multi_alias_found: false, best_alias_count: aliases.length } }];
  var nonaliases = [];
  for (var k = 0; k < state.stale.length; k++)
    if (state.stale[k] && aliases.indexOf(k) < 0)
      nonaliases.push(k);
  var releaseCount = Math.min(aliases.length, nonaliases.length);
  if (releaseCount < 2)
    return [{ id: "canvas_multi_stale_release_nonalias_control", status: "error",
      details: { error: "insufficient_nonaliases", count: nonaliases.length } }];
  await api.mark("nonalias_scanned");
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak = [];
  for (var n = 0; n < releaseCount; n++) {
    (function (slot) {
      var wrapper = state.stale[slot];
      weak.push(new WeakRef(wrapper));
      registry.register(wrapper, "nonalias_" + slot);
      state.stale[slot] = null;
    })(nonaliases[n]);
  }
  var target = state.fresh[bestIndex];
  window.__fw14NonaliasGc = { target: target, aliases: aliases,
    released: nonaliases.slice(0, releaseCount), weak: weak,
    registry: registry, events: events };
  await api.mark("nonalias_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "multi-stale-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("nonalias_gc_batch_" + batch);
  }
  var weakAlive = 0;
  for (var w = 0; w < weak.length; w++)
    if (weak[w].deref()) weakAlive++;
  target.context.fillStyle = "#00ff00";
  target.context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    target.context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_multi_stale_release_nonalias_control", status: "pass",
    details: { alias_count: aliases.length, released_count: releaseCount,
      remaining_alias_count: aliases.filter(function (slot) { return !!state.stale[slot]; }).length,
      finalized_count: events.length, weak_alive_count: weakAlive,
      target_pixel: pixel,
      target_context_same: target.canvas.getContext("2d") === target.context } }];
}
return run();
