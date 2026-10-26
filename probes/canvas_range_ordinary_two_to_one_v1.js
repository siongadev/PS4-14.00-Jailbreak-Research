// Matched ordinary-canvas control for releasing one of two DOM Range roots.
async function run() {
  await api.mark("before_ordinary_range");
  var canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  var context = canvas.getContext("2d");
  var retained = document.createRange();
  retained.selectNodeContents(canvas);
  var released = document.createRange();
  released.selectNodeContents(canvas);
  if (retained.startContainer !== canvas || released.startContainer !== canvas)
    return [{ id: "canvas_range_ordinary_two_to_one", status: "error",
      details: { error: "range_did_not_bind" } }];
  var events = [];
  var registry = new FinalizationRegistry(function (label) { events.push(label); });
  var weak = new WeakRef(released);
  registry.register(released, "ordinary_range");
  window.__fw14OrdinaryRange = { canvas: canvas, context: context,
    retained: retained, weak: weak, registry: registry, events: events };
  released = null;
  await api.mark("ordinary_range_released");
  for (var batch = 1; batch <= 5; batch++) {
    var pressure = [];
    for (var p = 0; p < 10000; p++)
      pressure.push({ batch: batch, index: p, text: "range-drop-" + p });
    pressure = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("ordinary_gc_batch_" + batch);
  }
  await api.mark("before_ordinary_check");
  context.fillStyle = "#00ff00";
  context.fillRect(0, 0, 1, 1);
  var pixel = Array.prototype.join.call(
    context.getImageData(0, 0, 1, 1).data, ",");
  return [{ id: "canvas_range_ordinary_two_to_one", status: "pass",
    details: { retained_bound: retained.startContainer === canvas &&
        retained.endContainer === canvas,
      released_weak_alive: !!weak.deref(),
      released_finalized_count: events.length,
      target_pixel: pixel, target_context_same: canvas.getContext("2d") === context } }];
}
return run();
