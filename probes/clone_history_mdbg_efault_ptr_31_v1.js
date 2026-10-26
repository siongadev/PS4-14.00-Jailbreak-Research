// 14.00 request-31 pointer gate: one owned buffer and a guarded readback.
var result,phase="preflight",frame,saved,base=0x800,len=0x100;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys601!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+len+0x40>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+len+0x40));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  frame.fill(0xa5,base,base+len+0x40);
  phase="request31";
  if(api&&typeof api.markSync==="function")api.markSync("mdbg31_ptr_before");
  var c=native.call("sys601",[31,native.frameAddress+base,0,0,0,0]);
  var errno=c.value===-1?native.readErrno():0;
  if(api&&typeof api.markSync==="function")api.markSync("mdbg31_ptr_after");
  var first=-1,changed=0,hex="",guard=true;
  for(var j=0;j<len;j++)if(frame[base+j]!==0xa5){
    if(first<0)first=j;
    changed++;
  }
  if(first>=0)for(var h=first;h<Math.min(first+16,len);h++)
    hex+=("0"+frame[base+h].toString(16)).slice(-2);
  for(var g=base+len;g<base+len+0x40;g++)
    if(frame[g]!==0xa5)guard=false;
  var end=native.call("getpid",[]);
  result={id:"mdbg_efault_ptr_31_v1",
    status:end.high===0&&end.value===pid.value&&guard?"pass":"fail",
    details:{pid:pid.value,ret:c.value,high:c.high,errno:errno,
      first:first,changed:changed,hex:hex,guard:guard}};
}catch(error){
  result={id:"mdbg_efault_ptr_31_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}finally{
  if(frame&&saved)
    for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];
}
return [result];
