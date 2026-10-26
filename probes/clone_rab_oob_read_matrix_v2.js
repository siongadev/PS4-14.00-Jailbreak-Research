// Compare a pool-shifted view whose raw offset exceeds maxByteLength with a
// legitimately out-of-bounds view. Read-only operations and canaries only.
function outcome(fn) {
  try { return "return:" + String(fn()); }
  catch (error) { return "throw:" + String(error && error.name || error); }
}
function summarize(value) {
  return "offset=" + value.offset + ",bytes=" + value.byte_length +
    ",elements=" + value.element_length + ",index=" + value.element_type +
    ",at=" + value.at + ",slice=" + value.slice +
    ",subarray=" + value.subarray + ",values=" + value.values +
    ",array_from=" + value.array_from;
}
function inspect(view) {
  return {
    offset: view.byteOffset,
    byte_length: view.byteLength,
    element_length: view.length,
    element_type: typeof view[0],
    at: outcome(function () { return view.at(0); }),
    slice: outcome(function () { return view.slice(0, 1).length; }),
    subarray: outcome(function () { return view.subarray(0, 1).length; }),
    values: outcome(function () { var step = view.values().next(); return step.done ? "done" : step.value; }),
    array_from: outcome(function () { return Array.from(view).length; })
  };
}
function makeBuffers() {
  var first = new ArrayBuffer(8, { maxByteLength: 16 });
  var second = new ArrayBuffer(64, { maxByteLength: 128 });
  new Uint8Array(first).fill(0x11);
  new Uint8Array(second).fill(0x22);
  return [first, second, new Uint8Array(second, 32, 8)];
}

var legit;
try {
  var ordinaryBuffer = new ArrayBuffer(64, { maxByteLength: 128 });
  var ordinaryView = new Uint8Array(ordinaryBuffer, 32, 8);
  ordinaryBuffer.resize(8);
  var before = inspect(ordinaryView);
  ordinaryBuffer.resize(16);
  legit = { id: "legitimate_oob_control", status: "pass", details: {
    before: summarize(before), after_resize: summarize(inspect(ordinaryView))
  } };
} catch (error) {
  legit = { id: "legitimate_oob_control", status: "error", details: { error: String(error).slice(0, 240) } };
}
if (legit.status !== "pass")
  return [legit,
    { id: "rab_number_control", status: "unsupported", details: { reason: "oob_control_failed" } },
    { id: "rab_bigint_read_matrix", status: "unsupported", details: { reason: "oob_control_failed" } }];

var number;
try {
  var normal = makeBuffers();
  var normalCopy = structuredClone([23, normal[0], normal[1], normal[2]]);
  var normalView = normalCopy[3];
  var normalOk = normalView.buffer === normalCopy[2] &&
    normalView.byteOffset === 32 && normalView.byteLength === 8 && normalView[0] === 0x22;
  number = { id: "rab_number_control", status: normalOk ? "pass" : "fail", details: {
    attached_to_second: normalView.buffer === normalCopy[2],
    offset: normalView.byteOffset, byte_length: normalView.byteLength,
    first_value: normalView[0]
  } };
} catch (error) {
  number = { id: "rab_number_control", status: "error", details: { error: String(error).slice(0, 240) } };
}
if (number.status !== "pass")
  return [legit, number,
    { id: "rab_bigint_read_matrix", status: "unsupported", details: { reason: "number_control_failed" } }];

var shifted;
var phase = "build";
try {
  var graph = makeBuffers();
  if (api && typeof api.markSync === "function") api.markSync("rab_read_ready");
  phase = "clone";
  var copy = structuredClone([BigInt(23), graph[0], graph[1], graph[2]]);
  if (api && typeof api.markSync === "function") api.markSync("rab_read_cloned");
  phase = "inspect";
  var wrongView = copy[3];
  var initial = inspect(wrongView);
  copy[1].resize(16);
  var resized = inspect(wrongView);
  var canaryFirst = new Uint8Array(copy[1])[0];
  var canarySecond = new Uint8Array(copy[2])[32];
  shifted = { id: "rab_bigint_read_matrix", status: wrongView.buffer === copy[2] ? "pass" : "fail", details: {
    attached_to_first: wrongView.buffer === copy[1],
    attached_to_second: wrongView.buffer === copy[2],
    attached_max: wrongView.buffer.maxByteLength,
    before: summarize(initial), after_resize: summarize(resized),
    first_canary: canaryFirst, second_canary: canarySecond
  } };
} catch (error) {
  shifted = { id: "rab_bigint_read_matrix", status: "error", details: {
    phase: phase, error: String(error).slice(0, 240)
  } };
}
return [legit, number, shifted];
