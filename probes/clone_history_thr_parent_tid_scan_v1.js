// Bounded signal-zero search for a parent-process TID. One 128-ID
// window per invocation; stop at the first response other than ESRCH.
// PID and self TID are measured on this page, never hardcoded.
var result,phase="preflight",frame,saved,base=0x1800,span=0x80;
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
  frame.fill(0xa5,base,base+8);
  var ts=native.call("sys432",[native.frameAddress+base,0,0,0,0,0]);
  var tid=0;for(var j=7;j>=0;j--)tid=tid*256+frame[base+j];
  if(ts.value!==0||!Number.isSafeInteger(tid)||tid<100000||
      tid>0x7fffffff)throw new Error("self_tid_invalid");
  var state=window.__fw14ThreadSweepState;
  if(!state){
    state={self:self.value,parent:parent.value,selfTid:tid,
      next:tid-1,round:0};
    window.__fw14ThreadSweepState=state;
  }
  if(state.self!==self.value||state.parent!==parent.value||
      state.selfTid!==tid)throw new Error("session_identity_changed");
  if(state.next<100000)throw new Error("scan_complete");
  phase="scan";
  var start=state.next,lower=Math.max(100000,start-127);
  var tested=0,hit=-1,ret=0,errno=0;
  if(api&&typeof api.markSync==="function")
    api.markSync("thrtid_before_"+state.round);
  for(var candidate=start;candidate>=lower;candidate--){
    var c=native.call("sys481",[parent.value,candidate,0,0,0,0]);
    var e=c.value===-1?native.readErrno():0;
    tested++;
    if(c.value!==-1||e!==3){hit=candidate;ret=c.value;errno=e;break;}
  }
  state.next=start-tested;
  state.round++;
  var end=native.call("getpid",[]);
  var guard=true;
  for(var g=base+8;g<base+span;g++)if(frame[g]!==saved[g-base])guard=false;
  result={id:"thr_parent_tid_scan_v1",
    status:end.high===0&&end.value===self.value&&guard?"pass":"fail",
    details:{pid:self.value,parent:parent.value,self_tid:tid,
      round:state.round,start:start,lowest:lower,tested:tested,
      hit:hit,ret:ret,errno:errno,next:state.next,guard:guard}};
}catch(error){result={id:"thr_parent_tid_scan_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
finally{if(frame&&saved)for(var r=0;r<saved.length;r++)frame[base+r]=saved[r];}
return [result];
