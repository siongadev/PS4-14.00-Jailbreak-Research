// The prior same-type reentry probe retained its inner wrapper in this page.
// Compare one ordinary context call with one call through that wrapper.
if (!api || typeof api.mark !== "function" || typeof api.markSync !== "function")
  return [{ id: "canvas_displaced_wrapper_call", status: "error",
    details: { error: "marker_api_unavailable" } }];

return api.mark("before_displaced_control").then(function () {
  var retained = window.__fw14CanvasReentry;
  if (!retained || !retained.inner || !retained.outer ||
      retained.inner === retained.outer ||
      retained.canvas.getContext("2d") !== retained.outer)
    return [{ id: "canvas_displaced_wrapper_call", status: "error",
      details: { error: "reentry_state_unavailable" } }];

  var normalCanvas = document.createElement("canvas");
  normalCanvas.width = 16;
  normalCanvas.height = 16;
  var normal = normalCanvas.getContext("2d");
  if (!normal || typeof normal.fillRect !== "function" ||
      typeof retained.inner.fillRect !== "function")
    return [{ id: "canvas_displaced_wrapper_call", status: "error",
      details: { error: "fill_rect_unavailable" } }];
  try {
    normal.fillRect(0, 0, 1, 1);
    api.markSync("normal_canvas_call_returned");
    api.markSync("before_displaced_call");
    retained.inner.fillRect(0, 0, 1, 1);
    api.markSync("displaced_call_returned");
    return [{ id: "canvas_displaced_wrapper_call", status: "pass",
      details: { normal_returned: true, displaced_returned: true } }];
  } catch (error) {
    return [{ id: "canvas_displaced_wrapper_call", status: "error",
      details: { error: String(error).slice(0, 160) } }];
  }
});
