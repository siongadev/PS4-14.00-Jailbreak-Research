// Guarded number-608 segment map for three current-page 14.00 modules that
// can expose alternative IPC or process-boundary interfaces.
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
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var handles=[27,28,48];
  var entries=[],guardIntact=true,restored=true;
  function word(offset) {
    return dv.getUint32(offset,true)+
      dv.getUint32(offset+4,true)*0x100000000;
  }
  phase="module_info_ex";
  if (api && typeof api.markSync==="function")
    api.markSync("boundary_modules_preflight");
  for (var n=0;n<handles.length;n++) {
    var original=Array.from(frame.subarray(0x300,0x700));
    var returned,errno=0,name="",segments="",segmentCount=0;
    try {
      frame.fill(0xa5,0x300,0x700);
      dv.setUint32(0x300,0x1a8,true);
      dv.setUint32(0x304,0,true);
      returned=native.call("dynlib_info_ex",[handles[n],0,address+0x300]);
      if (returned.value===-1) errno=native.readErrno();
      if (frame[0x4a8]!==0xa5 || frame[0x4bf]!==0xa5 ||
          frame[0x5ff]!==0xa5 || frame[0x6ff]!==0xa5)
        guardIntact=false;
      if (returned.value===0) {
        for (var i=0;i<64 && frame[0x308+i]!==0;i++) {
          var byte=frame[0x308+i];
          if (byte<32 || byte>126) break;
          name+=String.fromCharCode(byte);
        }
        segmentCount=dv.getUint32(0x4a0,true);
        if (segmentCount<=4)
          for (var s=0;s<segmentCount;s++) {
            var off=0x460+s*16;
            if (s) segments+=",";
            segments+="0x"+word(off).toString(16)+"/"+
              dv.getUint32(off+8,true).toString(16)+"/"+
              dv.getUint32(off+12,true).toString(16);
          }
      }
    } finally {
      for (var x=0;x<original.length;x++) frame[0x300+x]=original[x];
    }
    if (!original.every(function (byte,offset) {
      return frame[0x300+offset]===byte;
    })) restored=false;
    entries.push(handles[n]+":"+returned.value+":"+errno+":"+
      name+":"+segmentCount+":"+segments);
    if (!guardIntact || !restored) break;
  }
  restored=restored && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("boundary_modules_restored");
  result={id:"boundary_modules_info_v1",
    status:guardIntact && restored && entries.length===handles.length?
      "pass":"fail",
    details:{self_pid:self.value,entries:entries.join(";"),
      guard_intact:guardIntact,carrier_restored:restored}};
} catch (error) {
  result={id:"boundary_modules_info_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
