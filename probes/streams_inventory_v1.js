// Read-only reachability check for the streams implementation and nearby APIs.
var streamNames = [
  "ReadableStream", "WritableStream", "TransformStream",
  "ByteLengthQueuingStrategy", "CountQueuingStrategy",
  "TextEncoderStream", "TextDecoderStream", "CompressionStream",
  "DecompressionStream"
];
var otherNames = ["Blob", "File", "FileReader", "URL", "FontFace", "ImageBitmap", "WebAssembly"];
function check(id, names) {
  var details = {};
  for (var i = 0; i < names.length; ++i)
    details[names[i].replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase()] = typeof globalThis[names[i]];
  return { id: id, status: "pass", details: details };
}
return [check("stream_apis", streamNames), check("adjacent_apis", otherNames)];
