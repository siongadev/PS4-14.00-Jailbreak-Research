// Characterize the two 615 output words with one 2 MiB touched allocation.
var result,phase="preflight",frame,saved,held,off=0x1800,end=0x1a80;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys615!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(end>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(off,end));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function u32(p){
    return (frame[p]|frame[p+1]<<8|frame[p+2]<<16|frame[p+3]*0x1000000)>>>0;
  }
  function sample(){
    frame.fill(0xa5,off,end);
    var c=native.call("sys615",[pid.value,
      native.frameAddress+0x1800,native.frameAddress+0x1900,0,0,0]);
    var e=c.value===-1?native.readErrno():0;
    var guard=true;
    for(var i=0x1840;i<0x1880;i++)if(frame[i]!==0xa5)guard=false;
    for(var j=0x1940;j<0x1980;j++)if(frame[j]!==0xa5)guard=false;
    return c.value+"/"+e+"/"+u32(0x1800)+"/"+u32(0x1804)+
      "/"+u32(0x1900)+"/"+u32(0x1904)+"/"+(guard?1:0);
  }
  var before=sample();
  phase="alloc";
  if(api&&typeof api.markSync==="function")api.markSync("fmem_delta_before_alloc");
  held=new Uint8Array(2*1048576);
  for(var p=0;p<held.length;p+=4096)held[p]=0x5a;
  held[held.length-1]=0xa5;
  if(held[0]!==0x5a||held[held.length-1]!==0xa5)
    throw new Error("held_buffer_wrong");
  phase="measure";
  if(api&&typeof api.markSync==="function")api.markSync("fmem_delta_after_alloc");
  var after=sample(),pidAfter=native.call("getpid",[]);
  result={id:"resident_fmem_delta_v1",
    status:pidAfter.high===0&&pidAfter.value===pid.value?"pass":"fail",
    details:{pid:pid.value,before:before,after:after,
      held_bytes:held.length,pid_ok:pidAfter.high===0&&pidAfter.value===pid.value}};
}catch(error){
  result={id:"resident_fmem_delta_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}finally{
  held=null;
  if(frame&&saved)
    for(var r=0;r<saved.length;r++)frame[off+r]=saved[r];
}
return [result];
