// PS4 14.00 comparison of the reported 637(0, 0xffffffff) shape.
// Self target only; capture authority and resident-count behavior.
// A zero return alone is not a kernel-write or sandbox-escape oracle.
var result, phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.call64!=="function"||
      typeof native.wrappers.sys637!=="number"||
      typeof native.wrappers.sys615!=="number"||
      typeof native.wrappers.sys585!=="number"||
      typeof native.wrappers.sys606!=="number")
    throw new Error("caller_missing");
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function snapshot(){
    var a=native.call("sys585",[]),d=native.call("sys606",[]);
    var r=native.call("sys615",[pid.value]);
    var e=r.value===-1?native.readErrno():0;
    return a.value+","+d.value+","+r.value+"/"+e;
  }
  var before=snapshot();
  phase="call637";
  if(api&&typeof api.markSync==="function")
    api.markSync("fmem637_before_call");
  var call=native.call64("sys637",[[0,0],[0xffffffff,0]]);
  var errno=call.value===-1?native.readErrno():0;
  phase="after";
  var after=snapshot(),pidAfter=native.call("getpid",[]);
  result={id:"sys637_self_limit_v1",
    status:pidAfter.high===0&&pidAfter.value===pid.value?"pass":"fail",
    details:{pid:pid.value,before:before,
      call:call.value+"/"+errno+"/"+call.high,
      after:after,pid_ok:pidAfter.high===0&&pidAfter.value===pid.value}};
}catch(error){
  result={id:"sys637_self_limit_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}
return [result];
