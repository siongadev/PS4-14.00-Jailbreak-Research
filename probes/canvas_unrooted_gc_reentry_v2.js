// Re-enter 2D context construction, then release both context wrappers and
// canvas while observing only a weak reference to the displaced wrapper.
async function run() {
  await api.mark("before_unrooted_reentry");
  var state = { finalized: false };
  var registry = new FinalizationRegistry(function () { state.finalized = true; });
  function makeDisplaced() {
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
    registry.register(inner, "displaced_canvas_context");
    return { weak: weak, mismatch: mismatch };
  }
  var target = makeDisplaced();
  window.__fw14UnrootedCanvasReentry = { weak: target.weak,
    registry: registry, state: state };
  if (!target.mismatch)
    return [{ id: "canvas_unrooted_gc_reentry", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  await api.mark("unrooted_reentry_created");
  for (var batch = 1; batch <= 5; batch++) {
    var debris = [];
    for (var i = 0; i < 10000; i++)
      debris.push({ number: i, label: "abc" });
    debris = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("unrooted_reentry_batch_" + batch);
  }
  await new Promise(function (resolve) { setTimeout(resolve, 50); });
  return [{ id: "canvas_unrooted_gc_reentry", status: "pass",
    details: { mismatch: target.mismatch,
      displaced_weak_alive: !!target.weak.deref(),
      displaced_finalized: state.finalized,
      batches: 5, objects_per_batch: 10000 } }];
}
return run();
