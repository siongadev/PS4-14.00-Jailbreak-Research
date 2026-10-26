// Allocate and retain 512 ordinary bitmaprenderer contexts with no reentry.
async function run() {
  await api.mark("before_bitmap_spray_control");
  var held = [];
  window.__fw14BitmapSprayControl = held;
  var allCanvasPropertiesOk = true;
  for (var batch = 1; batch <= 4; batch++) {
    for (var i = 0; i < 128; i++) {
      var canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      var context = canvas.getContext("bitmaprenderer");
      if (!context)
        return [{ id: "canvas_bitmap_spray_control", status: "error",
          details: { error: "context_unavailable", batch: batch, item: i } }];
      allCanvasPropertiesOk = allCanvasPropertiesOk && context.canvas === canvas;
      held.push({ canvas: canvas, context: context });
    }
    await api.mark("bitmap_spray_control_batch_" + batch);
  }
  return [{ id: "canvas_bitmap_spray_control",
    status: allCanvasPropertiesOk && held.length === 512 ? "pass" : "fail",
    details: { created_count: held.length,
      all_canvas_properties_ok: allCanvasPropertiesOk } }];
}
return run();
