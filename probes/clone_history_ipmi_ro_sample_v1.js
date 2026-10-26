// Read a bounded sample at the read-only mapping that follows the IPMI RX
// entry. The read is performed by the existing forged view and restored.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.readMemory || !native.wrappers ||
      !state || state.array[0]!==state.a)
    throw new Error("ro_sample_plan_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync==="function")
    api.markSync("ipmi_ro_sample_preflight");
  phase="mapped_read";
  var bytes=native.readMemory(0x833f0c000,64);
  if (!bytes || bytes.length!==64)
    throw new Error("sample_length_invalid");
  var text="";
  for (var i=0;i<bytes.length;i++) text+=String.fromCharCode(bytes[i]);
  var after=native.call("getpid",[]);
  var restored=after.value===before.value && after.high===0 &&
    state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("ipmi_ro_sample_restored");
  result={id:"ipmi_ro_sample_v1",status:restored?"pass":"fail",
    details:{base:"0x833f0c000",head_b64:btoa(text),
      pid_before:before.value,pid_after:after.value,
      caller_restored:restored}};
} catch(error) {
  result={id:"ipmi_ro_sample_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
