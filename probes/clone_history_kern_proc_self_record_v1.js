// Read only the current process's bounded 1,096-byte kern.proc.pid record.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.sysctl ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("sysctl_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0xb00 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x200,0xa68));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var returned,oldlen,structSize,pid72,guardIntact,chunks=[];
  function hexRange(start,count) {
    var hex="";
    for (var i=0;i<count;i++) {
      var byte=frame[0x600+start+i];
      hex+=(byte<16?"0":"")+byte.toString(16);
    }
    return hex;
  }
  phase="self_record";
  if (api && typeof api.markSync==="function")
    api.markSync("proc_record_preflight");
  try {
    frame.fill(0xa5,0x200,0x210);
    frame.fill(0xa5,0x400,0x410);
    frame.fill(0xa5,0x600,0xa68);
    dv.setUint32(0x200,1096,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,1,true);
    dv.setUint32(0x40c,self.value,true);
    returned=native.call("sysctl",[address+0x400,4,
      address+0x600,address+0x200,0,0]);
    oldlen=dv.getUint32(0x200,true);
    structSize=dv.getUint32(0x600,true);
    pid72=dv.getUint32(0x600+72,true);
    guardIntact=frame[0xa48]===0xa5 && frame[0xa67]===0xa5 &&
      frame[0x208]===0xa5 && frame[0x20f]===0xa5 &&
      dv.getUint32(0x400,true)===1 &&
      dv.getUint32(0x404,true)===14 &&
      dv.getUint32(0x408,true)===1 &&
      dv.getUint32(0x40c,true)===self.value;
    if (returned.value===0 && oldlen===1096) {
      for (var c=0;c<5;c++)
        chunks.push(hexRange(c*256,Math.min(256,1096-c*256)));
    }
  } finally {
    for (var x=0;x<original.length;x++) frame[0x200+x]=original[x];
  }
  var restored=original.every(function (byte,index) {
    return frame[0x200+index]===byte;
  }) && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("proc_record_restored");
  result={id:"kern_proc_self_record_v1",
    status:returned.value===0 && returned.high===0 &&
      oldlen===1096 && structSize===1096 &&
      pid72===self.value && guardIntact && restored?"pass":"fail",
    details:{self_pid:self.value,call_return:returned.value,
      oldlen:oldlen,struct_size:structSize,pid_at_72:pid72,
      guard_intact:guardIntact,carrier_restored:restored,
      bytes_0:chunks[0]||"",bytes_1:chunks[1]||"",
      bytes_2:chunks[2]||"",bytes_3:chunks[3]||"",
      bytes_4:chunks[4]||""}};
} catch (error) {
  result={id:"kern_proc_self_record_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
