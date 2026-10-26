// Establish the live 14.00 thr_self/thr_kill2 signal-zero contract.
// The cross-process call uses this page's own TID, which cannot belong
// to the parent. It delivers no signal.
var result,phase="preflight",frame,saved,base=0x1800,span=0x100;
try{
  var native=window.__fw14NativeInvoke;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys432!=="number"||
      typeof native.wrappers.sys481!=="number"||
      !native.frame||!Number.isSafeInteger(native.frameAddress))
    throw new Error("caller_missing");
  frame=native.frame;
  if(base+span>=frame.length)throw new Error("frame_small");
  saved=Array.from(frame.subarray(base,base+span));
  var self=native.call("getpid",[]),parent=native.call("getppid",[]);
  if(self.high!==0||parent.high!==0||self.value<1||parent.value<1||
      self.value>100000||parent.value>100000)
    throw new Error("pid_invalid");
  frame.fill(0xa5,base,base+16);
  frame.fill(0x5a,base+16,base+span);
  phase="thr_self";
  if(api&&typeof api.markSync==="function")api.markSync("thrself_before");
  var ts=native.call("sys432",[native.frameAddress+base,0,0,0,0,0]);
  var tsErr=ts.value===-1?native.readErrno():0;
  if(api&&typeof api.markSync==="function")api.markSync("thrself_after");
  var tid=0;
  for(var j=7;j>=0;j--)tid=tid*256+frame[base+j];
  if(ts.value!==0||!Number.isSafeInteger(tid)||tid<1||tid>0x7fffffff)
    throw new Error("self_tid_invalid_"+tid);
  phase="self_signal_zero";
  var own=native.call("sys481",[self.value,tid,0,0,0,0]);
  var ownErr=own.value===-1?native.readErrno():0;
  phase="parent_wrong_tid";
  var other=native.call("sys481",[parent.value,tid,0,0,0,0]);
  var otherErr=other.value===-1?native.readErrno():0;
  phase="parent_kill_zero";
  var kill=native.call("kill",[parent.value,0,0,0,0,0]);
  var killErr=kill.value===-1?native.readErrno():0;
  var guard=true;
  for(var g=base+16;g<base+span;g++)if(frame[g]!==0x5a)guard=false;
  var end=native.call("getpid",[]);
  result={id:"thr_signal0_calibration_v1",
    status:end.high===0&&end.value===self.value&&guard?"pass":"fail",
    details:{pid:self.value,parent:parent.value,tid:tid,
      thrself:ts.value+"/"+tsErr,own:own.value+"/"+ownErr,
      parent_wrong_tid:other.value+"/"+otherErr,
      kill_parent:kill.value+"/"+killErr,guard:guard}};
}catch(error){result={id:"thr_signal0_calibration_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];}
return [result];
