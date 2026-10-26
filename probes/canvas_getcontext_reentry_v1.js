// Adapted from WebKit's canvas-getContext-reentrant regression. Keep the inner
// wrapper reachable so this probe observes identity before any deliberate GC.
if (!api || typeof api.mark !== "function" || typeof api.markSync !== "function")
  return [{ id: "canvas_getcontext_reentry", status: "error",
    details: { error: "marker_api_unavailable" } }];

return api.mark("before_canvas_outer").then(function () {
  var canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  var inner = null;
  var outer = null;
  var getterCalls = 0;
  var entered = false;
  try {
    outer = canvas.getContext("2d", {
      get desynchronized() {
        getterCalls++;
        if (!entered) {
          entered = true;
          api.markSync("canvas_getter_entered");
          inner = canvas.getContext("2d");
        }
        return false;
      }
    });
    api.markSync("canvas_outer_returned");
    window.__fw14CanvasReentry = { canvas: canvas, inner: inner, outer: outer };
    var current = canvas.getContext("2d");
    var same = !!outer && outer === inner;
    return [{ id: "canvas_getcontext_reentry",
      status: same && current === outer ? "pass" : "fail",
      details: { getter_calls: getterCalls, inner_present: !!inner,
        outer_present: !!outer, same_wrappers: same,
        current_is_inner: current === inner, current_is_outer: current === outer }
    }];
  } catch (error) {
    window.__fw14CanvasReentry = { canvas: canvas, inner: inner, outer: outer };
    return [{ id: "canvas_getcontext_reentry", status: "error",
      details: { getter_calls: getterCalls, inner_present: !!inner,
        error: String(error).slice(0, 160) } }];
  }
});
