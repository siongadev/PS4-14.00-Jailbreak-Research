// Small, in-bounds check for a cloned typed array attached to the wrong buffer.
function examine(id, prefix) {
  try {
    var first = new ArrayBuffer(8);
    var second = new ArrayBuffer(8);
    new Uint8Array(first).fill(0x11);
    new Uint8Array(second).fill(0x22);
    var view = new Uint8Array(second, 2, 3);
    var clone = structuredClone([prefix, first, second, view]);
    var clonedView = clone[3];
    var isView = ArrayBuffer.isView(clonedView);
    var correctBuffer = isView && clonedView.buffer === clone[2];
    var wrongBuffer = isView && clonedView.buffer === clone[1];
    var before = isView ? clonedView[0] : -1;
    var offset = isView ? clonedView.byteOffset : -1;
    var length = isView ? clonedView.byteLength : -1;
    if (isView)
      clonedView[0] = 0x7f;
    var firstByte = new Uint8Array(clone[1])[2];
    var secondByte = new Uint8Array(clone[2])[2];
    var valid = isView && correctBuffer && !wrongBuffer && before === 0x22 &&
                offset === 2 && length === 3 && firstByte === 0x11 && secondByte === 0x7f;
    return {
      id: id,
      status: valid ? "pass" : "fail",
      details: { is_view: isView, correct_buffer: correctBuffer,
                 wrong_buffer: wrongBuffer, before: before, offset: offset,
                 length: length, first_byte_after: firstByte, second_byte_after: secondByte }
    };
  } catch (error) {
    return { id: id, status: "error", details: { error: String(error).slice(0, 512) } };
  }
}

return [
  examine("number_control", 23),
  examine("bigint_shift", BigInt(23))
];
