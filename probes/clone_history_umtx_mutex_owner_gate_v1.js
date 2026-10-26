// Exercise one uncontested, owned umutex through the live PS4 14.00
// syscall-454 wrapper, then release it and restore every input byte.
var result;
var phase="preflight";
var original=null;
var frame=null;
var offset=0x100;
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.umtx ||
      typeof native.readErrno!=="function" || !native.frame ||
      !Number.isSafeInteger(native.frameAddress) ||
      !state || state.array[0]!==state.a)
    throw new Error("umtx_plan_missing");
  frame=native.frame;
  var address=native.frameAddress+offset;
  if (address<0x200000000 || address>=0x900000000 ||
      address%4!==0 || frame.length<offset+0x30)
    throw new Error("owned_mutex_invalid");
  original=Array.from(frame.subarray(offset,offset+0x30));
  var before=native.call("getpid",[]);
  if (before.value!==145 || before.high!==0)
    throw new Error("session_pid_changed");
  function word() {
    return (frame[offset] | (frame[offset+1]<<8) |
      (frame[offset+2]<<16) | (frame[offset+3]<<24))>>>0;
  }
  function invoke(op) {
    var returned=native.call("umtx",[address,op,0,0,0]);
    return {value:returned.value,high:returned.high,
      errno:returned.value===-1?native.readErrno():0};
  }
  function compact(entry) {
    return entry.value+"/"+entry.errno+"/"+entry.high;
  }
  for (var i=0;i<0x20;i++) frame[offset+i]=0;
  var guardBefore=Array.from(frame.subarray(offset+0x20,offset+0x30));
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_mutex_preflight");
  phase="trylock";
  var acquired=invoke(4);
  var ownerAfterTry=word();
  var released=null;
  var ownerAfterRelease=null;
  if (acquired.value===0 && acquired.high===0) {
    phase="unlock";
    released=invoke(6);
    ownerAfterRelease=word();
  }
  phase="postflight";
  var guardIntact=guardBefore.every(function(byte,index) {
    return frame[offset+0x20+index]===byte;
  });
  for (var j=0;j<original.length;j++) frame[offset+j]=original[j];
  var bytesRestored=original.every(function(byte,index) {
    return frame[offset+index]===byte;
  });
  var after=native.call("getpid",[]);
  var callerRestored=bytesRestored && guardIntact &&
    after.value===before.value && after.high===0 &&
    state.array[0]===state.a;
  if (api && typeof api.markSync==="function")
    api.markSync("umtx_mutex_restored");
  result={id:"umtx_mutex_owner_gate_v1",
    status:callerRestored?"pass":"fail",
    details:{pid_before:before.value,pid_after:after.value,
      trylock:compact(acquired),owner_after_try:ownerAfterTry,
      unlock:released?compact(released):"skipped",
      owner_after_unlock:ownerAfterRelease,
      guard_intact:guardIntact,bytes_restored:bytesRestored,
      caller_restored:callerRestored}};
} catch(error) {
  if (frame && original) {
    for (var k=0;k<original.length;k++) frame[offset+k]=original[k];
  }
  result={id:"umtx_mutex_owner_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
