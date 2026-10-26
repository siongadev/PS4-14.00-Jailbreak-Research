// Track stale and current 2D context styles across alternating bitmap writes.
async function run() {
  function color(context) {
    var data = context.getImageData(0, 0, 1, 1).data;
    return [data[0], data[1], data[2], data[3]].map(function (n) {
      return ("0" + n.toString(16)).slice(-2);
    }).join("");
  }
  await api.mark("before_draw_state_v3");
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
  window.__fw14DrawStateV3 = { canvas: canvas, inner: inner, outer: outer };
  if (!mismatch)
    return [{ id: "canvas_displaced_draw_state", status: "error",
      details: { error: "context_replacement_not_seen" } }];
  await api.mark("draw_state_v3_created");
  try {
    outer.fillStyle = "#ff0000";
    outer.fillRect(0, 0, 1, 1);
    var red = color(outer);
    await api.mark("draw_state_outer_red");

    inner.fillStyle = "#0000ff";
    inner.fillRect(0, 0, 1, 1);
    var firstBlue = color(outer);
    await api.mark("draw_state_inner_blue");

    outer.fillStyle = "#00ff00";
    outer.fillRect(0, 0, 1, 1);
    var green = color(outer);
    var innerStyleAfterGreen = String(inner.fillStyle);
    var outerStyleAfterGreen = String(outer.fillStyle);
    await api.mark("draw_state_outer_green");

    inner.fillStyle = "#ff00ff";
    inner.fillRect(0, 0, 1, 1);
    var magentaAttempt = color(outer);
    await api.mark("draw_state_inner_magenta");

    outer.fillStyle = "#ff0000";
    outer.fillRect(0, 0, 1, 1);
    var finalRed = color(outer);
    await api.mark("draw_state_final_red");
    return [{ id: "canvas_displaced_draw_state", status: "pass",
      details: { mismatch: mismatch, red: red, first_blue: firstBlue,
        green: green, magenta_attempt: magentaAttempt, final_red: finalRed,
        inner_style_after_green: innerStyleAfterGreen,
        outer_style_after_green: outerStyleAfterGreen } }];
  } catch (error) {
    return [{ id: "canvas_displaced_draw_state", status: "error",
      details: { error: String(error).slice(0, 160) } }];
  }
}
return run();
