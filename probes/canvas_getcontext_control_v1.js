// Establish that this browser converts 2D settings through a JS getter.
if (!document || typeof document.createElement !== "function")
  return [{ id: "canvas_getcontext_control", status: "unsupported", details: {} }];

var canvas = document.createElement("canvas");
canvas.width = 16;
canvas.height = 16;
var alphaCalls = 0;
var colorCalls = 0;
try {
  var context = canvas.getContext("2d", {
    get alpha() { alphaCalls++; return true; },
    get colorSpace() { colorCalls++; return "srgb"; }
  });
  var repeated = canvas.getContext("2d");
  return [{
    id: "canvas_getcontext_control",
    status: context && repeated === context && (alphaCalls + colorCalls) > 0 ? "pass" : "fail",
    details: { context_present: !!context, same_on_repeat: repeated === context,
      alpha_getter_calls: alphaCalls, color_getter_calls: colorCalls }
  }];
} catch (error) {
  return [{ id: "canvas_getcontext_control", status: "error",
    details: { error: String(error).slice(0, 160) } }];
}
