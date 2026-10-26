// Bounded 14.00 module-handle inventory. Number 592's name and prototype
// come from public PS4 SDK research; the live wrapper bytes are checked by
// native-invoke v10 before this probe runs. This does not load any module.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.dynlib_list ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("dynlib_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x620 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x300,0x620));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var returned,errno=0,count=0,countHigh=0,handles=[],guardIntact=false;
  phase="module_list";
  if (api && typeof api.markSync==="function")
    api.markSync("dynlib_list_preflight");
  try {
    frame.fill(0xa5,0x300,0x620);
    dv.setUint32(0x300,0,true);
    dv.setUint32(0x304,0,true);
    returned=native.call("dynlib_list",[address+0x400,64,address+0x300]);
    if (returned.value===-1) errno=native.readErrno();
    count=dv.getUint32(0x300,true);
    countHigh=dv.getUint32(0x304,true);
    guardIntact=frame[0x308]===0xa5 && frame[0x30f]===0xa5 &&
      frame[0x3ff]===0xa5 && frame[0x500]===0xa5 &&
      frame[0x51f]===0xa5 && frame[0x61f]===0xa5;
    if (returned.value===0 && countHigh===0 && count<=64)
      for (var i=0;i<count;i++) handles.push(dv.getInt32(0x400+i*4,true));
  } finally {
    for (var x=0;x<original.length;x++) frame[0x300+x]=original[x];
  }
  var restored=original.every(function (byte,index) {
    return frame[0x300+index]===byte;
  }) && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("dynlib_list_restored");
  result={id:"dynlib_list_v1",
    status:guardIntact && restored &&
      ((returned.value===0 && countHigh===0 && count<=64) ||
       (returned.value===-1 && returned.high===0xffffffff))?"pass":"fail",
    details:{self_pid:self.value,call_return:returned.value,
      errno:errno,count:count,count_high:countHigh,
      handles:handles.join(","),guard_intact:guardIntact,
      carrier_restored:restored}};
} catch (error) {
  result={id:"dynlib_list_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
