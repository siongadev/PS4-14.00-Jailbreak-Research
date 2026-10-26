// Matching allocation schedule without a reentrant context replacement.
if (!api || typeof api.mark !== "function")
  return [{ id: "canvas_gc_pressure_control", status: "error",
    details: { error: "marker_api_unavailable" } }];

async function run() {
  await api.mark("before_gc_control");
  var canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  var context = canvas.getContext("2d");
  var state = { finalized: false };
  var registry = new FinalizationRegistry(function () { state.finalized = true; });
  var ordinary = { marker: "ordinary" };
  var weak = new WeakRef(ordinary);
  registry.register(ordinary, "ordinary");
  ordinary = null;
  window.__fw14CanvasGcControl = { canvas: canvas, context: context,
    weak: weak, registry: registry, state: state };
  await api.mark("gc_control_created");
  for (var batch = 1; batch <= 5; batch++) {
    var debris = [];
    for (var i = 0; i < 10000; i++)
      debris.push({ number: i, label: "abc" });
    debris = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("gc_control_batch_" + batch);
  }
  await new Promise(function (resolve) { setTimeout(resolve, 50); });
  return [{ id: "canvas_gc_pressure_control", status: context ? "pass" : "fail",
    details: { context_present: !!context, ordinary_weak_alive: !!weak.deref(),
      ordinary_finalized: state.finalized, batches: 5, objects_per_batch: 10000 } }];
}
return run();
