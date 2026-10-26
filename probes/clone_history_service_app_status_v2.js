// Query app status through the observed 14.00 service function with a
// sentinel-filled owned output. This does not request an app launch.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if (!native || !native.wrappers || !native.frame ||
      native.wrappers.service_app_status!==0x8371206d0 ||
      native.frame.length<0x200)
    throw new Error("service_status_caller_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  var saved=Array.from(native.frame.subarray(0x100,0x10c));
  var returned,observed;
  try {
    native.frame.fill(0xa5,0x100,0x10c);
    if (api && typeof api.markSync==="function")
      api.markSync("service_status_preflight");
    phase="service_status";
    returned=native.call("service_app_status",[native.frameAddress+0x100]);
    if (api && typeof api.markSync==="function")
      api.markSync("service_status_returned");
    observed=Array.from(native.frame.subarray(0x100,0x10c));
  } finally {
    native.frame.set(saved,0x100);
  }
  phase="postflight";
  var after=native.call("getpid",[]);
  var intact=after.value===before.value && after.high===0 &&
    saved.every(function(value,index) {
      return native.frame[0x100+index]===value;
    });
  result={id:"service_app_status_v2",status:intact?"pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      return_value:returned.value,return_high:returned.high,
      output_hex:observed.map(function(byte) {
        return ("0"+byte.toString(16)).slice(-2);
      }).join(""),caller_restored:intact}};
} catch(error) {
  result={id:"service_app_status_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
