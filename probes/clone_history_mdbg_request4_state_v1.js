// Compare three browser authority indicators around one request-4 call.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.sys601 ||
      !native.wrappers.sys585 || !native.wrappers.sys606 ||
      !native.wrappers.sys600 || !state || state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  function call(name) {
    var r=native.call(name,[0,0,0,0,0,0]);
    return r.value+(r.value===-1?"/"+native.readErrno():"");
  }
  var pid=native.call("getpid",[]);
  if (pid.high!==0 || pid.value<1 || pid.value>100000)
    throw new Error("pid_invalid");
  var before=[call("sys585"),call("sys606"),call("sys600")].join(",");
  phase="request4";
  if (api && typeof api.markSync==="function") api.markSync("mdbg4_state_before");
  var req=native.call("sys601",[4,0,0,0,0,0]);
  var reqErrno=req.value===-1?native.readErrno():0;
  if (api && typeof api.markSync==="function") api.markSync("mdbg4_state_after");
  var after=[call("sys585"),call("sys606"),call("sys600")].join(",");
  var endPid=native.call("getpid",[]);
  var pidOk=endPid.high===0 && endPid.value===pid.value &&
    state.array[0]===state.a;
  result={id:"mdbg_request4_state_v1",status:pidOk?"pass":"fail",
    details:{pid:pid.value,before:before,after:after,
      request_return:req.value,request_errno:reqErrno,
      unchanged:before===after,pid_ok:pidOk}};
} catch(error) {
  result={id:"mdbg_request4_state_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
