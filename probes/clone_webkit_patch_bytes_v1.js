// Exact data bytes from WebKit's January 2024 structured-clone regression test:
// https://github.com/WebKit/WebKit/commit/010c6bdfb0cde0485d31f0260ab9a046fa9b8567.patch
// The source is public upstream WebKit, independent of the old PS4 project.
var feature = { id: "feature_control", status: "pass", details: {} };
if (typeof structuredClone !== "function" || typeof DOMPoint !== "function") {
  feature.status = "unsupported";
  feature.details.reason = "structuredClone_or_DOMPoint_missing";
}
if (feature.status === "pass") {
  try {
    var pointCopy = structuredClone(new DOMPoint(1, 2));
    feature.details.point_type = Object.prototype.toString.call(pointCopy).slice(0, 80);
    feature.details.point_x = pointCopy.x;
    feature.status = pointCopy.x === 1 && pointCopy.y === 2 ? "pass" : "fail";
  } catch (error) {
    feature.status = "error";
    feature.details.error = String(error).slice(0, 200);
  }
}

function runCase(id, useBigInt) {
  var phase = "build";
  try {
    var input = new Array(0x102);
    var shared = {};
    input[0] = shared;
    for (var i = 1; i < 0xff; i += 1) input[i] = useBigInt ? BigInt(1) : 1;
    input[0xff] = shared;
    input[0x100] = new DOMPoint(2.08e-322);
    var bytes = new Uint8Array(85);
    bytes.set([0x37, 0x13, 0x00, 0x00, 0x10, 0x06, 0x00, 0x00, 0x80,
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x21,
      0xff, 0xff, 0xff, 0xff], 66);
    input[0x101] = bytes;
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("bigint_bytes_ready");
    phase = "clone";
    var output = structuredClone(input);
    if (useBigInt && api && typeof api.markSync === "function") api.markSync("bigint_bytes_loaded");
    phase = "inspect";
    var alias = output[0] === output[0xff];
    var length = typeof output.length === "number" ? output.length : null;
    var pointType = output[0x100] === null ? "null" : typeof output[0x100];
    var viewLength = output[0x101] && typeof output[0x101].byteLength === "number" ?
      output[0x101].byteLength : null;
    var viewMarker = viewLength !== null ? output[0x101][66] : null;
    var correct = Array.isArray(output) && length === input.length && alias &&
      output[0] && typeof output[0] === "object" && viewLength === 85 && viewMarker === 0x37;
    return { id: id, status: correct ? "pass" : "fail", details: {
      input_length: input.length, output_length: length,
      output_alias: alias, slot0_type: typeof output[0],
      slot255_type: typeof output[0xff],
      point_type: pointType, view_length: viewLength, view_marker: viewMarker
    } };
  } catch (error) {
    return { id: id, status: "error", details: {
      phase: phase, error: String(error).slice(0, 300)
    } };
  }
}

if (feature.status !== "pass") {
  return [feature,
    { id: "number_shape_control", status: "unsupported", details: { reason: "feature_control_failed" } },
    { id: "bigint_published_bytes", status: "unsupported", details: { reason: "feature_control_failed" } }];
}
var numberControl = runCase("number_shape_control", false);
if (numberControl.status !== "pass") {
  return [feature, numberControl,
    { id: "bigint_published_bytes", status: "unsupported", details: { reason: "number_control_failed" } }];
}
return [feature, numberControl, runCase("bigint_published_bytes", true)];
