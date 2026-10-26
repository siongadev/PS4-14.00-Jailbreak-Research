// Read the current process VM map and report mappings around the measured
// libSceSysCore RX base. Read-only; restores the sysctl frame.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  var plan=window.__fw14NativePlan;
  if (!native || !native.wrappers || !native.wrappers.sysctl ||
      !native.wrappers.dynlib_info_ex ||
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
  var spans=[],guards=false,regmgrBase=0;
  var windowStart=0,windowEnd=0;
  phase="vmmap_regmgr";
  if (api && typeof api.markSync==="function")
    api.markSync("regmgr_vmmap_preflight");
  try {
    frame.fill(0xa5,0x200,0x9020);
    dv.setUint32(0x800,0x1a8,true);
    var info=native.call("dynlib_info_ex",[48,0,address+0x800]);
    if (info.value!==0 || info.high!==0)
      throw new Error("regmgr_info_errno_"+native.readErrno());
    regmgrBase=dv.getUint32(0x910,true)+
      dv.getUint32(0x914,true)*4294967296;
    if (!Number.isSafeInteger(regmgrBase) ||
        regmgrBase<0x100000000 || regmgrBase>=0x100000000000 ||
        regmgrBase%0x4000!==0)
      throw new Error("regmgr_base_invalid");
    windowStart=Math.floor(regmgrBase/0x800000)*0x800000;
    windowEnd=windowStart+0x800000;
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
            end>start && start<windowEnd && end>windowStart) {
          var span="0x"+start.toString(16)+"-0x"+
            end.toString(16)+"/"+prot+"/"+type;
          var pathAt=at+136;
          if (frame[pathAt]===47) {
            var path="";
            while (pathAt<at+recordSize && frame[pathAt]!==0 &&
                   path.length<80)
              path+=String.fromCharCode(frame[pathAt++]);
            if (path.length>1) span+="|"+path;
          }
          spans.push(span);
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
    api.markSync("regmgr_vmmap_restored");
  var joined=spans.join("\n");
  var chunks=[];
  for (var n=0;n<4;n++) chunks.push(joined.slice(n*480,(n+1)*480));
  result={id:"regmgr_vmmap_range_v1",
    status:guards && restored &&
      (returned.value===-1 ||
       (returned.value===0 && length>0 &&
        length<=32768 && cursor===length))?"pass":"fail",
    details:{call_return:returned.value,
      errno:errno,size_bytes:length,entries:entries,
      regmgr_base:"0x"+regmgrBase.toString(16),
      range_count:spans.length,guard_and_restore:guards&&restored,
      range_0:chunks[0],range_1:chunks[1],
      range_2:chunks[2],range_3:chunks[3]}};
} catch (error) {
  result={id:"regmgr_vmmap_range_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
