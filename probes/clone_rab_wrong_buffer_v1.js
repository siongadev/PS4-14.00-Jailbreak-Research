// A valid view on a large resizable buffer follows a smaller resizable buffer.
// The BigInt prefix previously shifted a view's buffer reference back by one.
function examine(id, prefix, marked) {
  var phase = "build";
  try {
    var first = new ArrayBuffer(8, { maxByteLength: 16 });
    var second = new ArrayBuffer(64, { maxByteLength: 128 });
    if (first.resizable !== true || second.resizable !== true)
      return { id: id, status: "unsupported", details: { reason: "resizable_buffer_absent" } };
    new Uint8Array(first).fill(0x11);
    new Uint8Array(second).fill(0x22);
    var view = new Uint8Array(second, 32, 8);
    var input = [prefix, first, second, view];
    if (marked && api && typeof api.markSync === "function")
      api.markSync("rab_bigint_ready");
    phase = "clone";
    var copy = structuredClone(input);
    if (marked && api && typeof api.markSync === "function")
      api.markSync("rab_bigint_cloned");
    phase = "inspect";
    var clonedView = copy[3];
    var isView = ArrayBuffer.isView(clonedView);
    var attachedToFirst = isView && clonedView.buffer === copy[1];
    var attachedToSecond = isView && clonedView.buffer === copy[2];
    var bufferLength = isView ? clonedView.buffer.byteLength : null;
    var bufferMax = isView ? clonedView.buffer.maxByteLength : null;
    var viewOffset = isView ? clonedView.byteOffset : null;
    var viewLength = isView ? clonedView.byteLength : null;
    var viewElement = isView ? clonedView[0] : null;
    var firstCanary = new Uint8Array(copy[1])[0];
    var secondCanary = new Uint8Array(copy[2])[32];
    var intact = isView && attachedToSecond && !attachedToFirst &&
      bufferLength === 64 && bufferMax === 128 && viewOffset === 32 &&
      viewLength === 8 && viewElement === 0x22 &&
      firstCanary === 0x11 && secondCanary === 0x22;
    return { id: id, status: intact ? "pass" : "fail", details: {
      is_view: isView,
      attached_to_first: attachedToFirst,
      attached_to_second: attachedToSecond,
      attached_buffer_length: bufferLength,
      attached_buffer_max: bufferMax,
      view_offset: viewOffset,
      view_byte_length: viewLength,
      view_first_type: typeof viewElement,
      view_first_value: typeof viewElement === "number" ? viewElement : null,
      first_canary: firstCanary,
      second_canary: secondCanary
    } };
  } catch (error) {
    return { id: id, status: "error", details: {
      phase: phase, error: String(error).slice(0, 300)
    } };
  }
}

var control = examine("rab_number_control", 23, false);
if (control.status !== "pass")
  return [control, { id: "rab_bigint_shift", status: "unsupported", details: { reason: "control_failed" } }];
return [control, examine("rab_bigint_shift", BigInt(23), true)];
