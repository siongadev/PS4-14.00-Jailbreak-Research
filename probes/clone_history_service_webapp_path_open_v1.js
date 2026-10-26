// Check whether the exact path assembled by LaunchWebApp can be opened
// read-only from this browser process. No launch request is sent.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if (!native || !native.wrappers || !native.readMemory ||
      !native.frame || native.frame.length<0x300 ||
      native.wrappers.service_path_prefix!==0x83711c208)
    throw new Error("service_caller_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  var prefixReturn=native.call("service_path_prefix",[]);
  var pointer=(prefixReturn.value>>>0)+prefixReturn.high*0x100000000;
  if (!Number.isSafeInteger(pointer) || pointer<0x100000000 ||
      pointer>=0x1000000000000)
    throw new Error("prefix_pointer_invalid");
  var bytes=native.readMemory(pointer,128);
  var end=bytes.indexOf(0);
  if (end<1 || end>80) throw new Error("prefix_length_invalid");
  var path="";
  for (var i=0;i<end;i++) {
    if (bytes[i]<0x21 || bytes[i]>0x7e)
      throw new Error("prefix_nonprintable");
    path+=String.fromCharCode(bytes[i]);
  }
  path+="/common/lib/webapp.self";
  var saved=Array.from(native.frame.subarray(0x100,0x180));
  var opened,openErrno=null,closed=null;
  try {
    native.frame.fill(0,0x100,0x180);
    for (var p=0;p<path.length;p++) native.frame[0x100+p]=path.charCodeAt(p);
    if (api && typeof api.markSync==="function")
      api.markSync("webapp_path_open_start");
    phase="read_only_open";
    opened=native.call("open",[native.frameAddress+0x100,0,0]);
    if (opened.value<0) openErrno=native.readErrno();
    else {
      if (opened.value>1024) throw new Error("fd_out_of_range");
      phase="close";
      closed=native.call("close",[opened.value]);
    }
  } finally {
    native.frame.set(saved,0x100);
  }
  phase="postflight";
  var after=native.call("getpid",[]);
  var restored=after.value===before.value && after.high===0 &&
    saved.every(function(v,i) {return native.frame[0x100+i]===v;});
  if (api && typeof api.markSync==="function")
    api.markSync("webapp_path_open_restored");
  result={id:"service_webapp_path_open_v1",status:restored?"pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,path:path,
      open_return:opened.value,open_errno:openErrno,
      close_return:closed?closed.value:null,caller_restored:restored}};
} catch(error) {
  result={id:"service_webapp_path_open_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
