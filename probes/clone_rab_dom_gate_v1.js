// Check whether native Web APIs accept an ordinary resizable-buffer view.
// This probe does not use the pool-shifted view or touch memory outside a buffer.
function result(id, fn) {
  try { return { id: id, status: "pass", details: { outcome: String(fn()).slice(0, 200) } }; }
  catch (error) { return { id: id, status: "fail", details: {
    name: String(error && error.name || "Error"),
    message: String(error && error.message || error).slice(0, 200)
  } }; }
}
var fixed = new Uint8Array([65, 66, 67, 68]);
var rab = new ArrayBuffer(4, { maxByteLength: 16 });
var view = new Uint8Array(rab, 0, 4);
view.set(fixed);
return [
  result("decoder_fixed_control", function () { return new TextDecoder().decode(fixed); }),
  result("decoder_rab_gate", function () { return new TextDecoder().decode(view); }),
  result("blob_fixed_control", function () { return new Blob([fixed]).size; }),
  result("blob_rab_gate", function () { return new Blob([view]).size; }),
  result("image_data_fixed_control", function () {
    return new ImageData(new Uint8ClampedArray([1, 2, 3, 4]), 1, 1).data.length;
  }),
  result("image_data_rab_gate", function () {
    var imageBuffer = new ArrayBuffer(4, { maxByteLength: 16 });
    var pixels = new Uint8ClampedArray(imageBuffer);
    pixels.set([1, 2, 3, 4]);
    return new ImageData(pixels, 1, 1).data.length;
  })
];
