// Check Sysmodule's source-derived retail path with an owned read-only open.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!n||!s||!m||!f||!n.wrappers.open||!n.wrappers.close||
     s.array[0]!==s.a||f.length<0x700)throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var path="/system/common/lib/libSceUserService.sprx",o=0x500,
    len=0x100,saved=Array.from(f.subarray(o,o+len));
  var fd=-1,ret=null,errno=0,closeRet=null,guard=false;
  try {
    f.fill(0xa5,o,o+len);
    for(var i=0;i<path.length;i++)f[o+i]=path.charCodeAt(i);
    f[o+path.length]=0;
    phase="read_only_open";
    ret=n.call("open",[n.frameAddress+o,0,0]);
    if(ret.value===-1)errno=n.readErrno();
    else if(ret.value>=0){fd=ret.value;closeRet=n.call("close",[fd]);}
    guard=Array.from(f.subarray(o+path.length+1,o+len)).every(function(x){return x===0xa5;});
  } finally {
    for(var j=0;j<saved.length;j++)f[o+j]=saved[j];
  }
  var after=n.call("getpid",[]),restored=saved.every(function(x,i){return f[o+i]===x;})&&
    s.array[0]===s.a&&after.value===pid.value&&after.high===0;
  result={id:"user_service_path_v1",status:guard&&restored?"pass":"fail",
    details:{pid:pid.value,open_ret:ret.value,errno:errno,
      fd:fd,close_ret:closeRet&&closeRet.value,guard:guard,restored:restored}};
} catch(error) {
  result={id:"user_service_path_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
