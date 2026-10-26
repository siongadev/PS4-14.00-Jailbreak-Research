// Matched null-output control for the 14.00 NetCtl client read.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,state=window.__fw14ArrayState;
  if (!n || !state || state.array[0]!==state.a || !n.frame ||
      !Number.isSafeInteger(n.frameAddress) || n.frame.length<0x900 ||
      !n.wrappers || !n.wrappers.netctl_output4)
    throw new Error("native_plan_missing");
  var before=n.call("getpid",[]);
  if (before.high!==0 || before.value<1 || before.value>100000)
    throw new Error("pid_control_failed");
  var frame=n.frame,offset=0x500;
  var saved=Array.from(frame.subarray(offset,offset+16));
  var callResult=null,outputBefore=0xa5a5a5a5,outputAfter=null;
  try {
    frame.fill(0xa5,offset,offset+16);
    phase="netctl_call";
    if (api && api.markSync) api.markSync("netctl_null_before");
    callResult=n.call("netctl_output4",[0]);
    if (api && api.markSync) api.markSync("netctl_null_after");
    var view=new DataView(frame.buffer,frame.byteOffset,frame.byteLength);
    outputAfter=view.getUint32(offset,true);
    if (Array.from(frame.subarray(offset+4,offset+16)).some(function(v){
      return v!==0xa5;
    })) throw new Error("output_guard_changed");
  } finally {
    for(var i=0;i<saved.length;i++)frame[offset+i]=saved[i];
  }
  var after=n.call("getpid",[]);
  var restored=after.high===0 && after.value===before.value &&
    saved.every(function(v,k){return frame[offset+k]===v;}) &&
    state.array[0]===state.a;
  result={id:"netctl_null_v1",status:callResult && restored &&
      outputAfter===outputBefore?"pass":"fail",
    details:{pid:before.value,return_value:callResult?callResult.value:null,
      return_high:callResult?callResult.high:null,
      output_before:outputBefore,output_after:outputAfter,restored:restored}};
}catch(error){
  result={id:"netctl_null_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
