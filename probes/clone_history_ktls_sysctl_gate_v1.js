// Read-only prerequisite gate for the upstream KTLS receive-path issue.
var result,phase="preflight";
try{
  var native=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if(!native||!native.frame||!Number.isSafeInteger(native.frameAddress)||
      typeof native.wrappers.sysctl!=="number"||
      !state||state.array[0]!==state.a)
    throw new Error("caller_missing");
  var frame=native.frame,address=native.frameAddress;
  if(frame.length<0x9020||address<0x200000000||address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var pid=native.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  var original=Array.from(frame.subarray(0x200,0x920));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  function resolve(name){
    frame.fill(0xa5,0x200,0x920);
    dv.setUint32(0x200,64,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,0,true);
    dv.setUint32(0x404,3,true);
    for(var n=0;n<name.length;n++)frame[0x500+n]=name.charCodeAt(n);
    frame[0x500+name.length]=0;
    var c=native.call("sysctl",[address+0x400,2,
      address+0x600,address+0x200,address+0x500,name.length]);
    var errno=c.value===-1?native.readErrno():null;
    var length=dv.getUint32(0x200,true),oid=[];
    var guard=frame[0x208]===0xa5&&frame[0x20f]===0xa5&&
      frame[0x640]===0xa5&&frame[0x91f]===0xa5&&
      dv.getUint32(0x400,true)===0&&
      dv.getUint32(0x404,true)===3&&
      frame[0x500+name.length]===0;
    for(var j=0;j<name.length;j++)
      if(frame[0x500+j]!==name.charCodeAt(j))guard=false;
    if(!guard)throw new Error("resolve_guard_changed");
    if(c.value===0&&length>=4&&length<=64&&length%4===0)
      for(var k=0;k<length/4;k++)oid.push(dv.getUint32(0x600+k*4,true));
    return {ret:c.value,errno:errno===null?"ok":errno,
      length:length,oid:oid};
  }
  var control,candidate,readRet="skipped",readErr="skipped";
  var readLen=0,readHex="";
  try{
    phase="known_name";control=resolve("kern.osrelease");
    if(control.ret!==0||control.oid.length<2)
      throw new Error("known_name_control_failed");
    if(api&&typeof api.markSync==="function")
      api.markSync("ktls_sysctl_before");
    phase="ktls_name";candidate=resolve("kern.ipc.tls.enable");
    if(candidate.ret===0&&candidate.oid.length>=2){
      phase="ktls_read";
      frame.fill(0xa5,0x200,0x920);
      dv.setUint32(0x200,64,true);
      dv.setUint32(0x204,0,true);
      for(var q=0;q<candidate.oid.length;q++)
        dv.setUint32(0x400+q*4,candidate.oid[q],true);
      var c=native.call("sysctl",[address+0x400,
        candidate.oid.length,address+0x700,address+0x200,0,0]);
      readRet=c.value;readErr=c.value===-1?native.readErrno():"ok";
      readLen=dv.getUint32(0x200,true);
      if(c.value===0&&readLen<=16)
        for(var b=0;b<readLen;b++)
          readHex+=("0"+frame[0x700+b].toString(16)).slice(-2);
      if(frame[0x740]!==0xa5||frame[0x91f]!==0xa5)
        throw new Error("read_guard_changed");
    }
    if(api&&typeof api.markSync==="function")
      api.markSync("ktls_sysctl_after");
  }finally{
    for(var i=0;i<original.length;i++)frame[0x200+i]=original[i];
  }
  var restored=original.every(function(byte,index){
    return frame[0x200+index]===byte;})&&state.array[0]===state.a;
  result={id:"ktls_sysctl_gate_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,control_ret:control.ret,
      control_errno:control.errno,candidate_ret:candidate.ret,
      candidate_errno:candidate.errno,candidate_len:candidate.length,
      candidate_oid:candidate.oid.join(",")||"none",
      read_ret:readRet,read_errno:readErr,
      read_len:readLen,read_hex:readHex||"none",restored:restored}};
}catch(error){
  result={id:"ktls_sysctl_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
