// Fresh-page same-type reentry followed by a small matched allocation pool.
async function run() {
  await api.mark("before_2d_small");
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
    return [{ id: "canvas_2d_slot_reuse_small", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  await api.mark("small_reentry_created");
  var held = [];
  window.__fw14Canvas2dSmall = { original: original, inner: inner,
    outer: outer, held: held };
  var changedAt = -1;
  var aliasIndex = -1;
  for (var i = 0; i < 32; i++) {
    var canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    var context = canvas.getContext("2d");
    if (!context || context.canvas !== canvas)
      return [{ id: "canvas_2d_slot_reuse_small", status: "error",
        details: { error: "ordinary_2d_context_failed", index: i } }];
    held.push({ canvas: canvas, context: context });
    if (inner.canvas !== original) {
      changedAt = i + 1;
      aliasIndex = held.findIndex(function (item) {
        return item.canvas === inner.canvas;
      });
      break;
    }
    if (i === 7 || i === 15 || i === 31)
      await api.mark("small_batch_" + (i + 1));
  }
  return [{ id: "canvas_2d_slot_reuse_small", status: "pass",
    details: { created_count: held.length, observed_is_original: inner.canvas === original,
      changed_after: changedAt, alias_index: aliasIndex,
      cross_alias: aliasIndex >= 0 } }];
}
return run();
