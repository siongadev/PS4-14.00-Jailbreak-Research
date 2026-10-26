// On this page, test the auth-similar predecessor PID's proc-read gate.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!n.wrappers||!n.wrappers.sys587||!n.wrappers.sysctl||
     !n.frame||n.frame.length<0x2000||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a)throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress,dv=new DataView(f.buffer,f.byteOffset,f.byteLength);
  var self=n.call("getpid",[]),parent=n.call("getppid",[]);
  if(self.high!==0||parent.high!==0||self.value<2||parent.value<1||
     self.value===parent.value)throw new Error("pid_invalid");
  var candidate=self.value-1;
  var saved=Array.from(f.subarray(0x200,0xb90));
  var authHex="",authRet=null,authErrno=0;
  var candRet=null,candErrno=0,candLen=0,candName="",candUid=-1;
  var parentRet=null,parentErrno=0,guard=true;
  function hexAt(off,len){var t="";
    for(var i=0;i<len;i++)t+=("0"+f[off+i].toString(16)).slice(-2);
    return t;}
  function sizeQuery(pid){
    f.fill(0xa5,0x200,0x210);f.fill(0xa5,0x400,0x410);
    dv.setUint32(0x200,0,true);dv.setUint32(0x204,0,true);
    dv.setUint32(0x400,1,true);dv.setUint32(0x404,14,true);
    dv.setUint32(0x408,1,true);dv.setUint32(0x40c,pid,true);
    var call=n.call("sysctl",[a+0x400,4,0,a+0x200,0,0]);
    return {call:call,errno:call.value===-1?n.readErrno():0,
      length:dv.getUint32(0x200,true),
      guard:f[0x208]===0xa5&&f[0x20f]===0xa5&&
        dv.getUint32(0x40c,true)===pid};
  }
  try {
    phase="auth_gate";
    f.fill(0xa5,0xb00,0xb90);
    if(api&&api.markSync)api.markSync("auth_neighbor_before");
    authRet=n.call("sys587",[candidate,a+0xb00]);
    authErrno=authRet.value===-1?n.readErrno():0;
    authHex=hexAt(0xb00,16);
    guard=guard&&f[0xb88]===0xa5;
    if(authRet.value!==0||authRet.high!==0)
      throw new Error("neighbor_auth_unavailable_"+authErrno);
    phase="candidate_proc_size";
    var cr=sizeQuery(candidate);
    candRet=cr.call;candErrno=cr.errno;candLen=cr.length;
    guard=guard&&cr.guard;
    if(api&&api.markSync)api.markSync("neighbor_proc_size_done");
    if(candRet.value===0&&candLen===1096){
      phase="candidate_proc_record";
      f.fill(0xa5,0x600,0xa68);
      dv.setUint32(0x200,1096,true);dv.setUint32(0x204,0,true);
      var record=n.call("sysctl",[a+0x400,4,a+0x600,a+0x200,0,0]);
      if(record.value===0&&record.high===0&&
         dv.getUint32(0x200,true)===1096&&
         dv.getUint32(0x600+72,true)===candidate){
        candUid=dv.getUint32(0x600+168,true);
        for(var k=0;k<20&&f[0x600+447+k]!==0;k++)
          candName+=String.fromCharCode(f[0x600+447+k]);
      }
      guard=guard&&f[0xa48]===0xa5&&f[0xa67]===0xa5;
    }
    phase="parent_proc_size";
    var pr=sizeQuery(parent.value);
    parentRet=pr.call;parentErrno=pr.errno;
    guard=guard&&pr.guard;
    if(api&&api.markSync)api.markSync("auth_neighbor_done");
  }finally{
    for(var r=0;r<saved.length;r++)f[0x200+r]=saved[r];
  }
  var after=n.call("getpid",[]);
  var restored=saved.every(function(v,i){return f[0x200+i]===v;})&&
    s.array[0]===s.a&&after.high===0&&after.value===self.value;
  result={id:"auth_neighbor_proc_v1",status:guard&&restored?"pass":"fail",
    details:{pid:self.value,candidate:candidate,candidate_auth:authHex,
      candidate_proc_ret:candRet.value,candidate_proc_errno:candErrno,
      candidate_length:candLen,candidate_name:candName,candidate_uid:candUid,
      parent_proc_ret:parentRet.value,parent_proc_errno:parentErrno,
      guard:guard,restored:restored}};
}catch(error){
  result={id:"auth_neighbor_proc_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
