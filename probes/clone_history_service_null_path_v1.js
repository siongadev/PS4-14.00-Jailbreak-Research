// Take the client-side null-path guard in the captured addLocalProcess code.
// This call must return before any service request or process launch.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if (!native || !native.wrappers || !native.frame ||
      native.wrappers.service_add_process!==0x837122e80 ||
      native.frame.length<0x300)
    throw new Error("service_process_caller_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  var saved=Array.from(native.frame.subarray(0x200,0x280));
  var returned,output;
  try {
    native.frame.fill(0xa5,0x200,0x280);
    if (api && typeof api.markSync==="function")
      api.markSync("service_null_preflight");
    phase="null_path";
    returned=native.call("service_add_process",[
      0x83715c050,0,0,0,native.frameAddress+0x200]);
    if (api && typeof api.markSync==="function")
      api.markSync("service_null_returned");
    output=Array.from(native.frame.subarray(0x200,0x220));
  } finally {
    native.frame.set(saved,0x200);
  }
  phase="postflight";
  var after=native.call("getpid",[]);
  var restored=after.value===before.value && after.high===0 &&
    saved.every(function(v,i) {return native.frame[0x200+i]===v;});
  result={id:"service_null_path_v1",status:restored?"pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      return_value:returned.value,return_high:returned.high,
      return_low_hex:("00000000"+(returned.value>>>0).toString(16)).slice(-8),
      output_hex:output.map(function(byte) {
        return ("0"+byte.toString(16)).slice(-2);
      }).join(""),caller_restored:restored}};
} catch(error) {
  result={id:"service_null_path_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
