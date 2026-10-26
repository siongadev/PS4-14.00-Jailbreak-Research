// Send one addLocalProcess request for the known non-executable /dev/random
// device, comparing its service error with the nonexistent-path control.
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
  var path="/dev/random";
  var pathOriginal=Array.from(native.frame.subarray(0x100,0x180));
  var outputOriginal=Array.from(native.frame.subarray(0x200,0x280));
  var returned,output;
  try {
    native.frame.fill(0,0x100,0x180);
    for (var i=0;i<path.length;i++) native.frame[0x100+i]=path.charCodeAt(i);
    native.frame.fill(0xa5,0x200,0x280);
    if (api && typeof api.markSync==="function")
      api.markSync("service_add_invalid_preflight");
    phase="service_add_invalid";
    returned=native.call("service_add_process",[
      0x83715c050,0,native.frameAddress+0x100,0,
      native.frameAddress+0x200]);
    if (api && typeof api.markSync==="function")
      api.markSync("service_add_invalid_returned");
    output=Array.from(native.frame.subarray(0x200,0x220));
  } finally {
    native.frame.set(pathOriginal,0x100);
    native.frame.set(outputOriginal,0x200);
  }
  phase="postflight";
  var after=native.call("getpid",[]);
  var restored=after.value===before.value && after.high===0 &&
    pathOriginal.every(function(v,i) {return native.frame[0x100+i]===v;}) &&
    outputOriginal.every(function(v,i) {return native.frame[0x200+i]===v;});
  result={id:"service_invalid_process_v2",
    status:restored && returned.value!==0 ? "pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      return_value:returned.value,return_high:returned.high,
      path_kind:"existing_nonexecutable_device",
      return_low_hex:("00000000"+(returned.value>>>0).toString(16)).slice(-8),
      output_hex:output.map(function(byte) {
        return ("0"+byte.toString(16)).slice(-2);
      }).join(""),caller_restored:restored}};
} catch(error) {
  result={id:"service_invalid_process_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
