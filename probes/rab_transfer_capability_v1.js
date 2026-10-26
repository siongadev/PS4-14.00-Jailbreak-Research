// Benign feature and detach behavior check for a resizable ArrayBuffer.
var result;
try {
  var buffer = new ArrayBuffer(8, { maxByteLength: 16 });
  var view = new Uint8Array(buffer);
  view[0] = 0x5a;
  var method = typeof buffer.transfer;
  var fixedMethod = typeof buffer.transferToFixedLength;
  var cloneMethod = typeof structuredClone;
  var detached = null;
  var movedByte = null;
  if (method === "function") {
    var moved = buffer.transfer();
    detached = buffer.byteLength === 0 && view.length === 0;
    movedByte = new Uint8Array(moved)[0];
  }
  result = { id: "rab_transfer_capability", status: "pass", details: {
    transfer_method: method,
    fixed_transfer_method: fixedMethod,
    structured_clone_method: cloneMethod,
    detaches_old_view: detached,
    moved_first: movedByte
  } };
} catch (error) {
  result = { id: "rab_transfer_capability", status: "error", details: {
    error: String(error).slice(0, 200)
  } };
}
return [result];
