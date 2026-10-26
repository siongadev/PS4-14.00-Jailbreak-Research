// Test whether a JS wrapper for a displaced bitmap context observes a fresh
// bitmap context after native same-type allocations reuse the freed slot.
async function run() {
  await api.mark("before_bitmap_slot_control");
  var normalCanvas = document.createElement("canvas");
  var normal = normalCanvas.getContext("bitmaprenderer");
  var normalCanvasOk = !!normal && normal.canvas === normalCanvas;
  if (!normalCanvasOk)
    return [{ id: "canvas_bitmap_slot_reuse", status: "error",
      details: { error: "bitmap_canvas_control_failed" } }];
  await api.mark("bitmap_slot_control_ok");

  var original = document.createElement("canvas");
  original.width = 16;
  original.height = 16;
  var inner = null;
  var outer = original.getContext("2d", {
    get desynchronized() {
      inner = original.getContext("bitmaprenderer");
      return false;
    }
  });
  var mismatch = !!inner && !!outer && original.getContext("2d") === outer &&
    original.getContext("bitmaprenderer") === null;
  window.__fw14CanvasBitmapSlot = { original: original, inner: inner,
    outer: outer, spray: [] };
  if (!mismatch)
    return [{ id: "canvas_bitmap_slot_reuse", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  await api.mark("bitmap_slot_reentry_created");
  var initial;
  try {
    initial = inner.canvas;
  } catch (error) {
    return [{ id: "canvas_bitmap_slot_reuse", status: "error",
      details: { error: String(error).slice(0, 160), step: "initial_read" } }];
  }
  await api.mark("bitmap_slot_initial_read");

  var aliasIndex = -1;
  var lastObserved = initial;
  for (var batch = 1; batch <= 4; batch++) {
    for (var i = 0; i < 16; i++) {
      var canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      var context = canvas.getContext("bitmaprenderer");
      if (!context)
        return [{ id: "canvas_bitmap_slot_reuse", status: "error",
          details: { error: "spray_context_unavailable", batch: batch, item: i } }];
      window.__fw14CanvasBitmapSlot.spray.push({ canvas: canvas, context: context });
    }
    try {
      lastObserved = inner.canvas;
    } catch (error) {
      return [{ id: "canvas_bitmap_slot_reuse", status: "error",
        details: { error: String(error).slice(0, 160), step: "spray_read",
          batch: batch } }];
    }
    aliasIndex = window.__fw14CanvasBitmapSlot.spray.findIndex(function (item) {
      return item.canvas === lastObserved;
    });
    await api.mark("bitmap_slot_batch_" + batch);
    if (aliasIndex >= 0 || lastObserved !== original)
      break;
  }
  return [{ id: "canvas_bitmap_slot_reuse", status: "pass",
    details: { normal_canvas_ok: normalCanvasOk, mismatch: mismatch,
      initial_is_original: initial === original,
      observed_is_original: lastObserved === original,
      alias_found: aliasIndex >= 0, alias_index: aliasIndex,
      created_count: window.__fw14CanvasBitmapSlot.spray.length } }];
}
return run();
