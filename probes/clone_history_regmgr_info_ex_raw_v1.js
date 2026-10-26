// Capture one complete, guarded 0x1a8-byte 14.00 module-info-ex record for
// SysCore handle 28. Split the raw bytes to fit the collector limit.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.dynlib_info_ex ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("dynlib_info_ex_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x700 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x300,0x700));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var returned,errno=0,guardIntact=false,parts=[];
  phase="module_info_ex_raw";
  if (api && typeof api.markSync==="function")
    api.markSync("regmgr_info_raw_preflight");
  try {
    frame.fill(0xa5,0x300,0x700);
    dv.setUint32(0x300,0x1a8,true);
    dv.setUint32(0x304,0,true);
    returned=native.call("dynlib_info_ex",[48,0,address+0x300]);
    if (returned.value===-1) errno=native.readErrno();
    guardIntact=frame[0x4a8]===0xa5 && frame[0x4bf]===0xa5 &&
      frame[0x5ff]===0xa5 && frame[0x6ff]===0xa5;
    if (returned.value===0) {
      for (var p=0;p<3;p++) {
        var start=0x300+p*160;
        var end=Math.min(0x300+0x1a8,start+160);
        var text="";
        for (var i=start;i<end;i++) text+=String.fromCharCode(frame[i]);
        parts.push(btoa(text));
      }
    }
  } finally {
    for (var x=0;x<original.length;x++) frame[0x300+x]=original[x];
  }
  var restored=original.every(function (byte,index) {
    return frame[0x300+index]===byte;
  }) && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("regmgr_info_raw_restored");
  result={id:"regmgr_info_ex_raw_v1",
    status:guardIntact && restored && returned.value===0 &&
      parts.length===3?"pass":"fail",
    details:{self_pid:self.value,module_handle:48,
      call_return:returned.value,errno:errno,
      raw0:parts[0]||"",raw1:parts[1]||"",raw2:parts[2]||"",
      guard_intact:guardIntact,carrier_restored:restored}};
} catch (error) {
  result={id:"regmgr_info_ex_raw_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
