// Release a stale wrapper and the distinct current wrapper that now point at
// one native 2D context; retain its canvas and compare an ordinary control.
async function run() {
  var state = window.__fw14MultiStale;
  if (!state || !state.stale || !state.fresh)
    return [{ id: "canvas_alias_double_release", status: "error",
      details: { error: "missing_multi_stale_state" } }];
  var targetIndex = -1;
  var staleIndex = -1;
  for (var i = 0; i < state.fresh.length && targetIndex < 0; i++) {
    for (var j = 0; j < state.stale.length; j++) {
      if (state.stale[j] && state.stale[j].canvas === state.fresh[i].canvas) {
        targetIndex = i;
        staleIndex = j;
        break;
      }
    }
  }
  if (targetIndex < 0)
    return [{ id: "canvas_alias_double_release", status: "pass",
      details: { alias_found: false } }];
  await api.mark("before_alias_double_drop");
  var targetCanvas = state.fresh[targetIndex].canvas;
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weakStale;
  var weakTargetContext;
  (function () {
    var stale = state.stale[staleIndex];
    var current = state.fresh[targetIndex].context;
    weakStale = new WeakRef(stale);
    weakTargetContext = new WeakRef(current);
    registry.register(stale, "stale");
    registry.register(current, "target_context");
    state.stale[staleIndex] = null;
    state.fresh[targetIndex].context = null;
  })();
  var controlCanvas = document.createElement("canvas");
  controlCanvas.width = 4;
  controlCanvas.height = 4;
  var weakControlContext;
  (function () {
    var ordinary = controlCanvas.getContext("2d");
    weakControlContext = new WeakRef(ordinary);
    registry.register(ordinary, "control_context");
  })();
  window.__fw14AliasDoubleRelease = { targetCanvas: targetCanvas,
    controlCanvas: controlCanvas, weakStale: weakStale,
    weakTargetContext: weakTargetContext, weakControlContext: weakControlContext,
    registry: registry, events: events };
  await api.mark("alias_double_dropped");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "double-drop-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("double_gc_batch_" + batch);
  }
  var staleDead = !weakStale.deref();
  var targetDead = !weakTargetContext.deref();
  var controlDead = !weakControlContext.deref();
  await api.mark("before_double_canvas_check");
  var targetContext = targetCanvas.getContext("2d");
  var controlContext = controlCanvas.getContext("2d");
  targetContext.fillStyle = "#0000ff";
  targetContext.fillRect(0, 0, 1, 1);
  controlContext.fillStyle = "#0000ff";
  controlContext.fillRect(0, 0, 1, 1);
  var targetPixel = Array.prototype.join.call(
    targetContext.getImageData(0, 0, 1, 1).data, ",");
  var controlPixel = Array.prototype.join.call(
    controlContext.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_alias_double_release", status: "pass",
    details: { alias_found: true, target_index: targetIndex,
      stale_index: staleIndex, stale_dead: staleDead,
      target_context_dead: targetDead, control_context_dead: controlDead,
      stale_finalized: events.indexOf("stale") >= 0,
      target_finalized: events.indexOf("target_context") >= 0,
      control_finalized: events.indexOf("control_context") >= 0,
      target_pixel: targetPixel, control_pixel: controlPixel } }];
}
return run();
