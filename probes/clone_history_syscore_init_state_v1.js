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
      !Number.isSafeInteger(plan.webkitBase))
    throw new Error("held_plan_missing");
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
        address>=0x1000000000000 || address%8!==0)
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
  if (frame.length<0x700 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  var scratchOffset=0x300;
  var original=Array.from(frame.subarray(scratchOffset,scratchOffset+0x1a8));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  var info;
  try {
    frame.fill(0,scratchOffset,scratchOffset+0x1a8);
    dv.setUint32(scratchOffset,0x1a8,true);
    dv.setUint32(scratchOffset+4,0,true);
    info=native.call("dynlib_info_ex",[28,0,address+scratchOffset]);
    var syscoreBase=0;
    if (info.value===0) {
      var lo=dv.getUint32(scratchOffset+0x110,true);
      var hi=dv.getUint32(scratchOffset+0x114,true);
      syscoreBase=hi*0x100000000+lo;
    }
  } finally {
    for (var x=0;x<original.length;x++) frame[scratchOffset+x]=original[x];
  }
  if (info.value!==0 || syscoreBase<0x800000000 ||
      syscoreBase>=0x900000000 || syscoreBase%4096!==0)
    throw new Error("syscore_info_invalid");
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_init_state_preflight");
  var rw=syscoreBase+0xc000;
  var first=readAt(rw+0x38,0x40);
  var second=readAt(rw+0x50,0x40);
  var firstPtr=valueOf(first.slice(0,8));
  var firstClient=valueOf(first.slice(8,0x10));
  var firstObject=valueOf(first.slice(0x10,0x18));
  var secondPtr=valueOf(second.slice(0,8));
  var secondClient=valueOf(second.slice(8,0x10));
  var secondObject=valueOf(second.slice(0x10,0x18));
  var firstName=stringAt(firstPtr);
  var secondName=stringAt(secondPtr);
  var flags=rw+0x88;
  var flagByte=readAt(flags,2);
  var after=native.call("getpid",[]);
  var restored=same(bytesAt(carrierSlot,8),carrierOriginal) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12;
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_init_state_restored");
  result={id:"syscore_init_state_v1",
    status:(info.value===0 && after.value===63 && after.high===0 &&
      restored)?"pass":"fail",
    details:{self_pid:after.value,syscore_base:syscoreBase,
      flags:flagByte[0].toString(16)+"/"+flagByte[1].toString(16),
      first_hex:hexOf(first),second_hex:hexOf(second),
      first_name:firstName,second_name:secondName,
      first_object:firstObject,second_object:secondObject,
      first_client:firstClient,second_client:secondClient,
      restored:restored}};
} catch (error) {
  result={id:"syscore_init_state_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
