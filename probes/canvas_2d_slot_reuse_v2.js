// Allocate new 2D contexts after a same-type reentry replaces the inner one.
// Read the displaced wrapper's canvas relation after each allocation batch.
async function run() {
  await api.mark("before_2d_reuse");
  var original = document.createElement("canvas");
  original.width = 16;
  original.height = 16;
  var inner = null;
  var outer = original.getContext("2d", {
    get desynchronized() {
      inner = original.getContext("2d");
      return false;
    }
  });
  if (!inner || !outer || inner === outer || original.getContext("2d") !== outer)
    return [{ id: "canvas_2d_slot_reuse", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  var held = [];
  window.__fw14Canvas2dReuse = { original: original, inner: inner,
    outer: outer, held: held };
  await api.mark("canvas_2d_reuse_created");
  var firstChanged = -1;
  var firstAlias = -1;
  var observed = inner.canvas;
  for (var batch = 1; batch <= 4; batch++) {
    for (var i = 0; i < 64; i++) {
      var canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      var context = canvas.getContext("2d");
      if (!context || context.canvas !== canvas)
        return [{ id: "canvas_2d_slot_reuse", status: "error",
          details: { error: "ordinary_2d_context_failed", batch: batch, item: i } }];
      held.push({ canvas: canvas, context: context });
    }
    observed = inner.canvas;
    if (observed !== original && firstChanged < 0) {
      firstChanged = held.length;
      firstAlias = held.findIndex(function (item) { return item.canvas === observed; });
    }
    await api.mark("canvas_2d_reuse_batch_" + batch);
    if (firstChanged >= 0)
      break;
  }
  return [{ id: "canvas_2d_slot_reuse", status: "pass",
    details: { created_count: held.length, observed_is_original: observed === original,
      first_changed_after: firstChanged, alias_index: firstAlias,
      cross_alias: firstAlias >= 0 } }];
}
return run();

