// Discriminate syscall 587's first argument with 0, absent PID, live parent.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!n.wrappers||!n.wrappers.sys587||!n.frame||
     n.frame.length<0x2000||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a)throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress;
  var self=n.call("getpid",[]),parent=n.call("getppid",[]);
  if(self.high!==0||parent.high!==0||self.value<1||parent.value<1||
     self.value===parent.value||self.value>100000||parent.value>100000)
    throw new Error("pid_invalid");
  var saved=Array.from(f.subarray(0x900,0xa20));
  var rows=[],guard=true;
  function changed(off,len){var c=0;
    for(var i=0;i<len;i++)if(f[off+i]!==0xa5)c++;return c;}
  function hexAt(off,len){var t="";
    for(var i=0;i<len;i++)t+=("0"+f[off+i].toString(16)).slice(-2);
    return t;}
  try {
    var cases=[["zero",0],["absent",99999],["parent",parent.value]];
    for(var j=0;j<cases.length;j++){
      phase=cases[j][0];
      f.fill(0xa5,0x900,0xa20);
      if(api&&api.markSync)api.markSync("auth_selector_"+phase+"_before");
      var call=n.call("sys587",[cases[j][1],a+0x900]);
      if(api&&api.markSync)api.markSync("auth_selector_"+phase+"_after");
      var err=call.value===-1?n.readErrno():0;
      rows.push({ret:call.value,errno:err,changed:changed(0x900,256),
        hex:hexAt(0x900,136)});
      guard=guard&&changed(0xa00,32)===0;
    }
  }finally{
    for(var r=0;r<saved.length;r++)f[0x900+r]=saved[r];
  }
  var after=n.call("getpid",[]);
  var restored=saved.every(function(v,i){return f[0x900+i]===v;})&&
    s.array[0]===s.a&&after.high===0&&after.value===self.value;
  result={id:"process_auth_selector_v1",status:guard&&restored?"pass":"fail",
    details:{parent_pid:parent.value,
      zero_ret:rows[0].ret,zero_errno:rows[0].errno,zero_changed:rows[0].changed,
      absent_ret:rows[1].ret,absent_errno:rows[1].errno,
      absent_changed:rows[1].changed,parent_ret:rows[2].ret,
      parent_changed:rows[2].changed,parent_hex:rows[2].hex,
      guard:guard,restored:restored}};
}catch(error){
  result={id:"process_auth_selector_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
