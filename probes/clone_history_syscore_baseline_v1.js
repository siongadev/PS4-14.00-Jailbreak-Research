var result;
var phase="preflight";
try {
  var state=window.__fw14ArrayState;
  var plan=window.__fw14NativePlan;
  var native=window.__fw14NativeInvoke;
  if (!state || !plan || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !Number.isSafeInteger(state.calibratedViewBase) ||
      state.array[0]!==state.a || !plan.store || !plan.pivot ||
      !plan.stack || !plan.frame || !plan.addresses ||
      !plan.functionSlot || !plan.pivotCell || !plan.pivotObject ||
      !Number.isSafeInteger(plan.target) ||
      !Number.isSafeInteger(plan.webkitBase) ||
      !native || !native.wrappers || !native.wrappers.sysctl ||
      !native.frame || !Number.isSafeInteger(native.frameAddress))
    throw new Error("baseline_plan_missing");
  var forged=state.view;
  var carrier=state.ownedTypedView;
  var base=state.calibratedViewBase;
  if (carrier.length!==65536 || carrier[0]!==0x31 ||
      carrier[7]!==0xa8 || base%4096!==0)
    throw new Error("carrier_canary_changed");
  function bytesAt(index,count) {
    var out=[];
    for (var n=0;n<count;n++) out.push(forged[index+n]);
    return out;
  }
  function valueOf(bytes) {
    var value=0;
    for (var n=bytes.length-1;n>=0;n--)
      value=value*256+bytes[n];
    return value;
  }
  function pointerBytes(value) {
    if (!Number.isSafeInteger(value) || value<0 ||
        value>=0x1000000000000)
      throw new Error("pointer_invalid");
    var out=[];
    for (var n=0;n<8;n++)
      out.push(Math.floor(value/Math.pow(2,n*8))&255);
    return out;
  }
  function same(left,right) {
    if (!left || !right || left.length!==right.length) return false;
    for (var n=0;n<left.length;n++)
      if (left[n]!==right[n]) return false;
    return true;
  }
  function addressOf(object) {
    try {
      state.array[0]=object;
      return valueOf(bytesAt(state.index,8));
    } finally {
      state.array[0]=state.a;
    }
  }
  var carrierIndex=addressOf(carrier)-base;
  var carrierSlot=carrierIndex+8;
  if (!Number.isSafeInteger(carrierSlot) || carrierSlot<0 ||
      carrierSlot+8>=16777216)
    throw new Error("carrier_slot_invalid");
  var carrierOriginal=bytesAt(carrierSlot,8);
  function readAt(address,count) {
    if (!Number.isSafeInteger(address) || address<0x100000000 ||
        address>=0x1000000000000 || count<1 || count>192)
      throw new Error("native_read_invalid");
    var next=pointerBytes(address);
    try {
      for (var n=0;n<8;n++) forged[carrierSlot+n]=next[n];
      var out=[];
      for (var r=0;r<count;r++) out.push(carrier[r]);
      return out;
    } finally {
      for (var x=0;x<8;x++)
        forged[carrierSlot+x]=carrierOriginal[x];
    }
  }
  function hexOf(bytes) {
    var text="";
    for (var i=0;i<bytes.length;i++)
      text+=bytes[i].toString(16).padStart(2,"0");
    return text;
  }
  function stringAt(address) {
    if (!Number.isSafeInteger(address) || address<0x100000000 ||
        address>=0x1000000000000)
      return "";
    var bytes=readAt(address,0x40);
    var text="";
    for (var i=0;i<bytes.length;i++) {
      if (bytes[i]===0) break;
      text+=String.fromCharCode(bytes[i]);
    }
    return text.replace(/[^\x20-\x7e]/g,".");
  }
  var frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x9020 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var pid0=native.call("getpid",[]);
  if (pid0.high!==0 || pid0.value<1 || pid0.value>100000)
    throw new Error("pid_control_invalid");
  var scratchOffset=0x300;
  var syscoreBase=0;
  var original=Array.from(frame.subarray(scratchOffset,scratchOffset+0x1a8));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  try {
    frame.fill(0,scratchOffset,scratchOffset+0x1a8);
    dv.setUint32(scratchOffset,0x1a8,true);
    dv.setUint32(scratchOffset+4,0,true);
    var info=native.call("dynlib_info_ex",[28,0,address+scratchOffset]);
    if (info.value===0) {
      var lo=dv.getUint32(scratchOffset+0x110,true);
      var hi=dv.getUint32(scratchOffset+0x114,true);
      syscoreBase=hi*0x100000000+lo;
    } else {
      throw new Error("module_info_failed");
    }
  } finally {
    for (var x=0;x<original.length;x++) frame[scratchOffset+x]=original[x];
  }
  if (syscoreBase<0x800000000 || syscoreBase>=0x900000000 ||
      syscoreBase%4096!==0)
    throw new Error("syscore_base_invalid");
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_baseline_preflight");
  var windowStart=syscoreBase-0x100000;
  var windowEnd=syscoreBase+0x100000;
  var vmOriginal=Array.from(frame.subarray(0x200,0x9020));
  var vmDv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var spans=[];
  try {
    frame.fill(0xa5,0x200,0x9020);
    vmDv.setUint32(0x200,32768,true);
    vmDv.setUint32(0x204,0,true);
    vmDv.setUint32(0x400,1,true);
    vmDv.setUint32(0x404,14,true);
    vmDv.setUint32(0x408,32,true);
    vmDv.setUint32(0x40c,pid0.value,true);
    var vmCall=native.call("sysctl",[address+0x400,4,
      address+0x1000,address+0x200,0,0]);
    var length=vmDv.getUint32(0x200,true);
    if (vmCall.value===0 && length>0 && length<=32768) {
      var cursor=0,entries=0;
      while (cursor+136<=length && entries<500) {
        var recordSize=vmDv.getUint32(0x1000+cursor,true);
        if (recordSize<136 || recordSize>1160 ||
            cursor+recordSize>length) break;
        var at=0x1000+cursor;
        var start=vmDv.getUint32(at+8,true)+
          vmDv.getUint32(at+12,true)*4294967296;
        var end=vmDv.getUint32(at+16,true)+
          vmDv.getUint32(at+20,true)*4294967296;
        var prot=vmDv.getUint32(at+56,true);
        var type=vmDv.getUint32(at+4,true);
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
    for (var vi=0;vi<vmOriginal.length;vi++) frame[0x200+vi]=vmOriginal[vi];
  }
  var rw=syscoreBase+0xc000;
  var region=readAt(rw+0x38,0x60);
  var nameApp=stringAt(valueOf(region.slice(0,8)));
  var nameApp2=stringAt(valueOf(region.slice(0x18,0x20)));
  var appClient=valueOf(region.slice(0x10,0x18));
  var app2Client=valueOf(region.slice(0x28,0x30));
  var flags=region[0x50].toString(16)+"/"+region[0x51].toString(16)+"/"+
    region[0x52].toString(16);
  var after=native.call("getpid",[]);
  var restored=same(bytesAt(carrierSlot,8),carrierOriginal) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12;
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_baseline_restored");
  result={id:"syscore_baseline_v1",
    status:(after.value===pid0.value && after.high===0 &&
      restored)?"pass":"fail",
    details:{self_pid:after.value,syscore_base:syscoreBase,
      flags:flags,region_hex:hexOf(region),
      name_app:nameApp,name_app2:nameApp2,
      app_client:appClient,app2_client:app2Client,
      vmmap:spans.join(";").slice(0,500),
      restored:restored}};
} catch (error) {
  result={id:"syscore_baseline_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
