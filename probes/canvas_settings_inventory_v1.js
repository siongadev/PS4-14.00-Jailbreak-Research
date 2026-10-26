// Observe which settings properties getContext reads on this browser build.
var names = ["alpha", "colorSpace", "desynchronized", "willReadFrequently",
  "antialias", "depth", "stencil", "premultipliedAlpha", "preserveDrawingBuffer",
  "powerPreference", "failIfMajorPerformanceCaveat", "xrCompatible"];
var values = { alpha: true, colorSpace: "srgb", desynchronized: false,
  willReadFrequently: false, antialias: true, depth: true, stencil: false,
  premultipliedAlpha: true, preserveDrawingBuffer: false,
  powerPreference: "default", failIfMajorPerformanceCaveat: false,
  xrCompatible: false };
var types = ["2d", "bitmaprenderer", "webgl", "webgl2"];
var checks = [];
for (var index = 0; index < types.length; index++) {
  var type = types[index];
  var canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  var reads = [];
  var settings = {};
  for (var nameIndex = 0; nameIndex < names.length; nameIndex++) {
    (function (name) {
      Object.defineProperty(settings, name, { enumerable: true, configurable: true,
        get: function () { reads.push(name); return values[name]; } });
    }(names[nameIndex]));
  }
  try {
    var context = canvas.getContext(type, settings);
    checks.push({ id: "canvas_" + type + "_settings", status: "pass",
      details: { context_present: !!context, property_reads: reads.length,
        read_names: reads.join(",").slice(0, 500) } });
  } catch (error) {
    checks.push({ id: "canvas_" + type + "_settings", status: "error",
      details: { property_reads: reads.length, read_names: reads.join(",").slice(0, 500),
        error: String(error).slice(0, 160) } });
  }
}
return checks;
