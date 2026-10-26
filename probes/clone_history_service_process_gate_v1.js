// Compare the live service process-type gate with the already validated
// browser PID control. The gate's 16-byte entry is rechecked by the caller.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if (!native || !native.wrappers ||
      native.wrappers.service_process_gate!==0x837147120)
    throw new Error("service_gate_caller_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  if (api && typeof api.markSync==="function")
    api.markSync("service_gate_preflight");
  phase="service_gate";
  var gate=native.call("service_process_gate",[0]);
  if (api && typeof api.markSync==="function")
    api.markSync("service_gate_returned");
  phase="postflight";
  var after=native.call("getpid",[]);
  var intact=after.value===before.value && after.high===0;
  result={id:"service_process_gate_v1",
    status:intact?"pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      gate_value:gate.value,gate_high:gate.high,
      caller_restored:intact}};
} catch(error) {
  result={id:"service_process_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
