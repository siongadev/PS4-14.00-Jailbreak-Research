// One request-1 buffer discriminator: 72 bytes, one bounded ASCII name.
// No object with this name is created by the probe.
var result;
var phase="preflight";
var frame=null,original=null;
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.sys601 ||
      !native.frame || !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  frame=native.frame;
  var address=native.frameAddress;
  if (frame.length<0x920 || address<0x200000000 || address>=0x900000000)
    throw new Error("owned_frame_invalid");
  original=Array.from(frame.subarray(0x800,0x920));
  var before=native.call("getpid",[]);
  if (before.high!==0 || before.value<1 || before.value>100000)
    throw new Error("pid_before_invalid");
  frame.fill(0xa5,0x800,0x920);
  frame.fill(0,0x820,0x868);
  var name="FW14-NOT-FOUND";
  for (var i=0;i<name.length;i++) frame[0x820+0x28+i]=name.charCodeAt(i);
  phase="request1_named";
  if (api && typeof api.markSync==="function")
    api.markSync("mdbg1_name_before");
  var call=native.call("sys601",[1,address+0x820,0,0,0,0]);
  var errno=call.value===-1?native.readErrno():0;
  if (api && typeof api.markSync==="function")
    api.markSync("mdbg1_name_after");
  var guard=frame[0x800]===0xa5 && frame[0x81f]===0xa5 &&
    frame[0x868]===0xa5 && frame[0x91f]===0xa5;
  var after=native.call("getpid",[]);
  var pidOk=after.high===0 && after.value===before.value &&
    state.array[0]===state.a;
  result={id:"mdbg_request1_name_v1",status:guard&&pidOk?"pass":"fail",
    details:{pid:before.value,return_value:call.value,
      errno:errno,guard:guard,pid_ok:pidOk}};
} catch(error) {
  result={id:"mdbg_request1_name_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
} finally {
  if (frame && original)
    for (var x=0;x<original.length;x++) frame[0x800+x]=original[x];
}
if (result && result.details && frame && original)
  result.details.carrier_restored=original.every(function(byte,index) {
    return frame[0x800+index]===byte;
  });
return [result];
