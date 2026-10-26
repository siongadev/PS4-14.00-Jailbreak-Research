// One invalid arg2 discriminator for sys601 request 4.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.sys601 ||
      !state || state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  var before=native.call("getpid",[]);
  if (before.high!==0 || before.value<1 || before.value>100000)
    throw new Error("pid_before_invalid");
  phase="request4_arg2_one";
  if (api && typeof api.markSync==="function")
    api.markSync("mdbg4_badptr_before");
  var call=native.call("sys601",[4,1,0,0,0,0]);
  var errno=call.value===-1?native.readErrno():0;
  if (api && typeof api.markSync==="function")
    api.markSync("mdbg4_badptr_after");
  var after=native.call("getpid",[]);
  var pidOk=after.high===0 && after.value===before.value &&
    state.array[0]===state.a;
  result={id:"mdbg_request4_badptr_v1",status:pidOk?"pass":"fail",
    details:{pid:before.value,return_value:call.value,
      errno:errno,pid_ok:pidOk}};
} catch(error) {
  result={id:"mdbg_request4_badptr_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
