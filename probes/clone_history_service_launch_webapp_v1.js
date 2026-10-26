// One bounded call through the live 14.00 sceSystemServiceLaunchWebApp
// implementation, with an owned benign argument and a process-existence oracle.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if (!native || !native.wrappers || !native.readMemory ||
      !native.frame || native.frame.length<0x300 ||
      native.wrappers.service_launch_webapp!==0x83711e530 ||
      native.wrappers.service_app_status!==0x8371206d0 ||
      native.wrappers.kill===undefined)
    throw new Error("service_caller_missing");
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  function signedWord(address) {
    var bytes=native.readMemory(address,4);
    return (bytes[0]|(bytes[1]<<8)|(bytes[2]<<16)|(bytes[3]<<24));
  }
  var priorProcess=signedWord(0x83715c020);
  if (priorProcess>0)
    throw new Error("existing_webapp_process_"+priorProcess);
  var saved=Array.from(native.frame.subarray(0x100,0x210));
  var statusBefore,returned,processAfter,existence=null,existenceErrno=null;
  try {
    native.frame.fill(0xa5,0x200,0x20c);
    phase="status_before";
    statusBefore=native.call("service_app_status",[native.frameAddress+0x200]);
    if (statusBefore.value!==0 || statusBefore.high!==0)
      throw new Error("status_query_failed");
    var statusBytes=Array.from(native.frame.subarray(0x200,0x20c));
    native.frame.fill(0,0x100,0x120);
    var argument="about:blank";
    for (var i=0;i<argument.length;i++)
      native.frame[0x100+i]=argument.charCodeAt(i);
    if (api && typeof api.markSync==="function")
      api.markSync("webapp_launch_start");
    phase="launch_call";
    returned=native.call("service_launch_webapp",[native.frameAddress+0x100]);
    if (api && typeof api.markSync==="function")
      api.markSync("webapp_launch_returned");
    phase="process_oracle";
    processAfter=signedWord(0x83715c020);
    if (returned.value===0 && returned.high===0 &&
        processAfter>0 && processAfter!==priorProcess) {
      existence=native.call("kill",[processAfter,0]);
      if (existence.value===-1) existenceErrno=native.readErrno();
    }
  } finally {
    native.frame.set(saved,0x100);
  }
  phase="postflight";
  var after=native.call("getpid",[]);
  var restored=after.value===before.value && after.high===0 &&
    saved.every(function(v,i) {return native.frame[0x100+i]===v;});
  if (api && typeof api.markSync==="function")
    api.markSync("webapp_launch_restored");
  result={id:"service_launch_webapp_v1",status:restored?"pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      stored_process_before:priorProcess,
      status_return:statusBefore.value,
      status_hex:statusBytes.map(function(b) {
        return ("0"+b.toString(16)).slice(-2);
      }).join(""),
      launch_return:returned.value,
      launch_return_hex:("00000000"+(returned.value>>>0).toString(16)).slice(-8),
      stored_process_after:processAfter,
      existence_return:existence?existence.value:null,
      existence_errno:existenceErrno,
      caller_restored:restored}};
} catch(error) {
  result={id:"service_launch_webapp_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
