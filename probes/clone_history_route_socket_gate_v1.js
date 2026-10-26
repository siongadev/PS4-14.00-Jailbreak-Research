// Check only socket-family reachability. No route message is sent.
// AF_ROUTE=17 and SOCK_RAW=3 follow historical FreeBSD constants.
var result,phase="preflight";
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys97!=="number"||
      typeof native.wrappers.close!=="number")
    throw new Error("caller_missing");
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1)throw new Error("pid_invalid");
  var rows=[],clean=true;
  function one(label,family,type,protocol){
    phase=label;
    if(api&&typeof api.markSync==="function")api.markSync("route_before_"+label);
    var opened=native.call("sys97",[family,type,protocol,0,0,0]);
    var err=opened.value===-1?native.readErrno():0;
    var closeRet="none";
    if(opened.value>=0&&opened.value<1024&&opened.high===0){
      var closed=native.call("close",[opened.value,0,0,0,0,0]);
      var closeErr=closed.value===-1?native.readErrno():0;
      closeRet=closed.value+"/"+closeErr;
      if(closed.value!==0)clean=false;
    }else if(opened.value!==-1)clean=false;
    rows.push(label+":"+opened.value+"/"+opened.high+"/"+err+"/"+closeRet);
    if(api&&typeof api.markSync==="function")api.markSync("route_after_"+label);
  }
  one("inet",2,1,0);
  one("invalid",255,3,0);
  one("route",17,3,0);
  var end=native.call("getpid",[]);
  result={id:"route_socket_gate_v1",
    status:clean&&end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join(";"),clean:clean}};
}catch(error){result={id:"route_socket_gate_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
return [result];
