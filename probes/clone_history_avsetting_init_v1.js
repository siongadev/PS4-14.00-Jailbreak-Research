// Invoke only the 14.00 AvSetting client initializer, with a current-page
// checked entry and PID/restoration controls from the v43 native caller.
var result,phase="preflight";
try {
  var s=window.__fw14ArrayState,n=window.__fw14NativeInvoke,
    m=window.__fw14BulkMapAll;
  if(!s||!n||!m||!n.wrappers.av_init||s.array[0]!==s.a)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  phase="avsetting_init";
  if(api&&api.markSync)api.markSync("avsetting_init_before");
  var call=n.call("av_init",[]);
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===pid.value&&s.array[0]===s.a;
  result={id:"avsetting_init_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,return_value:call.value,return_high:call.high,
      restored:restored}};
}catch(error){result={id:"avsetting_init_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
