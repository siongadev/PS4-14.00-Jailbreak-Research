// Bounded, read-only syscall-587 census: PIDs 1..64, 136-byte guarded output.
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
  var chunks=["","","","","","","",""],hits=0,guard=true;
  function changed(off,len){var c=0;
    for(var i=0;i<len;i++)if(f[off+i]!==0xa5)c++;return c;}
  function hexAt(off,len){var t="";
    for(var i=0;i<len;i++)t+=("0"+f[off+i].toString(16)).slice(-2);
    return t;}
  try {
    if(api&&api.markSync)api.markSync("auth_census_before");
    for(var q=1;q<=64;q++){
      phase="pid_"+q;
      f.fill(0xa5,0x900,0xa20);
      var call=n.call("sys587",[q,a+0x900]);
      var err=call.value===-1?n.readErrno():0;
      var changedCount=changed(0x900,256);
      guard=guard&&changed(0xa00,32)===0;
      var index=Math.floor((q-1)/8);
      if(call.value===0&&call.high===0){
        hits++;
        chunks[index]+=q+"="+hexAt(0x900,16)+"/"+changedCount+";";
      }else if(err!==3){
        chunks[index]+=q+"!"+call.value+"/"+err+"/"+changedCount+";";
      }
      if(q%16===0&&api&&api.markSync)
        api.markSync("auth_census_through_"+q);
    }
  }finally{
    for(var r=0;r<saved.length;r++)f[0x900+r]=saved[r];
  }
  var after=n.call("getpid",[]);
  var restored=saved.every(function(v,i){return f[0x900+i]===v;})&&
    s.array[0]===s.a&&after.high===0&&after.value===pid.value;
  result={id:"process_auth_census_v2",status:guard&&restored?"pass":"fail",
    details:{self_pid:pid.value,hit_count:hits,
      chunk0:chunks[0],chunk1:chunks[1],chunk2:chunks[2],chunk3:chunks[3],
      chunk4:chunks[4],chunk5:chunks[5],chunk6:chunks[6],chunk7:chunks[7],
      guard:guard,restored:restored}};
}catch(error){
  result={id:"process_auth_census_v2",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
