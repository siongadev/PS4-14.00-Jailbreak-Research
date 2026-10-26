// Run only the source-defined VideoOut process-local initializer.
var result,phase="preflight";
try {
  var s=window.__fw14ArrayState,n=window.__fw14NativeInvoke,
    m=window.__fw14BulkMapAll;
  if(!s||!n||!m||!n.wrappers.video_init||s.array[0]!==s.a)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  phase="videoout_init";
  if(api&&api.markSync)api.markSync("videoout_init_before");
  n.call("video_init",[]);
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===pid.value&&s.array[0]===s.a;
  result={id:"videoout_init_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,returned:true,restored:restored}};
}catch(error){result={id:"videoout_init_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
