// Compare signal-zero returns and same-thread errno for self and parent.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || typeof native.readErrno!=="function" ||
      !native.wrappers || !native.wrappers.errno ||
      !state || state.array[0]!==state.a)
    throw new Error("errno_caller_missing");
  var self=native.call("getpid",[]);
  var parent=native.call("getppid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000 ||
      parent.high!==0 || parent.value<1 || parent.value>100000 ||
      parent.value===self.value)
    throw new Error("process_identity_invalid");
  phase="signal_zero";
  if (api && typeof api.markSync==="function")
    api.markSync("signal_errno_preflight");
  var killSelf=native.call("kill",[self.value,0]);
  var sigSelf=native.call("sigqueue",[self.value,0,0]);
  var killParent=native.call("kill",[parent.value,0]);
  var killErrno=native.readErrno();
  var sigParent=native.call("sigqueue",[parent.value,0,0]);
  var sigErrno=native.readErrno();
  var returnsValid=killSelf.value===0 && killSelf.high===0 &&
    sigSelf.value===0 && sigSelf.high===0 &&
    killParent.value===-1 && killParent.high===0xffffffff &&
    sigParent.value===-1 && sigParent.high===0xffffffff &&
    killErrno>0 && killErrno<128 && sigErrno>0 && sigErrno<128;
  if (api && typeof api.markSync==="function")
    api.markSync("signal_errno_restored");
  result={id:"signal_zero_errno_v1",status:returnsValid?"pass":"fail",
    details:{self_pid:self.value,parent_pid:parent.value,
      kill_self:killSelf.value,sig_self:sigSelf.value,
      kill_parent:killParent.value,kill_errno:killErrno,
      sig_parent:sigParent.value,sig_errno:sigErrno,
      return_shapes_valid:returnsValid,carrier_restored:state.array[0]===state.a}};
} catch (error) {
  result={id:"signal_zero_errno_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
