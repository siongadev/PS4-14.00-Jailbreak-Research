// Repeat the first parent TID found by the page-local signal-zero scan.
// All checks use signal 0, which delivers no signal.
var result,phase="preflight";
try{
  var native=window.__fw14NativeInvoke;
  var scan=window.__fw14ThreadSweepState;
  if(!native||typeof native.call!=="function"||
      typeof native.wrappers.sys481!=="number"||
      !scan||!Number.isInteger(scan.next))
    throw new Error("scan_or_caller_missing");
  var self=native.call("getpid",[]),parent=native.call("getppid",[]);
  var hit=scan.next+1;
  if(self.high!==0||parent.high!==0||self.value!==scan.self||
      parent.value!==scan.parent||hit<100000||hit>=scan.selfTid)
    throw new Error("session_identity_changed");
  var rows=[];
  for(var i=0;i<2;i++){
    phase="repeat_"+i;
    if(api&&typeof api.markSync==="function")
      api.markSync("thrtid_confirm_before_"+i);
    var c=native.call("sys481",[parent.value,hit,0,0,0,0]);
    var e=c.value===-1?native.readErrno():0;
    rows.push(c.value+"/"+e);
  }
  var wrong=native.call("sys481",[parent.value,scan.selfTid,0,0,0,0]);
  var wrongErr=wrong.value===-1?native.readErrno():0;
  var own=native.call("sys481",[self.value,scan.selfTid,0,0,0,0]);
  var ownErr=own.value===-1?native.readErrno():0;
  var kill=native.call("kill",[parent.value,0,0,0,0,0]);
  var killErr=kill.value===-1?native.readErrno():0;
  var end=native.call("getpid",[]);
  result={id:"thr_parent_tid_confirm_v1",
    status:end.high===0&&end.value===self.value?"pass":"fail",
    details:{pid:self.value,parent:parent.value,parent_tid:hit,
      repeated:rows.join("|"),wrong_tid:wrong.value+"/"+wrongErr,
      own_tid:own.value+"/"+ownErr,kill_parent:kill.value+"/"+killErr}};
}catch(error){result={id:"thr_parent_tid_confirm_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,160)}};}
return [result];
