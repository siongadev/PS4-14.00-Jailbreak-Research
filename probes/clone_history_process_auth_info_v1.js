// Source-shaped 14.00 syscall-587 reads of self and parent process IDs.
// Only owned output buffers are passed; both processes remain unchanged.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!n.wrappers||!n.wrappers.sys587||!n.wrappers.getppid||
     !n.frame||n.frame.length<0x2000||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a)throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress;
  var self=n.call("getpid",[]),parent=n.call("getppid",[]);
  if(self.high!==0||parent.high!==0||self.value<1||parent.value<1||
     self.value===parent.value||self.value>100000||parent.value>100000)
    throw new Error("pid_control_invalid");
  var saved=Array.from(f.subarray(0x900,0xa20));
  var own=null,ownErrno=0,ownChanged=0,ownHex="";
  var other=null,otherErrno=0,otherChanged=0,otherHex="";
  var guard=false;
  function changed(off,len){
    var c=0;for(var i=0;i<len;i++)if(f[off+i]!==0xa5)c++;return c;
  }
  function hexAt(off,len){
    var t="";for(var i=0;i<len;i++)t+=("0"+f[off+i].toString(16)).slice(-2);
    return t;
  }
  try {
    f.fill(0xa5,0x900,0xa20);
    phase="self_auth";
    if(api&&api.markSync)api.markSync("process_auth_self_before");
    own=n.call("sys587",[self.value,a+0x900]);
    if(api&&api.markSync)api.markSync("process_auth_self_after");
    ownErrno=own.value===-1?n.readErrno():0;
    ownChanged=changed(0x900,256);
    ownHex=hexAt(0x900,64);
    var ownGuard=changed(0xa00,32)===0;
    f.fill(0xa5,0x900,0xa20);
    phase="parent_auth";
    if(api&&api.markSync)api.markSync("process_auth_parent_before");
    other=n.call("sys587",[parent.value,a+0x900]);
    if(api&&api.markSync)api.markSync("process_auth_parent_after");
    otherErrno=other.value===-1?n.readErrno():0;
    otherChanged=changed(0x900,256);
    otherHex=hexAt(0x900,64);
    guard=ownGuard&&changed(0xa00,32)===0;
  }finally{
    for(var j=0;j<saved.length;j++)f[0x900+j]=saved[j];
  }
  var after=n.call("getpid",[]);
  var restored=saved.every(function(v,i){return f[0x900+i]===v;})&&
    s.array[0]===s.a&&after.high===0&&after.value===self.value;
  result={id:"process_auth_info_v1",status:guard&&restored?"pass":"fail",
    details:{self_pid:self.value,parent_pid:parent.value,
      self_ret:own.value,self_errno:ownErrno,self_changed:ownChanged,
      self_hex:ownHex,parent_ret:other.value,parent_errno:otherErrno,
      parent_changed:otherChanged,parent_hex:otherHex,
      guard:guard,restored:restored}};
}catch(error){
  result={id:"process_auth_info_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
