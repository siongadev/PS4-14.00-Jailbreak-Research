// Test whether 615(pid, out1, out2) completes its two-pointer copyout.
var result,phase="preflight",frame,saved,off=0x1800,end=0x1a80;
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
  frame.fill(0xa5,off,end);
  var a=native.frameAddress+0x1800,b=native.frameAddress+0x1900;
  phase="call615";
  if(api&&typeof api.markSync==="function")
    api.markSync("fmem615_two_before");
  var c=native.call("sys615",[pid.value,a,b,0,0,0]);
  var e=c.value===-1?native.readErrno():0;
  function row(start){
    var changed=0,hex="",guard=true;
    for(var i=start;i<start+0x40;i++)if(frame[i]!==0xa5)changed++;
    for(var g=start+0x40;g<start+0x80;g++)if(frame[g]!==0xa5)guard=false;
    for(var h=0;h<16;h++)hex+=("0"+frame[start+h].toString(16)).slice(-2);
    return changed+"/"+(guard?1:0)+"/"+hex;
  }
  var ra=row(0x1800),rb=row(0x1900),after=native.call("getpid",[]);
  result={id:"resident_fmem_layout_v2",
    status:after.high===0&&after.value===pid.value?"pass":"fail",
    details:{pid:pid.value,call:c.value+"/"+e,
      first:ra,second:rb,pid_ok:after.high===0&&after.value===pid.value}};
}catch(error){
  result={id:"resident_fmem_layout_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}finally{
  if(frame&&saved)
    for(var r=0;r<saved.length;r++)frame[off+r]=saved[r];
}
return [result];
