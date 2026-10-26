// Resolve at most seven handles per command from the 14.00 module-list
// result. Each call writes into one guarded owned frame and restores it.
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
  var handles=[0,8193,2,16,18,19,20,22,23,24,25,26,27,28,
    29,44,46,47,48,49,58,59,60,61,72,73,83];
  var batch=window.__fw14DynlibInfoBatchV1;
  if (batch===undefined) batch=0;
  if (!Number.isInteger(batch) || batch<0 || batch>3)
    throw new Error("batch_out_of_range");
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var entries=[],guardIntact=true,restored=true;
  phase="module_info_batch";
  if (api && typeof api.markSync==="function")
    api.markSync("dynlib_info_batch_"+batch+"_preflight");
  for (var index=batch*7;index<Math.min(handles.length,(batch+1)*7);index++) {
    var original=Array.from(frame.subarray(0x300,0x520));
    var returned,errno=0,name="";
    try {
      frame.fill(0xa5,0x300,0x520);
      dv.setUint32(0x300,0x160,true);
      dv.setUint32(0x304,0,true);
      returned=native.call("dynlib_info",[handles[index],address+0x300]);
      if (returned.value===-1) errno=native.readErrno();
      if (frame[0x460]!==0xa5 || frame[0x47f]!==0xa5 ||
          frame[0x500]!==0xa5 || frame[0x51f]!==0xa5)
        guardIntact=false;
      if (returned.value===0) {
        for (var i=0;i<32 && frame[0x308+i]!==0;i++) {
          var byte=frame[0x308+i];
          if (byte<32 || byte>126) break;
          name+=String.fromCharCode(byte);
        }
      }
    } finally {
      for (var x=0;x<original.length;x++) frame[0x300+x]=original[x];
    }
    if (!original.every(function (byte,offset) {
      return frame[0x300+offset]===byte;
    })) restored=false;
    entries.push(handles[index]+":"+
      (returned.value===0?name:"errno"+errno));
    if (!guardIntact || !restored) break;
  }
  restored=restored && state.array[0]===state.a;
  if (guardIntact && restored && entries.length===
      Math.min(7,handles.length-batch*7))
    window.__fw14DynlibInfoBatchV1=batch+1;
  if (api && typeof api.markSync==="function")
    api.markSync("dynlib_info_batch_"+batch+"_restored");
  result={id:"dynlib_info_batch_v1",
    status:guardIntact && restored && entries.length===
      Math.min(7,handles.length-batch*7)?"pass":"fail",
    details:{self_pid:self.value,batch:batch,entries:entries.join(";"),
      count:entries.length,guard_intact:guardIntact,
      carrier_restored:restored}};
} catch (error) {
  result={id:"dynlib_info_batch_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
