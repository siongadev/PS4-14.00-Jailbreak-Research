// Sample two 64-byte locations in the current session's 14.00 RX map.
// The 0x1730000 mapping was measured by the preceding VM-map capture;
// +0x4730 is the entry offset in this process's on-disk SELF ELF header.
var result;
var phase="preflight";
try {
  var state=window.__fw14ArrayState;
  var plan=window.__fw14NativePlan;
  var native=window.__fw14NativeInvoke;
  if (!state || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !Number.isSafeInteger(state.calibratedViewBase) ||
      !plan || !Number.isSafeInteger(plan.target) ||
      !Number.isSafeInteger(plan.webkitBase) ||
      !native || state.array[0]!==state.a)
    throw new Error("current_page_plan_missing");
  var pid=native.call("getpid",[]);
  if (pid.value!==145 || pid.high!==0 ||
      plan.target<0x802454000 || plan.target>=0x8024a8000 ||
      plan.webkitBase<0x8054dc000 || plan.webkitBase>=0x808f74000)
    throw new Error("measured_session_identity_changed");
  var forged=state.view;
  var carrier=state.ownedTypedView;
  if (carrier.length!==65536 || carrier[0]!==0x31 || carrier[7]!==0xa8)
    throw new Error("carrier_canary_changed");
  function bytesAt(index,count) {
    var bytes=[];
    for (var i=0;i<count;i++) bytes.push(forged[index+i]);
    return bytes;
  }
  function valueOf(bytes) {
    var value=0;
    for (var i=bytes.length-1;i>=0;i--) value=value*256+bytes[i];
    return value;
  }
  function pointerBytes(value) {
    var bytes=[];
    for (var i=0;i<8;i++)
      bytes.push(Math.floor(value/Math.pow(2,8*i))&255);
    return bytes;
  }
  var objectWord;
  try {
    state.array[0]=carrier;
    objectWord=valueOf(bytesAt(state.index,8));
  } finally {
    state.array[0]=state.a;
  }
  var slot=objectWord-state.calibratedViewBase+8;
  if (!Number.isSafeInteger(slot) || slot<0 || slot+8>=16777216)
    throw new Error("carrier_slot_outside_view");
  var original=bytesAt(slot,8);
  function same(a,b) {
    if (a.length!==b.length) return false;
    for (var i=0;i<a.length;i++) if (a[i]!==b[i]) return false;
    return true;
  }
  function readAt(address,count) {
    var pointer=pointerBytes(address);
    try {
      for (var i=0;i<8;i++) forged[slot+i]=pointer[i];
      var bytes=[];
      for (var j=0;j<count;j++) bytes.push(carrier[j]);
      return bytes;
    } finally {
      for (var k=0;k<8;k++) forged[slot+k]=original[k];
    }
  }
  function hex(bytes) {
    var value="";
    for (var i=0;i<bytes.length;i++)
      value+=(bytes[i]<16?"0":"")+bytes[i].toString(16);
    return value;
  }
  phase="mapped_code_read";
  if (api && typeof api.markSync==="function")
    api.markSync("live_self_text_preflight");
  var head=readAt(0x1730000,64);
  var entry=readAt(0x1734730,64);
  var restored=same(bytesAt(slot,8),original) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12;
  if (api && typeof api.markSync==="function")
    api.markSync("live_self_text_restored");
  result={id:"live_self_text_sample_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,mapping:"0x1730000-0x1738000",
      relative_entry:0x4730,head_hex:hex(head),entry_hex:hex(entry),
      carrier_restored:restored}};
} catch (error) {
  result={id:"live_self_text_sample_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
