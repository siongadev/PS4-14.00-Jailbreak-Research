// Feature check before a cross-subsystem allocation experiment.
var result;
try {
  var memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
  var bytes = new Uint8Array(memory.buffer);
  bytes[0] = 0xb2;
  result = { id: "wasm_memory_capability", status: "pass", details: {
    memory_length: bytes.length,
    first: bytes[0],
    memory_buffer_resizable: memory.buffer.resizable === true
  } };
} catch (error) {
  result = { id: "wasm_memory_capability", status: "unsupported", details: {
    error: String(error).slice(0, 200)
  } };
}
return [result];
