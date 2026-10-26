// Isolated null-argument selector gap. Marker precedes the native call.
var result, phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||!native.wrappers.sys601)
    throw new Error("caller_missing");
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  phase="selector_25";
  if(api&&typeof api.markSync==="function") api.markSync("mg_before_25");
  var c=native.call("sys601",[25,0,0,0,0,0]);
  var e=c.value===-1?native.readErrno():null;
  if(api&&typeof api.markSync==="function") api.markSync("mg_after_25");
  var end=native.call("getpid",[]);
  result={id:"mdbg_gap_25_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,selector:25,ret:c.value,high:c.high,
      errno:e===null?"ok":e}};
}catch(error){result={id:"mdbg_gap_25_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
return [result];

