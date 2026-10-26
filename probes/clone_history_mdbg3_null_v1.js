// Distinguish a request-3 pointer check from the previous owned-zero-buffer
// warning. Exactly one request-3 call is made, with arg2 null.
var result,phase="preflight";
try {
  var native=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if(!native||!native.wrappers||!native.wrappers.sys601||
     !state||state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  var before=native.call("getpid",[]);
  if(before.high!==0||before.value<1||before.value>100000)
    throw new Error("pid_invalid");
  phase="request3_null";
  if(api&&typeof api.markSync==="function")api.markSync("mdbg3_null_before");
  var call=native.call("sys601",[3,0,0,0,0,0]);
  var errno=call.value===-1?native.readErrno():0;
  if(api&&typeof api.markSync==="function")api.markSync("mdbg3_null_after");
  var after=native.call("getpid",[]);
  var pidOk=after.high===0&&after.value===before.value&&
    state.array[0]===state.a;
  result={id:"mdbg3_null_v1",status:pidOk?"pass":"fail",
    details:{pid:before.value,return_value:call.value,
      errno:errno,pid_ok:pidOk}};
}catch(error){
  result={id:"mdbg3_null_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
