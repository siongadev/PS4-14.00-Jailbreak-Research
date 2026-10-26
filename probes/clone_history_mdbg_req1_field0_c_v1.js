// Bounded 14.00 request-1 first-field differential with an absent name.
var result,phase="preflight",frame,saved,base=0x1800,span=0x180;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys601!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  var name="Fw14NoSuchMdbgObj",values=[0x1000,0x4000,0x5000,0x10000,0xffffffff];
  var rows=[],changedBranch="none";
  for(var s=0;s<values.length;s++){
    var value=values[s];phase="first_field_"+value;
    frame.fill(0,base,base+0x100);
    frame.fill(0xa5,base+0x100,base+span);
    for(var j=0;j<name.length;j++)
      frame[base+0x28+j]=name.charCodeAt(j);
    frame[base]=value&255;
    frame[base+1]=(value>>>8)&255;
    frame[base+2]=(value>>>16)&255;
    frame[base+3]=(value>>>24)&255;
    var before=Array.from(frame.subarray(base,base+0x100));
    if(api&&typeof api.markSync==="function")
      api.markSync("mdbg1_c_before_"+s);
    var c=native.call("sys601",[1,native.frameAddress+base,0,0,0,0]);
    var e=c.value===-1?native.readErrno():0;
    var changed=0,guard=true;
    for(var k=0;k<0x100;k++)if(frame[base+k]!==before[k])changed++;
    for(var g=base+0x100;g<base+span;g++)
      if(frame[g]!==0xa5)guard=false;
    rows.push(value.toString(16)+":"+c.value+"/"+e+"/"+
      changed+"/"+(guard?1:0));
    if(!guard||c.value!==-1||e!==22||changed!==0){
      changedBranch=value.toString(16);break;
    }
  }
  var end=native.call("getpid",[]);
  result={id:"mdbg_req1_field0_c_v1",
    status:end.high===0&&end.value===pid.value?"pass":"fail",
    details:{pid:pid.value,rows:rows.join("|"),
      first_change:changedBranch}};
}catch(error){
  result={id:"mdbg_req1_field0_c_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,160)}};
}finally{
  if(frame&&saved)
    for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];
}
return [result];
