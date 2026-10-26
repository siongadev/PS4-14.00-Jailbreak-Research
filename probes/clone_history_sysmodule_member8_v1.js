// Source-matched syscall 649 check: Sysmodule passes (own module handle, 8,
// pointer-to-pointer), then validates the returned parameter block.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!n||!s||!m||!f||!n.wrappers.sys649||
     s.array[0]!==s.a||!Number.isSafeInteger(n.frameAddress)||f.length<0x800)
    throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var matches=m.modules.filter(function(x){
    return x.name==="libSceSysmodule.sprx"&&x.handle>0;
  });
  if(matches.length!==1)throw new Error("sysmodule_handle_missing");
  var handle=matches[0].handle,o=0x500,len=16;
  var saved=Array.from(f.subarray(o,o+len));
  var call=null,low=0,high=0,guard=false;
  try {
    f.fill(0xa5,o,o+8);
    f.fill(0x5a,o+8,o+len);
    phase="member8_call";
    if(api&&api.markSync)api.markSync("sysmodule_member8_before");
    call=n.call("sys649",[handle,8,n.frameAddress+o]);
    if(api&&api.markSync)api.markSync("sysmodule_member8_after");
    var v=new DataView(f.buffer,f.byteOffset,f.byteLength);
    low=v.getUint32(o,true);
    high=v.getUint32(o+4,true);
    guard=Array.from(f.subarray(o+8,o+len)).every(function(x){return x===0x5a;});
  } finally {
    for(var i=0;i<saved.length;i++)f[o+i]=saved[i];
  }
  var after=n.call("getpid",[]);
  var restored=saved.every(function(x,i){return f[o+i]===x;})&&
    after.high===0&&after.value===pid.value&&s.array[0]===s.a;
  result={id:"sysmodule_member8_v1",status:call&&guard&&restored?"pass":"fail",
    details:{pid:pid.value,handle:handle,ret:call?call.value:null,
      ret_high:call?call.high:null,pointer_low:low,pointer_high:high,
      guard:guard,restored:restored}};
} catch(error) {
  result={id:"sysmodule_member8_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
