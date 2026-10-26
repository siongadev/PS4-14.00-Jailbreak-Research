// Compare signal-zero permission checks through the live 14.00 wrappers.
// Signal zero checks access and does not deliver a signal in upstream FreeBSD.
var result;
var phase="preflight";
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || native.sourceSession!=="current_page" ||
      !native.wrappers || !native.wrappers.getppid ||
      !native.wrappers.kill || !native.wrappers.sigqueue ||
      !state || state.array[0]!==state.a)
    throw new Error("live_signal_plan_missing");
  var self=native.call("getpid",[]);
  var parent=native.call("getppid",[]);
  if (self.high!==0 || self.value<1 || self.value>100000 ||
      parent.high!==0 || parent.value<1 || parent.value>100000 ||
      parent.value===self.value)
    throw new Error("process_identity_invalid");
  phase="signal_zero";
  if (api && typeof api.markSync==="function")
    api.markSync("signal_zero_preflight");
  var killSelf=native.call("kill",[self.value,0]);
  var sigSelf=native.call("sigqueue",[self.value,0,0]);
  var killParent=native.call("kill",[parent.value,0]);
  var sigParent=native.call("sigqueue",[parent.value,0,0]);
  var outputs=[killSelf,sigSelf,killParent,sigParent];
  var valid=outputs.every(function (entry) {
    return (entry.value===0 && entry.high===0) ||
           (entry.value===-1 && entry.high===0xffffffff);
  });
  if (api && typeof api.markSync==="function")
    api.markSync("signal_zero_restored");
  result={id:"signal_zero_boundary_v1",status:valid?"pass":"fail",
    details:{self_pid:self.value,parent_pid:parent.value,
      kill_self:killSelf.value,sig_self:sigSelf.value,
      kill_parent:killParent.value,sig_parent:sigParent.value,
      return_shapes_valid:valid,carrier_restored:state.array[0]===state.a}};
} catch (error) {
  result={id:"signal_zero_boundary_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
