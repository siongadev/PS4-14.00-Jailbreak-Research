// FreeBSD-9-shaped RTM_GET for 127.0.0.1, with an invalid-version
// control. No route change request is sent. All descriptors close.
var result,phase="preflight",frame,saved,fd=-1,base=0x1800,span=0x200;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys97!=="number"||
      typeof native.wrappers.write!=="number"||
      typeof native.wrappers.close!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1)throw new Error("pid_invalid");
  phase="route_open";
  var opened=native.call("sys97",[17,3,0,0,0,0]);
  var openErr=opened.value===-1?native.readErrno():0;
  if(opened.high!==0||opened.value<0||opened.value>=1024)
    throw new Error("route_open_"+opened.value+"_"+openErr);
  fd=opened.value;
  function lookup(version,label){
    frame.fill(0,base,base+168);
    frame.fill(0x5a,base+168,base+span);
    frame[base]=168;frame[base+1]=0;
    frame[base+2]=version;frame[base+3]=4;
    frame[base+12]=1; // RTA_DST
    frame[base+20]=1; // sequence
    frame[base+152]=16;frame[base+153]=2; // sockaddr_in
    frame[base+156]=127;frame[base+157]=0;
    frame[base+158]=0;frame[base+159]=1;
    phase=label;
    if(api&&typeof api.markSync==="function")api.markSync("route_get_before_"+label);
    var sent=native.call("write",[fd,native.frameAddress+base,168,0,0,0]);
    var err=sent.value===-1?native.readErrno():0;
    if(api&&typeof api.markSync==="function")api.markSync("route_get_after_"+label);
    var guard=true;
    for(var g=base+168;g<base+span;g++)if(frame[g]!==0x5a)guard=false;
    return sent.value+"/"+sent.high+"/"+err+"/"+guard;
  }
  var invalid=lookup(4,"invalid");
  var valid=lookup(5,"valid");
  phase="close";
  var closed=native.call("close",[fd,0,0,0,0,0]);
  var closeErr=closed.value===-1?native.readErrno():0;
  fd=-1;
  var end=native.call("getpid",[]);
  result={id:"route_get_gate_v1",
    status:closed.value===0&&end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,invalid:invalid,valid:valid,
      close:closed.value+"/"+closeErr}};
}catch(error){result={id:"route_get_gate_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{
  if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];
  if(fd>=0&&window.__fw14NativeInvoke)
    try{window.__fw14NativeInvoke.call("close",[fd,0,0,0,0,0]);}catch(ignore){}
}
return [result];
