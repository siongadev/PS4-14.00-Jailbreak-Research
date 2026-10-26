// Read at most 0x840 bytes to sample the running browser's SELF metadata
// and first on-disk code segment without collecting the entire executable.
// The path and the open/read wrappers are measured from this 14.00 process.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.sysctl ||
      !native.wrappers.open || !native.wrappers.read ||
      !native.wrappers.close || !native.frame ||
      !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("native_file_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x1160 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x200,0x1160));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var pathReturn=null,pathErrno=0,pathLen=0,path="";
  var openReturn=null,openErrno=0,readReturn=null,readErrno=0;
  var closeReturn=null,metaHex="",codeHex="",guards=false;
  if (api && typeof api.markSync==="function")
    api.markSync("self_exe_preflight");
  try {
    frame.fill(0xa5,0x200,0x1160);
    dv.setUint32(0x200,512,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,12,true);
    dv.setUint32(0x40c,self.value,true);
    phase="path_query";
    var p=native.call("sysctl",[address+0x400,4,
      address+0x600,address+0x200,0,0]);
    pathReturn=p.value;
    if (p.value===-1) pathErrno=native.readErrno();
    pathLen=dv.getUint32(0x200,true);
    if (p.value===0) {
      if (pathLen<2 || pathLen>512 || frame[0x600]!==47 ||
          frame[0x600+pathLen-1]!==0)
        throw new Error("unexpected_executable_path_shape");
      for (var i=0;i<Math.min(pathLen-1,384);i++)
        path+=String.fromCharCode(frame[0x600+i]);
      phase="open_executable";
      var o=native.call("open",[address+0x600,0,0]);
      openReturn=o.value;
      if (o.value===-1) openErrno=native.readErrno();
      if (o.value>=3 && o.value<1024 && o.high===0) {
        try {
          phase="read_header";
          var r=native.call("read",[o.value,address+0x900,0x840]);
          readReturn=r.value;
          if (r.value===-1) readErrno=native.readErrno();
          if (r.value>=0x830 && r.value<=0x840) {
            for (var j=0;j<64;j++) {
              var metaByte=frame[0x900+0x7a0+j];
              var codeByte=frame[0x900+0x7f0+j];
              metaHex+=(metaByte<16?"0":"")+metaByte.toString(16);
              codeHex+=(codeByte<16?"0":"")+codeByte.toString(16);
            }
          }
        } finally {
          phase="close_executable";
          closeReturn=native.call("close",[o.value]).value;
        }
      }
    }
    guards=frame[0x208]===0xa5 && frame[0x20f]===0xa5 &&
      frame[0x800]===0xa5 && frame[0x81f]===0xa5 &&
      frame[0x1140]===0xa5 && frame[0x115f]===0xa5 &&
      dv.getUint32(0x400,true)===1 &&
      dv.getUint32(0x404,true)===14 &&
      dv.getUint32(0x408,true)===12 &&
      dv.getUint32(0x40c,true)===self.value;
  } finally {
    for (var x=0;x<original.length;x++) frame[0x200+x]=original[x];
  }
  var restored=original.every(function (byte,index) {
    return frame[0x200+index]===byte;
  }) && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("self_exe_restored");
  var validPath=pathReturn===0 || (pathReturn===-1 && pathErrno>0);
  var validOpen=openReturn===null ||
    (openReturn===-1 && openErrno>0) ||
    (openReturn>=3 && openReturn<1024 && closeReturn===0);
  var validRead=readReturn===null ||
    (readReturn===-1 && readErrno>0) ||
    (readReturn>=0 && readReturn<=0x840);
  result={id:"self_executable_segment_sample_v1",
    status:validPath && validOpen && validRead && guards && restored?
      "pass":"fail",
    details:{self_pid:self.value,path_return:pathReturn,
      path_length:pathLen,path:path,
      open_return:openReturn,errno:pathErrno||openErrno||readErrno,
      read_return:readReturn,close_return:closeReturn,
      meta_hex:metaHex,code_hex:codeHex,
      guard_and_restore:guards&&restored}};
} catch (error) {
  result={id:"self_executable_segment_sample_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
