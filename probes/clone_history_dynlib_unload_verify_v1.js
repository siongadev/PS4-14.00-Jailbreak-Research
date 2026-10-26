// Compare the live module list before and after one 595 call on handle 16.
// The historical ABI calls 595 dynlib_unload_prx; the device-side change
// is deliberately measured instead of inferred from the return value.
var result;
var phase="preflight";
var original=null;
var frame=null;
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers ||
      !native.wrappers.dynlib_list || !native.wrappers.sys595 ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x620 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  original=Array.from(frame.subarray(0x300,0x620));
  var dv=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
  function mark(name) {
    if (api && typeof api.markSync==="function") api.markSync(name);
  }
  function list() {
    frame.fill(0xa5,0x300,0x620);
    dv.setUint32(0x300,0,true);
    dv.setUint32(0x304,0,true);
    var ret=native.call("dynlib_list",[address+0x400,64,address+0x300]);
    var errno=ret.value===-1?native.readErrno():0;
    var count=dv.getUint32(0x300,true);
    var high=dv.getUint32(0x304,true);
    var guard=frame[0x308]===0xa5 && frame[0x3ff]===0xa5 &&
      frame[0x500]===0xa5 && frame[0x61f]===0xa5;
    if (ret.value!==0 || ret.high!==0 || high!==0 || count>64 || !guard)
      throw new Error("module_list_invalid:"+ret.value+"/"+errno+"/"+count);
    var handles=[];
    for (var i=0;i<count;i++) handles.push(dv.getInt32(0x400+i*4,true));
    return handles;
  }
  var pidBefore=native.call("getpid",[]);
  if (pidBefore.high!==0 || pidBefore.value<1 || pidBefore.value>100000)
    throw new Error("pid_before_invalid");
  phase="baseline";
  mark("u595_before_list");
  var before=list();
  mark("u595_listed_before");
  if (before.indexOf(16)<0) {
    result={id:"dynlib_unload_verify_v1",status:"fail",
      details:{reason:"handle16_absent_at_baseline",pid:pidBefore.value,
        count_before:before.length,handles_before:before.join(",")}};
  } else {
    phase="unload";
    mark("u595_before_unload");
    var unload=native.call("sys595",[16,0,0,0,0,0]);
    var unloadErrno=unload.value===-1?native.readErrno():0;
    mark("u595_after_unload");
    phase="post_list";
    var after=list();
    mark("u595_listed_after");
    var pidAfter=native.call("getpid",[]);
    var pidOk=pidAfter.high===0 && pidAfter.value===pidBefore.value;
    result={id:"dynlib_unload_verify_v1",status:pidOk?"pass":"fail",
      details:{pid:pidBefore.value,
        unload_return:unload.value,
        unload_errno:unloadErrno,count_before:before.length,
        count_after:after.length,handle16_before:true,
        handle16_after:after.indexOf(16)>=0,
        removed_handles:before.filter(function(h){return after.indexOf(h)<0;}).join(","),
        handles_before:before.join(","),handles_after:after.join(","),
        pid_ok:pidOk}};
  }
} catch(error) {
  result={id:"dynlib_unload_verify_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
} finally {
  if (frame && original)
    for (var x=0;x<original.length;x++) frame[0x300+x]=original[x];
}
if (result && result.details && frame && original)
  result.details.carrier_restored=original.every(function(byte,index) {
    return frame[0x300+index]===byte;
  });
if (api && typeof api.markSync==="function") api.markSync("u595_done");
return [result];
