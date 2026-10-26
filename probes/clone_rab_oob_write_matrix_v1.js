// Matched, one-byte typed-array write operations against a normal OOB view and
// the BigInt-shifted view. Canary bytes track both cloned backing buffers.
function result(fn) {
  try { return "return:" + String(fn()); }
  catch (error) { return "throw:" + String(error && error.name || error); }
}
function operations(view) {
  var target = new Uint8Array([0x77, 0x77]);
  var out = [];
  out.push("source_set=" + result(function () { target.set(view); return target[0]; }));
  out.push("dest_set=" + result(function () { view.set([0x99]); return view[0]; }));
  out.push("fill=" + result(function () { view.fill(0x99, 0, 1); return view[0]; }));
  out.push("copy_within=" + result(function () { view.copyWithin(0, 0, 1); return view[0]; }));
  out.push("reverse=" + result(function () { view.reverse(); return view[0]; }));
  out.push("sort=" + result(function () { view.sort(); return view[0]; }));
  out.push("index_store=" + result(function () { view[0] = 0x99; return view[0]; }));
  return out.join(";");
}
var control;
try {
  var base = new ArrayBuffer(64, { maxByteLength: 128 });
  var ordinary = new Uint8Array(base, 32, 8);
  base.resize(8);
  control = { id: "legitimate_oob_write_control", status: "pass", details: {
    operations: operations(ordinary), offset: ordinary.byteOffset, length: ordinary.length
  } };
} catch (error) {
  control = { id: "legitimate_oob_write_control", status: "error", details: {
    error: String(error).slice(0, 200)
  } };
}
if (control.status !== "pass")
  return [control, { id: "shifted_oob_write_compare", status: "unsupported", details: { reason: "control_failed" } }];

var shifted;
var phase = "build";
try {
  var first = new ArrayBuffer(8, { maxByteLength: 16 });
  var second = new ArrayBuffer(64, { maxByteLength: 128 });
  new Uint8Array(first).fill(0x11);
  new Uint8Array(second).fill(0x22);
  var input = [BigInt(23), first, second, new Uint8Array(second, 32, 8)];
  if (api && typeof api.markSync === "function") api.markSync("rab_write_ready");
  phase = "clone";
  var copy = structuredClone(input);
  if (api && typeof api.markSync === "function") api.markSync("rab_write_cloned");
  phase = "operations";
  var view = copy[3];
  var actual = operations(view);
  var same = actual === control.details.operations;
  var firstCanary = new Uint8Array(copy[1])[0];
  var secondCanary = new Uint8Array(copy[2])[32];
  shifted = { id: "shifted_oob_write_compare", status: same && firstCanary === 0x11 && secondCanary === 0x22 ? "pass" : "fail", details: {
    attached_to_first: view.buffer === copy[1],
    attached_max: view.buffer.maxByteLength,
    operations: actual,
    same_as_control: same,
    first_canary: firstCanary,
    second_canary: secondCanary
  } };
} catch (error) {
  shifted = { id: "shifted_oob_write_compare", status: "error", details: {
    phase: phase, error: String(error).slice(0, 200)
  } };
}
return [control, shifted];
