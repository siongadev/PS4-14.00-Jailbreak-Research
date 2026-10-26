// Read the current browser's bounded VM map and report mappings around
// its live 0x1730000 launcher text and adjacent data.
// Record field offsets follow the FreeBSD 9 kinfo_vmentry hypothesis;
// the exact record lengths and paths are checked in the 14.00 output.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  var plan=window.__fw14NativePlan;
  if (!native || !native.wrappers || !native.wrappers.sysctl ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a || !plan ||
      !Number.isSafeInteger(plan.target) ||
      !Number.isSafeInteger(plan.webkitBase))
    throw new Error("sysctl_plan_missing");
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x9020 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var self=native.call("getpid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000)
    throw new Error("pid_control_invalid");
  var original=Array.from(frame.subarray(0x200,0x9020));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var returned,errno=0,length=0,entries=0,cursor=0;
  var low=[],guards=false;
  phase="vmmap_low";
  if (api && typeof api.markSync==="function")
    api.markSync("vmmap_low_preflight");
  try {
    frame.fill(0xa5,0x200,0x9020);
    dv.setUint32(0x200,32768,true);
    dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);
    dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,32,true);
    dv.setUint32(0x40c,self.value,true);
    returned=native.call("sysctl",[address+0x400,4,
      address+0x1000,address+0x200,0,0]);
    if (returned.value===-1) errno=native.readErrno();
    length=dv.getUint32(0x200,true);
    guards=frame[0x208]===0xa5 && frame[0x20f]===0xa5 &&
      frame[0x9000]===0xa5 && frame[0x901f]===0xa5 &&
      dv.getUint32(0x400,true)===1 &&
      dv.getUint32(0x404,true)===14 &&
      dv.getUint32(0x408,true)===32 &&
      dv.getUint32(0x40c,true)===self.value;
    if (returned.value===0 && length>0 && length<=32768) {
      while (cursor+136<=length && entries<500) {
        var recordSize=dv.getUint32(0x1000+cursor,true);
        if (recordSize<136 || recordSize>1160 ||
            cursor+recordSize>length) break;
        var at=0x1000+cursor;
        var start=dv.getUint32(at+8,true)+
          dv.getUint32(at+12,true)*4294967296;
        var end=dv.getUint32(at+16,true)+
          dv.getUint32(at+20,true)*4294967296;
        var prot=dv.getUint32(at+56,true);
        var type=dv.getUint32(at+4,true);
        if (Number.isSafeInteger(start) && Number.isSafeInteger(end) &&
            end>start && start>=0x1700000 && start<0x1800000) {
          var span="0x"+start.toString(16)+"-0x"+
            end.toString(16)+"/"+prot+"/"+type;
          low.push(span);
        }
        cursor+=recordSize;
        entries++;
      }
    }
  } finally {
    for (var i=0;i<original.length;i++) frame[0x200+i]=original[i];
  }
  var restored=original.every(function (byte,index) {
    return frame[0x200+index]===byte;
  }) && state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("vmmap_low_restored");
  var joined=low.join("\n");
  var chunks=[];
  for (var n=0;n<4;n++) chunks.push(joined.slice(n*480,(n+1)*480));
  result={id:"kern_proc_vmmap_low_v1",
    status:guards && restored &&
      (returned.value===-1 ||
       (returned.value===0 && length>0 &&
        length<=32768 && cursor===length))?"pass":"fail",
    details:{call_return:returned.value,
      errno:errno,size_bytes:length,entries:entries,
      low_count:low.length,guard_and_restore:guards&&restored,
      low_0:chunks[0],low_1:chunks[1],
      low_2:chunks[2],low_3:chunks[3]}};
} catch (error) {
  result={id:"kern_proc_vmmap_low_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
