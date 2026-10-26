// Query at most 16 local-process statuses through the live 14.00 service
// client. The owned 0x240-byte output has guards and is restored afterward.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if (!native || !native.wrappers || !native.frame ||
      native.wrappers.service_process_list!==0x837120cc0 ||
      native.frame.length<0x700)
    throw new Error("service_list_caller_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  var countOriginal=Array.from(native.frame.subarray(0x300,0x310));
  var listOriginal=Array.from(native.frame.subarray(0x3e0,0x660));
  var returned,countBytes,listBytes,guards;
  try {
    native.frame.fill(0xa5,0x300,0x310);
    native.frame.fill(0x7b,0x3e0,0x400);
    native.frame.fill(0xa5,0x400,0x640);
    native.frame.fill(0x7b,0x640,0x660);
    if (api && typeof api.markSync==="function")
      api.markSync("service_list_preflight");
    phase="service_list";
    returned=native.call("service_process_list",[
      native.frameAddress+0x400,16,native.frameAddress+0x300]);
    if (api && typeof api.markSync==="function")
      api.markSync("service_list_returned");
    countBytes=Array.from(native.frame.subarray(0x300,0x310));
    listBytes=Array.from(native.frame.subarray(0x400,0x640));
    guards=Array.from(native.frame.subarray(0x3e0,0x400)).every(
      function(v) {return v===0x7b;}) &&
      Array.from(native.frame.subarray(0x640,0x660)).every(
      function(v) {return v===0x7b;}) &&
      countBytes.slice(4).every(function(v) {return v===0xa5;});
  } finally {
    native.frame.set(countOriginal,0x300);
    native.frame.set(listOriginal,0x3e0);
  }
  phase="postflight";
  var after=native.call("getpid",[]);
  var restored=after.value===before.value && after.high===0 &&
    countOriginal.every(function(v,i) {return native.frame[0x300+i]===v;}) &&
    listOriginal.every(function(v,i) {return native.frame[0x3e0+i]===v;});
  var count=(countBytes[0]|(countBytes[1]<<8)|
    (countBytes[2]<<16)|(countBytes[3]<<24))>>>0;
  function hexPart(start,size) {
    return listBytes.slice(start,start+size).map(function(byte) {
      return ("0"+byte.toString(16)).slice(-2);
    }).join("");
  }
  result={id:"service_process_list_v1",
    status:restored && guards && returned.value===0 && count<=16 ?
      "pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      return_value:returned.value,return_high:returned.high,
      entry_count:count,guards_intact:guards,caller_restored:restored,
      entries_hex_0:hexPart(0,192),
      entries_hex_1:hexPart(192,192),
      entries_hex_2:hexPart(384,192)}};
} catch(error) {
  result={id:"service_process_list_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
