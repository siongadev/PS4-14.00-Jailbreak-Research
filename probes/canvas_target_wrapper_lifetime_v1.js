// Compare canvas-wrapper reachability after stale-wrapper finalization, with
// an ordinary 2D context retained under the same JavaScript conditions.
async function run() {
  var alias = window.__fw14CanvasAliasGc;
  if (!alias || !alias.target || !alias.target.canvas || !alias.target.context ||
      alias.events.indexOf("stale_wrapper") < 0)
    return [{ id: "canvas_target_wrapper_lifetime", status: "error",
      details: { error: "missing_finalized_alias_state" } }];
  await api.mark("before_target_release");
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weakTarget;
  var targetContext = alias.target.context;
  (function () {
    var canvas = alias.target.canvas;
    weakTarget = new WeakRef(canvas);
    registry.register(canvas, "target_canvas");
    alias.target.canvas = null;
  })();
  var weakControl;
  var controlContext;
  (function () {
    var canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    controlContext = canvas.getContext("2d");
    weakControl = new WeakRef(canvas);
    registry.register(canvas, "control_canvas");
  })();
  window.__fw14CanvasLifetime = { targetContext: targetContext,
    controlContext: controlContext, weakTarget: weakTarget,
    weakControl: weakControl, registry: registry, events: events };
  await api.mark("target_canvas_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var i = 0; i < 10000; i++)
      pressure.push({ batch: batch, index: i, text: "lifetime-" + i });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("target_gc_batch_" + batch);
  }
  var targetWeakAlive = !!weakTarget.deref();
  var controlWeakAlive = !!weakControl.deref();
  await api.mark("before_context_access");
  targetContext.fillStyle = "#00ffff";
  targetContext.fillRect(0, 0, 1, 1);
  controlContext.fillStyle = "#00ffff";
  controlContext.fillRect(0, 0, 1, 1);
  var targetPixel = Array.prototype.join.call(
    targetContext.getImageData(0, 0, 1, 1).data, ",");
  var controlPixel = Array.prototype.join.call(
    controlContext.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_target_wrapper_lifetime", status: "pass",
    details: { target_weak_alive: targetWeakAlive,
      control_weak_alive: controlWeakAlive,
      target_finalized: events.indexOf("target_canvas") >= 0,
      control_finalized: events.indexOf("control_canvas") >= 0,
      target_pixel: targetPixel, control_pixel: controlPixel,
      target_canvas_returned: !!targetContext.canvas,
      control_canvas_returned: !!controlContext.canvas } }];
}
return run();
