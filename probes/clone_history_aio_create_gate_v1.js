// One bounded 14.00 syscall-668 entry check with null and owned output.
// The historical aio_create name is a hypothesis, not an ABI claim.
var result,phase="preflight",frame,saved,base=0x1800,span=0x180;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys668!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  function mark(s){if(api&&typeof api.markSync==="function")api.markSync(s);}
  var rows=[];
  for(var s=0;s<2;s++){
    phase="shape_"+s;
    frame.fill(0xa5,base,base+0x100);
    frame.fill(0x5a,base+0x100,base+span);
    mark("aio668_before_"+s);
    var c=native.call("sys668",[s?native.frameAddress+base:0,0,0,0,0,0]);
    var e=c.value===-1?native.readErrno():0;
    mark("aio668_after_"+s);
    var changed=0,guard=true,first=-1;
    for(var i=0;i<0x100;i++)if(frame[base+i]!==0xa5){
      if(first<0)first=i;changed++;}
    for(var j=base+0x100;j<base+span;j++)if(frame[j]!==0x5a)guard=false;
    rows.push(s+":"+c.value+"/"+e+"/"+changed+"/"+first+
      "/"+(guard?1:0));
  }
  var end=native.call("getpid",[]);
  result={id:"aio_create_gate_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|")}};
}catch(error){result={id:"aio_create_gate_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];}
return [result];
