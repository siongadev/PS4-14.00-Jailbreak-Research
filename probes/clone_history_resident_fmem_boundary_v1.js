// Compare 615 two-pointer output for self, live parent, and absent PID.
var result,phase="preflight",frame,saved,off=0x1800,end=0x1a80;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys615!=="number"||
      typeof native.wrappers.getppid!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(end>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(off,end));
  var pid=native.call("getpid",[]),parent=native.call("getppid",[]);
  if(pid.high!==0||parent.high!==0||pid.value<1||
      parent.value<1||pid.value===parent.value)
    throw new Error("pid_invalid");
  function u32(p){return (frame[p]|frame[p+1]<<8|
      frame[p+2]<<16|frame[p+3]*0x1000000)>>>0;}
  function sample(target){
    frame.fill(0xa5,off,end);
    var c=native.call("sys615",[target,
      native.frameAddress+0x1800,native.frameAddress+0x1900,0,0,0]);
    var e=c.value===-1?native.readErrno():0,guard=true,changed=0;
    for(var i=0x1800;i<0x1840;i++)if(frame[i]!==0xa5)changed++;
    for(var j=0x1900;j<0x1940;j++)if(frame[j]!==0xa5)changed++;
    for(var g=0x1840;g<0x1880;g++)if(frame[g]!==0xa5)guard=false;
    for(var h=0x1940;h<0x1980;h++)if(frame[h]!==0xa5)guard=false;
    return c.value+"/"+e+"/"+changed+"/"+(guard?1:0)+
      "/"+u32(0x1800)+"/"+u32(0x1900);
  }
  var self=sample(pid.value);
  phase="parent";
  if(api&&typeof api.markSync==="function")api.markSync("fmem615_parent_before");
  var other=sample(parent.value);
  phase="absent";
  var absent=sample(999999),after=native.call("getpid",[]);
  result={id:"resident_fmem_boundary_v1",
    status:after.high===0&&after.value===pid.value?"pass":"fail",
    details:{pid:pid.value,parent:parent.value,self:self,
      other:other,absent:absent,pid_ok:after.high===0&&after.value===pid.value}};
}catch(error){
  result={id:"resident_fmem_boundary_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}finally{
  if(frame&&saved)
    for(var r=0;r<saved.length;r++)frame[off+r]=saved[r];
}
return [result];
