// Take the app ID and 40-byte parameter structure from the live webapp
// caller, then send one deliberately nonexistent executable path.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if (!native || !native.wrappers || !native.frame ||
      native.wrappers.service_app_status!==0x8371206d0 ||
      native.wrappers.service_add_process!==0x837122e80 ||
      native.frame.length<0x300)
    throw new Error("service_caller_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  var saved=Array.from(native.frame.subarray(0x100,0x280));
  var status,returned,appId,parameterAfter;
  try {
    native.frame.fill(0xa5,0x180,0x18c);
    if (api && typeof api.markSync==="function")
      api.markSync("service_appid_preflight");
    phase="app_status";
    status=native.call("service_app_status",[native.frameAddress+0x180]);
    if (status.value!==0 || status.high!==0)
      throw new Error("status_query_failed_"+(status.value>>>0).toString(16));
    appId=(native.frame[0x180]|(native.frame[0x181]<<8)|
      (native.frame[0x182]<<16)|(native.frame[0x183]<<24))>>>0;
    if (appId===0 || appId===0xffffffff)
      throw new Error("status_appid_invalid");
    var path="/not-a-real-ps4-executable/fw14-appid-control-20261020";
    native.frame.fill(0,0x100,0x180);
    for (var i=0;i<path.length;i++) native.frame[0x100+i]=path.charCodeAt(i);
    native.frame.fill(0,0x200,0x228);
    var parameterHead=[0x28,0,0,0,1,0,0,0,
      0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
      0xff,0xff,0xff,0xff];
    native.frame.set(parameterHead,0x200);
    if (api && typeof api.markSync==="function")
      api.markSync("service_appid_request_start");
    phase="invalid_path_request";
    returned=native.call("service_add_process",[
      0x83715c050,appId,native.frameAddress+0x100,0,
      native.frameAddress+0x200]);
    if (api && typeof api.markSync==="function")
      api.markSync("service_appid_request_done");
    parameterAfter=Array.from(native.frame.subarray(0x200,0x228));
  } finally {
    native.frame.set(saved,0x100);
  }
  phase="postflight";
  var after=native.call("getpid",[]);
  var restored=after.value===before.value && after.high===0 &&
    saved.every(function(v,i) {return native.frame[0x100+i]===v;});
  result={id:"service_invalid_process_appid_v2",
    status:restored && returned.value!==0 ? "pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      app_id:appId,return_value:returned.value,
      return_high:returned.high,
      return_low_hex:("00000000"+(returned.value>>>0).toString(16)).slice(-8),
      parameter_after_hex:parameterAfter.map(function(byte) {
        return ("0"+byte.toString(16)).slice(-2);
      }).join(""),parameter_intact:parameterAfter.every(function(v,i) {
        return i<20 ? v===parameterHead[i] : v===0;
      }),caller_restored:restored}};
} catch(error) {
  result={id:"service_invalid_process_appid_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
