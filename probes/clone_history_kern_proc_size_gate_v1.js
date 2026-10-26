// Size-only process-info queries for self, parent, and an absent PID.
// The numeric MIB is the stable/9 FreeBSD hypothesis {CTL_KERN,KERN_PROC,KERN_PROC_PID,pid}.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.sysctl ||
      typeof native.readErrno!=="function" ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("sysctl_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x500 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  var parent=native.call("getppid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000 ||
      parent.high!==0 || parent.value<1 || parent.value>100000 ||
      self.value===parent.value)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x200,0x410));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  function query(pid) {
    frame.fill(0xa5,0x200,0x210);
    frame.fill(0xa5,0x400,0x410);
    dv.setUint32(0x200,0,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,1,true);
    dv.setUint32(0x40c,pid,true);
    var returned=native.call("sysctl",[address+0x400,4,0,address+0x200,0,0]);
    var errno=returned.value===-1?native.readErrno():0;
    var length=dv.getUint32(0x200,true);
    var high=dv.getUint32(0x204,true);
    return {value:returned.value,high_return:returned.high,
      errno:errno,length:length,length_high:high,
      mib_intact:dv.getUint32(0x400,true)===1 &&
        dv.getUint32(0x404,true)===14 &&
        dv.getUint32(0x408,true)===1 &&
        dv.getUint32(0x40c,true)===pid,
      guards_intact:frame[0x208]===0xa5 && frame[0x20f]===0xa5};
  }
  phase="size_queries";
  if (api && typeof api.markSync==="function")
    api.markSync("proc_size_preflight");
  var selfResult,parentResult,absentResult;
  try {
    selfResult=query(self.value);
    parentResult=query(parent.value);
    absentResult=query(2147483647);
  } finally {
    for (var i=0;i<original.length;i++) frame[0x200+i]=original[i];
  }
  var restored=original.every(function (byte,index) {
    return frame[0x200+index]===byte;
  }) && state.array[0]===state.a;
  var shape=[selfResult,parentResult,absentResult].every(function (entry) {
    return entry.mib_intact && entry.guards_intact &&
      (entry.value===0 || (entry.value===-1 && entry.high_return===0xffffffff));
  });
  if (api && typeof api.markSync==="function")
    api.markSync("proc_size_restored");
  result={id:"kern_proc_size_gate_v1",status:shape&&restored?"pass":"fail",
    details:{self_pid:self.value,parent_pid:parent.value,
      self_return:selfResult.value,self_errno:selfResult.errno,
      self_length:selfResult.length,parent_return:parentResult.value,
      parent_errno:parentResult.errno,parent_length:parentResult.length,
      absent_return:absentResult.value,absent_errno:absentResult.errno,
      guards_intact:shape,carrier_restored:restored}};
} catch (error) {
  result={id:"kern_proc_size_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
