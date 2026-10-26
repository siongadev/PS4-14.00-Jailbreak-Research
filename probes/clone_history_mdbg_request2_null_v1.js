// Isolate the previously observed selector-2 error from selector-3's warning.
var result,phase="preflight";
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys601!=="number"||
      typeof native.wrappers.sys585!=="number"||
      typeof native.wrappers.sys606!=="number"||
      typeof native.wrappers.sys600!=="number")
    throw new Error("caller_missing");
  function read(name){var c=native.call(name,[0,0,0,0,0,0]);
    return c.value+(c.value===-1?"/"+native.readErrno():"");}
  function baseline(){return [read("sys585"),read("sys606"),
    read("sys600")].join(",");}
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  var before=baseline();
  phase="selector_2";
  if(api&&typeof api.markSync==="function")api.markSync("mdbg2_null_before");
  var call=native.call("sys601",[2,0,0,0,0,0]);
  var errno=call.value===-1?native.readErrno():null;
  if(api&&typeof api.markSync==="function")api.markSync("mdbg2_null_after");
  var after=baseline(),end=native.call("getpid",[]);
  result={id:"mdbg_request2_null_v1",
    status:end.value===pid.value&&end.high===0?"pass":"fail",
    details:{pid:pid.value,ret:call.value,high:call.high,
      errno:errno===null?"ok":errno,before:before,after:after}};
}catch(error){
  result={id:"mdbg_request2_null_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}
return [result];
