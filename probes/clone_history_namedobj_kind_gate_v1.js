// Test whether a self-created 557 object with arg3=0x4000 is distinguished
// by 558's kind argument. No 601 call or foreign handle is involved.
var result;
var phase="preflight";
var liveHandle=0;
try {
  var native=window.__fw14NativeInvoke;
  var state=window.__fw14ArrayState;
  if (!native || !native.wrappers || !native.wrappers.sys557 ||
      !native.wrappers.sys558 || !native.frame || !state ||
      state.array[0]!==state.a)
    throw new Error("native_plan_missing");
  var frame=native.frame, offset=0x200, length=32;
  if (offset+length>frame.length) throw new Error("frame_too_small");
  var saved=Array.from(frame.subarray(offset,offset+length));
  var name="Fw14KindGate";
  frame.fill(0,offset,offset+length);
  for (var i=0;i<name.length;i++) frame[offset+i]=name.charCodeAt(i);
  var pid=native.call("getpid",[]);
  if (pid.high!==0 || pid.value<1 || pid.value>100000)
    throw new Error("pid_invalid");
  if (api && typeof api.markSync==="function") api.markSync("kind_gate_before_create");
  phase="create";
  var create=native.call("sys557",[native.frameAddress+offset,0,0x4000,0,0,0]);
  var createErr=create.value===-1?native.readErrno():0;
  if (create.value>0 && create.value<0x1000000) liveHandle=create.value;
  if (api && typeof api.markSync==="function") api.markSync("kind_gate_after_create");
  var wrong=null,wrongErr=null,right=null,rightErr=null;
  if (liveHandle) {
    phase="wrong_kind";
    var w=native.call("sys558",[liveHandle,0,0,0,0,0]);
    wrong=w.value;wrongErr=w.value===-1?native.readErrno():0;
    if (api && typeof api.markSync==="function") api.markSync("kind_gate_after_wrong");
    if (wrong===0) liveHandle=0;
    else {
      phase="matching_kind";
      var r=native.call("sys558",[liveHandle,0x4000,0,0,0,0]);
      right=r.value;rightErr=r.value===-1?native.readErrno():0;
      if (right===0) liveHandle=0;
    }
  }
  if (api && typeof api.markSync==="function") api.markSync("kind_gate_after_cleanup");
  for (var j=0;j<length;j++) frame[offset+j]=saved[j];
  var restored=true;
  for (var k=0;k<length;k++) if(frame[offset+k]!==saved[k])restored=false;
  var endPid=native.call("getpid",[]);
  var pidOk=endPid.high===0 && endPid.value===pid.value && state.array[0]===state.a;
  result={id:"namedobj_kind_gate_v1",status:(pidOk&&restored&&liveHandle===0)?"pass":"fail",
    details:{pid:pid.value,create:create.value,create_errno:createErr,
      wrong:wrong,wrong_errno:wrongErr,right:right,right_errno:rightErr,
      live_handle:liveHandle,pid_ok:pidOk,region_restored:restored}};
} catch(error) {
  result={id:"namedobj_kind_gate_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180),live_handle:liveHandle}};
}
return [result];
