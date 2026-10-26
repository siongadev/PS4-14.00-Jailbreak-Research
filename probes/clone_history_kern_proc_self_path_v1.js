// Read only the running 14.00 browser process's executable path.
// Numeric MIB {1,14,12,pid} is an upstream FreeBSD hypothesis; the
// observed return and guarded bytes determine whether Sony implements it.
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
  if (frame.length<0x820 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x200,0x820));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var returned,errno=0,oldlen=0,guardIntact=false,path="",hex="";
  phase="self_path";
  if (api && typeof api.markSync==="function")
    api.markSync("proc_path_preflight");
  try {
    frame.fill(0xa5,0x200,0x820);
    dv.setUint32(0x200,512,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,12,true);
    dv.setUint32(0x40c,self.value,true);
    returned=native.call("sysctl",[address+0x400,4,
      address+0x600,address+0x200,0,0]);
    if (returned.value===-1) errno=native.readErrno();
    oldlen=dv.getUint32(0x200,true);
    guardIntact=frame[0x208]===0xa5 && frame[0x20f]===0xa5 &&
      frame[0x800]===0xa5 && frame[0x81f]===0xa5 &&
      dv.getUint32(0x400,true)===1 &&
      dv.getUint32(0x404,true)===14 &&
      dv.getUint32(0x408,true)===12 &&
      dv.getUint32(0x40c,true)===self.value;
    if (returned.value===0 && oldlen>0 && oldlen<=512) {
      var end=0;
      while (end<oldlen && frame[0x600+end]!==0) end++;
      for (var i=0;i<Math.min(end,384);i++)
        path+=String.fromCharCode(frame[0x600+i]);
      for (var j=0;j<Math.min(oldlen,64);j++) {
        var byte=frame[0x600+j];
        hex+=(byte<16?"0":"")+byte.toString(16);
      }
    }
  } finally {
    for (var x=0;x<original.length;x++) frame[0x200+x]=original[x];
  }
  var restored=original.every(function (byte,index) {
    return frame[0x200+index]===byte;
  }) && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("proc_path_restored");
  result={id:"kern_proc_self_path_v1",
    status:guardIntact && restored &&
      (returned.value===0 || (returned.value===-1 &&
       returned.high===0xffffffff))?"pass":"fail",
    details:{self_pid:self.value,call_return:returned.value,
      errno:errno,oldlen:oldlen,path:path,raw_prefix:hex,
      guard_intact:guardIntact,carrier_restored:restored}};
} catch (error) {
  result={id:"kern_proc_self_path_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
