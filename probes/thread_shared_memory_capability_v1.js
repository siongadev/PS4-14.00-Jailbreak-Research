// Read-only capability census for a possible page/worker rendezvous.
var hasShared=typeof SharedArrayBuffer==="function";
var hasAtomics=typeof Atomics==="object" &&
  typeof Atomics.wait==="function" &&
  typeof Atomics.notify==="function";
var allocated=false,atomicsRoundTrip=false;
if (hasShared && hasAtomics) {
  try {
    var shared=new SharedArrayBuffer(4);
    var word=new Int32Array(shared);
    Atomics.store(word,0,0x2a);
    allocated=shared.byteLength===4;
    atomicsRoundTrip=Atomics.load(word,0)===0x2a;
  } catch (error) { allocated=false; }
}
return [{id:"thread_shared_memory_capability_v1",status:"pass",
  details:{cross_origin_isolated:window.crossOriginIsolated===true,
    shared_array_buffer_exposed:hasShared,
    atomics_wait_exposed:hasAtomics,
    shared_allocated:allocated,
    atomics_roundtrip:atomicsRoundTrip}}];
