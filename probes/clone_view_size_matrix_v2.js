// Vary the size of the buffer that the BigInt pool shift selects by mistake.
// The source view is always a valid 8-byte window in a separate 16-byte buffer.
var cases = [
  { id: "number_zero", size: 0, bigint: false },
  { id: "bigint_zero", size: 0, bigint: true },
  { id: "bigint_one", size: 1, bigint: true },
  { id: "bigint_eight", size: 8, bigint: true },
  { id: "bigint_eleven", size: 11, bigint: true },
  { id: "bigint_twelve", size: 12, bigint: true },
  { id: "bigint_sixteen", size: 16, bigint: true },
  { id: "bigint_thirtytwo", size: 32, bigint: true },
  { id: "number_sixteen", size: 16, bigint: false }
];
var checks = [];

for (var caseIndex = 0; caseIndex < cases.length; caseIndex++) {
  var candidate = cases[caseIndex];
  if (caseIndex < 8 && api && typeof api.markSync === "function")
    api.markSync("before_case_" + caseIndex);
  try {
    var first = new ArrayBuffer(candidate.size);
    var second = new ArrayBuffer(16);
    new Uint8Array(first).fill(0x11);
    new Uint8Array(second).fill(0x22);
    var view = new Uint8Array(second, 4, 8);
    var cloned = structuredClone([candidate.bigint ? BigInt(23) : 23, first, second, view]);
    var copied = cloned[3];
    var isView = ArrayBuffer.isView(copied);
    var actualBuffer = isView ? copied.buffer : null;
    var correctBuffer = actualBuffer === cloned[2];
    var wrongBuffer = actualBuffer === cloned[1];
    var length = isView ? copied.byteLength : -1;
    var backingLength = actualBuffer ? actualBuffer.byteLength : -1;
    var firstByte = isView ? copied[0] : -1;
    var withinBounds = isView && copied.byteOffset + length <= backingLength;
    var valid = isView && correctBuffer && !wrongBuffer && length === 8 &&
      backingLength === 16 && firstByte === 0x22 && withinBounds;
    checks.push({
      id: candidate.id,
      status: valid ? "pass" : "fail",
      details: { first_size: candidate.size, is_view: isView,
        correct_buffer: correctBuffer, wrong_buffer: wrongBuffer,
        view_length: length, backing_length: backingLength,
        first_byte: firstByte, within_bounds: withinBounds }
    });
  } catch (error) {
    checks.push({
      id: candidate.id,
      status: "fail",
      details: { first_size: candidate.size, error_name: String(error.name || "unknown"),
        error: String(error).slice(0, 160) }
    });
  }
}

return checks;
