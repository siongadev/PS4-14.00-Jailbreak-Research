// Capture the complete 136-byte self auth record and compare selector zero.
var result,phase="preflight";
try {
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!n.wrappers||!n.wrappers.sys587||!n.frame||
     n.frame.length<0x2000||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a)throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress,pid=n.call("getpid",[]);
  if(pid.high!==0||pid.value<1||pid.value>100000)
    throw new Error("pid_invalid");
  var saved=Array.from(f.subarray(0x900,0xa20));
  var rows=[],guard=true;
  function changed(off,len){var c=0;
    for(var i=0;i<len;i++)if(f[off+i]!==0xa5)c++;return c;}
  function hexAt(off,len){var t="";
    for(var i=0;i<len;i++)t+=("0"+f[off+i].toString(16)).slice(-2);
    return t;}
  try {
    var cases=[["self",pid.value],["zero",0]];
    for(var j=0;j<cases.length;j++){
      phase=cases[j][0];
      f.fill(0xa5,0x900,0xa20);
      if(api&&api.markSync)api.markSync("auth_full_"+phase+"_before");
      var call=n.call("sys587",[cases[j][1],a+0x900]);
      if(api&&api.markSync)api.markSync("auth_full_"+phase+"_after");
      rows.push({ret:call.value,errno:call.value===-1?n.readErrno():0,
        changed:changed(0x900,256),hex:hexAt(0x900,136)});
      guard=guard&&changed(0xa00,32)===0;
    }
  }finally{
    for(var r=0;r<saved.length;r++)f[0x900+r]=saved[r];
  }
  var after=n.call("getpid",[]);
  var restored=saved.every(function(v,i){return f[0x900+i]===v;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"process_auth_self_zero_v1",status:guard&&restored?"pass":"fail",
    details:{pid:pid.value,self_ret:rows[0].ret,self_errno:rows[0].errno,
      self_changed:rows[0].changed,self_hex:rows[0].hex,
      zero_ret:rows[1].ret,zero_errno:rows[1].errno,
      zero_changed:rows[1].changed,zero_hex:rows[1].hex,
      equal:rows[0].hex===rows[1].hex,guard:guard,restored:restored}};
}catch(error){
  result={id:"process_auth_self_zero_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
