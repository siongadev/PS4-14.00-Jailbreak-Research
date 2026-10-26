// Observe whether a displaced 2D wrapper can change the canvas bitmap after
// the outer context becomes the canvas's current context.
async function run() {
  await api.mark("before_displaced_draw_control");
  var normalCanvas = document.createElement("canvas");
  normalCanvas.width = 4;
  normalCanvas.height = 4;
  var normal = normalCanvas.getContext("2d");
  normal.fillStyle = "#ff0000";
  normal.fillRect(0, 0, 1, 1);
  var normalPixel = normal.getImageData(0, 0, 1, 1).data;
  var controlRed = normalPixel[0] === 255 && normalPixel[1] === 0 &&
    normalPixel[2] === 0 && normalPixel[3] === 255;
  if (!controlRed)
    return [{ id: "canvas_displaced_draw", status: "error",
      details: { error: "normal_pixel_control_failed" } }];
  await api.mark("displaced_draw_control_ok");

  var canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  var inner = null;
  var outer = canvas.getContext("2d", {
    get desynchronized() {
      inner = canvas.getContext("2d");
      return false;
    }
  });
  var mismatch = !!inner && !!outer && inner !== outer &&
    canvas.getContext("2d") === outer;
  window.__fw14DisplacedDraw = { canvas: canvas, inner: inner, outer: outer };
  if (!mismatch)
    return [{ id: "canvas_displaced_draw", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  outer.fillStyle = "#ff0000";
  outer.fillRect(0, 0, 1, 1);
  var before = outer.getImageData(0, 0, 1, 1).data;
  await api.mark("displaced_draw_reentry_ok");

  try {
    await api.mark("before_displaced_color");
    inner.fillStyle = "#0000ff";
    await api.mark("displaced_color_set");
    inner.fillRect(0, 0, 1, 1);
    await api.mark("displaced_fill_returned");
    var after = outer.getImageData(0, 0, 1, 1).data;
    await api.mark("displaced_pixel_read");
    return [{ id: "canvas_displaced_draw", status: "pass",
      details: { mismatch: mismatch, control_red: controlRed,
        before_r: before[0], before_g: before[1], before_b: before[2],
        after_r: after[0], after_g: after[1], after_b: after[2],
        after_a: after[3] } }];
  } catch (error) {
    return [{ id: "canvas_displaced_draw", status: "error",
      details: { error: String(error).slice(0, 160) } }];
  }
}
return run();
