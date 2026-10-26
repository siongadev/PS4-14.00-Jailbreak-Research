// Test 14.00 Sysmodule table ID 0x80000011 (libSceUserService).
// Compare module handles before and after; do not unload any resident module.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState,
    m=window.__fw14BulkMapAll,f=n&&n.frame;
  if(!n||!s||!m||!f||!n.wrappers.sysmodule_load_id||
     !n.wrappers.dynlib_list||s.array[0]!==s.a||f.length<0x800||
     !Number.isSafeInteger(n.frameAddress))throw new Error("plan_missing");
  var pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value!==m.pid)throw new Error("pid_map_mismatch");
  var mod=m.modules.filter(function(x){return x.handle===16&&
    x.name==="libSceSysmodule.sprx";})[0];
  if(!mod)throw new Error("sysmodule_not_mapped");
  var o=0x300,len=0x320,saved=Array.from(f.subarray(o,o+len));
  var dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  function list(){
    f.fill(0xa5,o,o+len);
    dv.setUint32(o,0,true);dv.setUint32(o+4,0,true);
    var c=n.call("dynlib_list",[n.frameAddress+0x400,64,n.frameAddress+o]);
    if(c.value!==0||c.high!==0)throw new Error("list_failed_"+c.value);
    var count=dv.getUint32(o,true),high=dv.getUint32(o+4,true);
    if(high!==0||count>64||f[o+8]!==0xa5||f[o+0xff]!==0xa5||
       f[o+0x300]!==0xa5)throw new Error("list_guard_failed");
    var handles=[];
    for(var i=0;i<count;i++)handles.push(dv.getInt32(0x400+i*4,true));
    return handles;
  }
  var before,after,call;
  try {
    phase="baseline_list";before=list();
    phase="user_service_load";
    if(api&&api.markSync)api.markSync("sysmodule_user_service_before");
    call=n.call("sysmodule_load_id",[0x80000011,0,0,0]);
    if(api&&api.markSync)api.markSync("sysmodule_user_service_after");
    phase="after_list";after=list();
  } finally {
    for(var k=0;k<saved.length;k++)f[o+k]=saved[k];
  }
  var extras=after.filter(function(h){return before.indexOf(h)<0;});
  var afterPid=n.call("getpid",[]);
  var restored=saved.every(function(x,i){return f[o+i]===x;})&&
    s.array[0]===s.a&&afterPid.high===0&&afterPid.value===pid.value;
  result={id:"sysmodule_user_service_load_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,ret:call.value,ret_high:call.high,
      before_count:before.length,after_count:after.length,
      new_handles:extras.join(","),restored:restored}};
} catch(error) {
  result={id:"sysmodule_user_service_load_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
