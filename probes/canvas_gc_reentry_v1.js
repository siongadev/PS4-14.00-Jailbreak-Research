// Release a wrapper displaced by 2D getContext reentry, then apply the same
// bounded allocation schedule as canvas_gc_pressure_control_v1.
if (!api || typeof api.mark !== "function")
  return [{ id: "canvas_gc_reentry", status: "error",
    details: { error: "marker_api_unavailable" } }];

async function run() {
  await api.mark("before_gc_reentry");
  var state = { finalized: false };
  var registry = new FinalizationRegistry(function () { state.finalized = true; });
  function createDisplaced() {
    var canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    var inner = null;
    var outer = canvas.getContext("2d", {
      get desynchronized() {
        inner = canvas.getContext("2d");
        return false;
      }
    });
    var mismatch = !!inner && !!outer && inner !== outer &&
      canvas.getContext("2d") === outer;
    var weak = new WeakRef(inner);
    registry.register(inner, "displaced");
    inner = null;
    return { canvas: canvas, outer: outer, weak: weak, mismatch: mismatch };
  }
  var held = createDisplaced();
  window.__fw14CanvasGcReentry = { canvas: held.canvas, outer: held.outer,
    weak: held.weak, registry: registry, state: state };
  if (!held.mismatch)
    return [{ id: "canvas_gc_reentry", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  await api.mark("gc_reentry_created");
  for (var batch = 1; batch <= 5; batch++) {
    var debris = [];
    for (var i = 0; i < 10000; i++)
      debris.push({ number: i, label: "abc" });
    debris = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("gc_reentry_batch_" + batch);
  }
  await new Promise(function (resolve) { setTimeout(resolve, 50); });
  return [{ id: "canvas_gc_reentry", status: "pass",
    details: { mismatch: held.mismatch, displaced_weak_alive: !!held.weak.deref(),
      displaced_finalized: state.finalized, batches: 5, objects_per_batch: 10000 } }];
}
return run();
