// Capability gate for a source-guided, resizable-buffer clone follow-up.
var feature;
var roundTrip;
try {
  var buffer = new ArrayBuffer(8, { maxByteLength: 32 });
  var supported = buffer.resizable === true &&
    buffer.maxByteLength === 32 && typeof buffer.resize === "function";
  feature = { id: "resizable_arraybuffer_feature", status: supported ? "pass" : "unsupported", details: {
    resizable: buffer.resizable === true,
    max_byte_length: typeof buffer.maxByteLength === "number" ? buffer.maxByteLength : null,
    resize_method: typeof buffer.resize
  } };
  if (!supported) {
    roundTrip = { id: "resizable_clone_control", status: "unsupported", details: { reason: "feature_absent" } };
  } else {
    var view = new Uint8Array(buffer, 2, 3);
    view[0] = 0x41;
    view[1] = 0x42;
    view[2] = 0x43;
    var copy = structuredClone({ buffer: buffer, view: view });
    var ok = copy.buffer.resizable === true && copy.buffer.maxByteLength === 32 &&
      copy.view.buffer === copy.buffer && copy.view.byteOffset === 2 &&
      copy.view.length === 3 && copy.view[0] === 0x41 && copy.view[2] === 0x43;
    roundTrip = { id: "resizable_clone_control", status: ok ? "pass" : "fail", details: {
      cloned_resizable: copy.buffer.resizable === true,
      cloned_max_byte_length: copy.buffer.maxByteLength,
      same_cloned_buffer: copy.view.buffer === copy.buffer,
      cloned_offset: copy.view.byteOffset,
      cloned_length: copy.view.length,
      first_byte: copy.view[0],
      last_byte: copy.view[2]
    } };
  }
} catch (error) {
  var failedFeature = typeof feature === "undefined";
  if (failedFeature)
    feature = { id: "resizable_arraybuffer_feature", status: "error", details: { error: String(error).slice(0, 200) } };
  roundTrip = { id: "resizable_clone_control", status: "error", details: {
    phase: failedFeature ? "feature" : "clone", error: String(error).slice(0, 200)
  } };
}
return [feature, roundTrip];
