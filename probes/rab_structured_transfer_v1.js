// Benign transfer control for resizable-buffer detachment.
var result;
try {
  var buffer = new ArrayBuffer(8, { maxByteLength: 16 });
  var view = new Uint8Array(buffer);
  view[0] = 0x5a;
  var moved = structuredClone(buffer, { transfer: [buffer] });
  result = { id: "rab_structured_transfer", status: "pass", details: {
    original_length: buffer.byteLength,
    original_view_length: view.length,
    moved_length: moved.byteLength,
    moved_first: new Uint8Array(moved)[0],
    moved_resizable: moved.resizable === true,
    moved_maximum: moved.maxByteLength
  } };
} catch (error) {
  result = { id: "rab_structured_transfer", status: "unsupported", details: {
    error: String(error).slice(0, 200)
  } };
}
return [result];
