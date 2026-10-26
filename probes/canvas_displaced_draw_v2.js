// Repeat displaced-wrapper drawing on a fresh canvas and compare the two
// wrappers' drawing state while alternating writes to the same bitmap.
async function run() {
  function color(context) {
    var data = context.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2], data[3]].map(function (n) {
      return ("0" + n.toString(16)).slice(-2);
    }).join("");
  }
  await api.mark("before_displaced_draw_v2");
  var normalCanvas = document.createElement("canvas");
  normalCanvas.width = 4;
  normalCanvas.height = 4;
  var normal = normalCanvas.getContext("2d");
  normal.fillStyle = "#ff0000";
  normal.fillRect(0, 0, 1, 1);
  var controlRed = color(normal) === "ff0000ff";
  if (!controlRed)
    return [{ id: "canvas_displaced_draw_repeat", status: "error",
      details: { error: "normal_pixel_control_failed" } }];
  await api.mark("draw_v2_control_ok");

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
  var history = window.__fw14DisplacedDrawHistory || [];
  if (window.__fw14DisplacedDraw)
    history.push(window.__fw14DisplacedDraw);
  history.push({ canvas: canvas, inner: inner, outer: outer });
  window.__fw14DisplacedDrawHistory = history;
  if (!mismatch)
    return [{ id: "canvas_displaced_draw_repeat", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  await api.mark("draw_v2_reentry_created");
  try {
    outer.fillStyle = "#ff0000";
    outer.fillRect(0, 0, 1, 1);
    var red = color(outer);
    var outerStyleBefore = outer.fillStyle;
    await api.mark("draw_v2_outer_red");

    inner.fillStyle = "#0000ff";
    inner.fillRect(0, 0, 1, 1);
    var blue = color(outer);
    var outerStyleSame = outer.fillStyle === outerStyleBefore;
    var innerStyleDiff = inner.fillStyle !== outer.fillStyle;
    await api.mark("draw_v2_inner_blue");

    outer.fillStyle = "#00ff00";
    outer.fillRect(0, 0, 1, 1);
    var green = color(outer);
    await api.mark("draw_v2_outer_green");

    inner.fillRect(0, 0, 1, 1);
    var blueAgain = color(outer);
    await api.mark("draw_v2_inner_again");
    return [{ id: "canvas_displaced_draw_repeat", status: "pass",
      details: { mismatch: mismatch, control_red: controlRed,
        red: red, blue: blue, green: green, blue_again: blueAgain,
        outer_style_same: outerStyleSame, inner_style_diff: innerStyleDiff } }];
  } catch (error) {
    return [{ id: "canvas_displaced_draw_repeat", status: "error",
      details: { error: String(error).slice(0, 160) } }];
  }
}
return run();
