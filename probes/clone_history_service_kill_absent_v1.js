// Probe the 14.00 SystemService 0x30008 client with an absent local-process ID.
// The caller rechecks the 16-byte entry signature and restores the native chain.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||typeof n.wrappers.service_killlocal!=="number"||
     !s||s.array[0]!==s.a)throw new Error("caller_missing");
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1||before.value>100000)
    throw new Error("pid_invalid");
  phase="kill_absent";
  if(api&&api.markSync)api.markSync("kill_absent_before");
  var call=n.call("service_killlocal",[0x7fffff00,0]);
  if(api&&api.markSync)api.markSync("kill_absent_after");
  phase="postflight";
  var after=n.call("getpid",[]);
  var intact=after.value===before.value&&after.high===0&&s.array[0]===s.a;
  result={id:"service_kill_absent_v1",status:intact?"pass":"fail",
    details:{pid:before.value,absent_id:0x7fffff00,
      return_signed:call.value,return_hex:(call.value>>>0).toString(16),
      return_high:call.high,post_pid:after.value,intact:intact}};
}catch(e){result={id:"service_kill_absent_v1",status:"error",
  details:{phase:phase,error:String(e).slice(0,180)}};}
return [result];
