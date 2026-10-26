// Dump one bounded 0x900-byte chunk of the current libSceRegMgr RX mapping.
// Eight commands cover 0x4000 bytes. Each command checks the measured
// session identity and restores the carrier.
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
  if (pid.value!==74 || pid.high!==0)
    throw new Error("measured_session_identity_changed");
  var part=window.__fw14RegMgrDumpPartV1;
  if (part===undefined) part=0;
  if (!Number.isInteger(part) || part<0 || part>7)
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
    api.markSync("regmgr_dump_preflight");
  var prefix=readAt(0x80b274000,8);
  if (same(prefix,[0,0,0,0,0,0,0,0]))
    throw new Error("mapped_prefix_all_zero");
  var relativeOffset=part*0x900;
  var length=Math.min(0x900,0x4000-relativeOffset);
  var bytes=readAt(0x80b274000+relativeOffset,length);
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
    if (part===0 && half===0) {
      var head="";
      for (var hi=0;hi<8;hi++) head+=prefix[hi].toString(16).padStart(2,"0");
      details.head8=head;
    }
    checks.push({id:half===0?"regmgr_dump_a_v1":
      "regmgr_dump_b_v1",status:"pass",details:details});
  }
  window.__fw14RegMgrDumpPartV1=part+1;
  if (api && typeof api.markSync==="function")
    api.markSync("regmgr_dump_restored");
  results=checks;
} catch (error) {
  results=[{id:"regmgr_dump_a_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}},
    {id:"regmgr_dump_b_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}}];
}
return results;
