// Check whether an unreferenced transfer-list item detaches in this browser.
var result;
try {
  var buffer = new ArrayBuffer(65536);
  var view = new Uint8Array(buffer);
  view[0] = 0x5a;
  var copy = structuredClone({ marker: 7 }, { transfer: [buffer] });
  result = { id: "unused_transfer_capability", status: "pass", details: {
    detached_length: buffer.byteLength,
    detached_view_length: view.length,
    copy_marker: copy.marker,
    transferred_byte_undefined: view[0] === undefined
  } };
} catch (error) {
  result = { id: "unused_transfer_capability", status: "unsupported", details: {
    error: String(error).slice(0, 200)
  } };
}
return [result];
