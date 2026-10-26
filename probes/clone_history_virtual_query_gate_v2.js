// Read-only ABI discriminator for the measured 14.00 number-572 wrapper.
// Historical PS4 research used (address, flags, output, output size).
// Compare a mapped address in this page's owned frame with null.
var result,phase="preflight",frame,saved,base=0x1800,span=0x100;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys572!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1)throw new Error("pid_invalid");
  frame.fill(0xa5,base,base+0x40);
  frame.fill(0x5a,base+0x40,base+span);
  phase="mapped_query";
  if(api&&typeof api.markSync==="function")api.markSync("vq572_before_mapped");
  var mapped=native.call("sys572",[
    native.frameAddress+0x800,0,native.frameAddress+base,0x40,0,0]);
  var mappedErr=mapped.value===-1?native.readErrno():0;
  if(api&&typeof api.markSync==="function")api.markSync("vq572_after_mapped");
  var changed=[];
  for(var i=0;i<0x40;i++)if(frame[base+i]!==0xa5)
    changed.push([i,frame[base+i]]);
  phase="null_query";
  var invalid=native.call("sys572",[
    0,0,native.frameAddress+base,0x40,0,0]);
  var invalidErr=invalid.value===-1?native.readErrno():0;
  var guard=true;
  for(var g=base+0x40;g<base+span;g++)
    if(frame[g]!==0x5a)guard=false;
  var end=native.call("getpid",[]);
  result={id:"virtual_query_gate_v2",
    status:guard&&end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,mapped:mapped.value+"/"+mappedErr,
      invalid:invalid.value+"/"+invalidErr,
      changed_count:changed.length,first_changed:changed.slice(0,24).map(function(x){return x[0].toString(16)+":"+x[1].toString(16)}).join(","),
      guard:guard}};
}catch(error){result={id:"virtual_query_gate_v2",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];}
return [result];
