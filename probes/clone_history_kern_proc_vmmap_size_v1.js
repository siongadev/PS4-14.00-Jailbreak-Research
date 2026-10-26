// Size-only self VM-map query. {1,14,32,pid} comes from the upstream
// FreeBSD 9 KERN_PROC_VMMAP layout and is tested against live 14.00 behavior.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.sysctl ||
      typeof native.readErrno!=="function" || !native.frame ||
      !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("sysctl_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x420 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x200,0x420));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var returned,errno=0,length=0,lengthHigh=0,guards=false;
  phase="vmmap_size";
  if (api && typeof api.markSync==="function")
    api.markSync("vmmap_size_preflight");
  try {
    frame.fill(0xa5,0x200,0x420);
    dv.setUint32(0x200,0,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,32,true);
    dv.setUint32(0x40c,self.value,true);
    returned=native.call("sysctl",[address+0x400,4,0,
      address+0x200,0,0]);
    if (returned.value===-1) errno=native.readErrno();
    length=dv.getUint32(0x200,true);
    lengthHigh=dv.getUint32(0x204,true);
    guards=frame[0x208]===0xa5 && frame[0x20f]===0xa5 &&
      frame[0x410]===0xa5 && frame[0x41f]===0xa5 &&
      dv.getUint32(0x400,true)===1 &&
      dv.getUint32(0x404,true)===14 &&
      dv.getUint32(0x408,true)===32 &&
      dv.getUint32(0x40c,true)===self.value;
  } finally {
    for (var i=0;i<original.length;i++) frame[0x200+i]=original[i];
  }
  var restored=original.every(function (byte,index) {
    return frame[0x200+index]===byte;
  }) && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("vmmap_size_restored");
  result={id:"kern_proc_vmmap_size_v1",
    status:guards && restored &&
      (returned.value===0 || (returned.value===-1 &&
       returned.high===0xffffffff))?"pass":"fail",
    details:{self_pid:self.value,call_return:returned.value,
      errno:errno,size_bytes:length,size_high:lengthHigh,
      guards_intact:guards,carrier_restored:restored}};
} catch (error) {
  result={id:"kern_proc_vmmap_size_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
