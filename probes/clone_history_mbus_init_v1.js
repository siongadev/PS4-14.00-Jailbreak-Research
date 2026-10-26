// One 14.00 SceMbusIpc client-initialization call, no service method.
// v41 installer derived the module base and checked this entry's live bytes.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!s||s.array[0]!==s.a||!n.wrappers.mbus_init||
     !n.wrappers.getpid)throw new Error("native_plan_missing");
  var before=n.call("getpid",[]);
  if(before.high!==0||before.value<1)throw new Error("pid_control_failed");
  phase="mbus_init";
  if(api&&api.markSync)api.markSync("mbus_init_before");
  var call=n.call("mbus_init",[]);
  phase="postflight";
  var after=n.call("getpid",[]);
  var restored=after.high===0&&after.value===before.value&&s.array[0]===s.a;
  result={id:"mbus_init_v1",status:restored?"pass":"fail",
    details:{pid:before.value,return_value:call.value,return_high:call.high,
      restored:restored}};
}catch(error){result={id:"mbus_init_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
