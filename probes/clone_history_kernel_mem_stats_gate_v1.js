// Read-only, guarded output check for the live number-646 wrapper.
var result,phase="preflight",frame,saved,off=0x1800,end=0x1a00;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys646!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(end>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(off,end));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  frame.fill(0xa5,off,end);
  phase="call";
  if(api&&typeof api.markSync==="function")api.markSync("kstats646_before");
  var call=native.call("sys646",[
    native.frameAddress+off,0x100,0,0,0,0]);
  if(api&&typeof api.markSync==="function")api.markSync("kstats646_after");
  var errno=call.value===-1?native.readErrno():0;
  var changed=0,first="",guard=true;
  for(var i=off;i<off+0x100;i++){
    if(frame[i]!==0xa5)changed++;
    if(i<off+16)first+=("0"+frame[i].toString(16)).slice(-2);
  }
  for(var j=off+0x100;j<end;j++)if(frame[j]!==0xa5)guard=false;
  var after=native.call("getpid",[]);
  result={id:"kernel_mem_stats_gate_v1",
    status:guard&&after.high===0&&after.value===pid.value?"pass":"fail",
    details:{pid:pid.value,ret:call.value,errno:errno,
      changed:changed,first16:first,guard:guard,
      pid_ok:after.high===0&&after.value===pid.value}};
}catch(error){
  result={id:"kernel_mem_stats_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}finally{
  if(frame&&saved)
    for(var r=0;r<saved.length;r++)frame[off+r]=saved[r];
}
return [result];
