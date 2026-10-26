// Test whether an ordinary canvas context wrapper can be collected when the
// canvas and context leave scope; use the same allocation schedule as v2.
async function run() {
  await api.mark("before_unrooted_control");
  var state = { finalized: false };
  var registry = new FinalizationRegistry(function () { state.finalized = true; });
  function makeNormal() {
    var canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    var context = canvas.getContext("2d");
    var weak = new WeakRef(context);
    registry.register(context, "ordinary_canvas_context");
    return { weak: weak, context_present: !!context };
  }
  var target = makeNormal();
  window.__fw14UnrootedCanvasControl = { weak: target.weak,
    registry: registry, state: state };
  await api.mark("unrooted_control_created");
  for (var batch = 1; batch <= 5; batch++) {
    var debris = [];
    for (var i = 0; i < 10000; i++)
      debris.push({ number: i, label: "abc" });
    debris = null;
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    await api.mark("unrooted_control_batch_" + batch);
  }
  await new Promise(function (resolve) { setTimeout(resolve, 50); });
  return [{ id: "canvas_unrooted_gc_control", status: target.context_present ? "pass" : "fail",
    details: { context_present: target.context_present,
      context_weak_alive: !!target.weak.deref(), context_finalized: state.finalized,
      batches: 5, objects_per_batch: 10000 } }];
}
return run();
