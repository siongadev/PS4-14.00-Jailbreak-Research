// Re-enter 2D context creation with bitmaprenderer while the options
// dictionary is converted. Retain both wrappers for identity-only checks.
if (!api || typeof api.mark !== "function" || typeof api.markSync !== "function")
  return [{ id: "canvas_cross_context_reentry", status: "error",
    details: { error: "marker_api_unavailable" } }];

return api.mark("before_canvas_cross_outer").then(function () {
  var canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  var inner = null;
  var outer = null;
  var getterCalls = 0;
  try {
    outer = canvas.getContext("2d", {
      get desynchronized() {
        getterCalls++;
        api.markSync("canvas_cross_getter_entered");
        inner = canvas.getContext("bitmaprenderer");
        return false;
      }
    });
    api.markSync("canvas_cross_outer_returned");
    window.__fw14CanvasCrossReentry = { canvas: canvas, inner: inner, outer: outer };
    var current2d = canvas.getContext("2d");
    var currentBitmap = canvas.getContext("bitmaprenderer");
    var invariantHeld = getterCalls === 1 && !!inner && !outer && currentBitmap === inner;
    return [{ id: "canvas_cross_context_reentry",
      status: invariantHeld ? "pass" : "fail",
      details: { getter_calls: getterCalls, inner_present: !!inner,
        outer_present: !!outer, current_is_inner: currentBitmap === inner,
        current_is_outer: current2d === outer, current_2d_present: !!current2d,
        current_bitmap_present: !!currentBitmap }
    }];
  } catch (error) {
    window.__fw14CanvasCrossReentry = { canvas: canvas, inner: inner, outer: outer };
    return [{ id: "canvas_cross_context_reentry", status: "error",
      details: { getter_calls: getterCalls, inner_present: !!inner,
        error: String(error).slice(0, 160) } }];
  }
});
