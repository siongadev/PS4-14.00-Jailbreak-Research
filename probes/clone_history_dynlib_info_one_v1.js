// Identify one handle from the same-page 14.00 module-list capture. The
// older SDK's 0x160-byte record is a hypothesis; guards determine whether
// the live number-593 call writes only inside the owned output frame.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.dynlib_info ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("dynlib_info_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x520 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x300,0x520));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var handle=8193,returned,errno=0,name="",codeBaseLow=0,
      codeBaseHigh=0,codeSize=0,guardIntact=false;
  phase="module_info";
  if (api && typeof api.markSync==="function")
    api.markSync("dynlib_info_preflight");
  try {
    frame.fill(0xa5,0x300,0x520);
    dv.setUint32(0x300,0x160,true);
    dv.setUint32(0x304,0,true);
    returned=native.call("dynlib_info",[handle,address+0x300]);
    if (returned.value===-1) errno=native.readErrno();
    guardIntact=frame[0x460]===0xa5 && frame[0x47f]===0xa5 &&
      frame[0x500]===0xa5 && frame[0x51f]===0xa5;
    if (returned.value===0) {
      for (var i=0;i<32 && frame[0x308+i]!==0;i++) {
        var byte=frame[0x308+i];
        if (byte<32 || byte>126) break;
        name+=String.fromCharCode(byte);
      }
      codeBaseLow=dv.getUint32(0x408,true);
      codeBaseHigh=dv.getUint32(0x40c,true);
      codeSize=dv.getUint32(0x410,true);
    }
  } finally {
    for (var x=0;x<original.length;x++) frame[0x300+x]=original[x];
  }
  var restored=original.every(function (byte,index) {
    return frame[0x300+index]===byte;
  }) && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("dynlib_info_restored");
  result={id:"dynlib_info_one_v1",
    status:guardIntact && restored &&
      (returned.value===0 ||
       (returned.value===-1 && returned.high===0xffffffff))?"pass":"fail",
    details:{self_pid:self.value,handle:handle,
      call_return:returned.value,errno:errno,name:name,
      code_base_low:codeBaseLow,code_base_high:codeBaseHigh,
      code_size:codeSize,guard_intact:guardIntact,
      carrier_restored:restored}};
} catch (error) {
  result={id:"dynlib_info_one_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
