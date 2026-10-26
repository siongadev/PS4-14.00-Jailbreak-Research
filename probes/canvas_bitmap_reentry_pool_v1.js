// Repeated cross-type reentry leaves multiple displaced bitmap wrappers.
// Check whether a later same-type allocation changes an earlier wrapper's
// canvas identity, compared with ordinary bitmap context controls.
async function run() {
  await api.mark("before_bitmap_pool");
  var ordinary = [];
  for (var i = 0; i < 16; i++) {
    var normalCanvas = document.createElement("canvas");
    var normalContext = normalCanvas.getContext("bitmaprenderer");
    if (!normalContext || normalContext.canvas !== normalCanvas)
      return [{ id: "canvas_bitmap_reentry_pool", status: "error",
        details: { error: "ordinary_bitmap_control_failed", index: i } }];
    ordinary.push({ canvas: normalCanvas, context: normalContext });
  }
  await api.mark("bitmap_pool_control_ok");
  var pool = [];
  window.__fw14BitmapReentryPool = { ordinary: ordinary, pool: pool };
  var firstChanged = -1;
  var firstTarget = -1;
  var changedCount = 0;
  for (var batch = 1; batch <= 4; batch++) {
    for (var j = 0; j < 16; j++) {
      var canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      var inner = null;
      var outer = canvas.getContext("2d", {
        get desynchronized() {
          inner = canvas.getContext("bitmaprenderer");
          return false;
        }
      });
      if (!inner || !outer || canvas.getContext("2d") !== outer ||
          canvas.getContext("bitmaprenderer") !== null)
        return [{ id: "canvas_bitmap_reentry_pool", status: "error",
          details: { error: "context_replacement_not_seen", batch: batch, item: j } }];
      pool.push({ canvas: canvas, inner: inner, outer: outer });
    }
    changedCount = 0;
    for (var k = 0; k < pool.length; k++) {
      var observed = pool[k].inner.canvas;
      if (observed !== pool[k].canvas) {
        changedCount++;
        if (firstChanged < 0) {
          firstChanged = k;
          firstTarget = pool.findIndex(function (item) {
            return item.canvas === observed;
          });
        }
      }
    }
    await api.mark("bitmap_pool_batch_" + batch);
    if (changedCount > 0)
      break;
  }
  return [{ id: "canvas_bitmap_reentry_pool", status: "pass",
    details: { ordinary_count: ordinary.length, reentry_count: pool.length,
      changed_count: changedCount, first_changed: firstChanged,
      first_target: firstTarget, cross_alias: firstTarget >= 0 } }];
}
return run();
