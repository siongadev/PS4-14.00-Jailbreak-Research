// Retain a displaced bitmap JS wrapper, then allocate up to 512 fresh bitmap
// contexts and check whether the displaced wrapper aliases a new canvas.
async function run() {
  await api.mark("before_bitmap_reuse_512");
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
  window.__fw14BitmapReuse512 = { original: original,
    inner: inner, outer: outer, spray: [] };
  if (!mismatch)
    return [{ id: "canvas_bitmap_slot_reuse_512", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  await api.mark("bitmap_reuse_512_created");
  var initial;
  try { initial = inner.canvas; }
  catch (error) {
    return [{ id: "canvas_bitmap_slot_reuse_512", status: "error",
      details: { step: "initial_read", error: String(error).slice(0, 160) } }];
  }
  await api.mark("bitmap_reuse_512_initial");

  var observed = initial;
  var aliasIndex = -1;
  var held = window.__fw14BitmapReuse512.spray;
  for (var batch = 1; batch <= 4; batch++) {
    for (var i = 0; i < 128; i++) {
      var canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      var context = canvas.getContext("bitmaprenderer");
      if (!context)
        return [{ id: "canvas_bitmap_slot_reuse_512", status: "error",
          details: { error: "spray_context_unavailable", batch: batch, item: i } }];
      held.push({ canvas: canvas, context: context });
    }
    try { observed = inner.canvas; }
    catch (error) {
      return [{ id: "canvas_bitmap_slot_reuse_512", status: "error",
        details: { step: "spray_read", batch: batch,
          error: String(error).slice(0, 160) } }];
    }
    aliasIndex = held.findIndex(function (item) { return item.canvas === observed; });
    await api.mark("bitmap_reuse_512_batch_" + batch);
    if (aliasIndex >= 0 || observed !== original)
      break;
  }
  return [{ id: "canvas_bitmap_slot_reuse_512", status: "pass",
    details: { mismatch: mismatch, initial_is_original: initial === original,
      observed_is_original: observed === original, alias_found: aliasIndex >= 0,
      alias_index: aliasIndex, created_count: held.length } }];
}
return run();
