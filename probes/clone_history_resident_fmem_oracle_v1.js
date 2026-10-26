// Determine whether 615 can read the current process's resident FMEM
// through an owned output buffer after the 637 self-target call.
var result,phase="preflight",frame,saved,off=0x1800,end=0x1880;
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
  var rows=[],shapes=[
    {name:"pid_arg2",args:[pid.value,native.frameAddress+off,0,0,0,0]},
    {name:"self_arg2",args:[0,native.frameAddress+off,0,0,0,0]},
    {name:"pid_arg3",args:[pid.value,0,native.frameAddress+off,0,0,0]}
  ];
  for(var s=0;s<shapes.length;s++){
    phase=shapes[s].name;
    frame.fill(0xa5,off,end);
    if(api&&typeof api.markSync==="function")
      api.markSync("fmem615_before_"+s);
    var c=native.call("sys615",shapes[s].args);
    var e=c.value===-1?native.readErrno():0,changed=0,hex="",guard=true;
    for(var i=off;i<off+0x40;i++)if(frame[i]!==0xa5)changed++;
    for(var g=off+0x40;g<end;g++)if(frame[g]!==0xa5)guard=false;
    for(var h=0;h<16;h++)hex+=("0"+frame[off+h].toString(16)).slice(-2);
    rows.push(shapes[s].name+":"+c.value+"/"+e+"/"+changed+"/"+
      (guard?1:0)+"/"+hex);
    if(c.value===0||changed||!guard)break;
  }
  var after=native.call("getpid",[]);
  result={id:"resident_fmem_oracle_v1",
    status:after.high===0&&after.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|"),
      pid_ok:after.high===0&&after.value===pid.value}};
}catch(error){
  result={id:"resident_fmem_oracle_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}finally{
  if(frame&&saved)
    for(var r=0;r<saved.length;r++)frame[off+r]=saved[r];
}
return [result];
