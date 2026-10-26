// Check whether the fresh AIO setup's ENOENT is path-specific, and verify
// that the page-local frame address still names the owned output bytes.
var result,phase="preflight";
try{
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<0x1100||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a||!n.wrappers.open||!n.wrappers.close||
     !n.wrappers.sys587)throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress,p=n.call("getpid",[]);
  if(p.high!==0||p.value<1)throw new Error("pid_invalid");
  var saved=Array.from(f.subarray(0x1000,0x1100)),rows=[];
  try{
    var paths=["/dev/dce","/dev/random","/","/system/common/lib/libkernel_web.sprx"];
    for(var i=0;i<paths.length;i++){
      phase="path_"+i;f.fill(0,0x1000,0x1100);
      for(var j=0;j<paths[i].length;j++)f[0x1000+j]=paths[i].charCodeAt(j);
      if(api&&api.markSync)api.markSync("path_state_before_"+i);
      var c=n.call("open",[a+0x1000,0,0]);
      var e=c.value===-1?n.readErrno():0,cl=-1;
      if(c.high===0&&c.value>=3&&c.value<1024)
        cl=n.call("close",[c.value]).value;
      rows.push(i+":"+c.value+"/"+c.high+"e"+e+"c"+cl+
        "b"+f[0x1000].toString(16));
    }
    phase="auth_control";
    f.fill(0xa5,0x1000,0x1100);
    var au=n.call("sys587",[p.value,a+0x1000]);
    var ae=au.value===-1?n.readErrno():0,hex="";
    for(var k=0;k<8;k++)hex+=("0"+f[0x1000+k].toString(16)).slice(-2);
    rows.push("auth:"+au.value+"/"+au.high+"e"+ae+"="+hex);
  }finally{for(var r=0;r<saved.length;r++)f[0x1000+r]=saved[r];}
  var q=n.call("getpid",[]);
  result={id:"path_state_v1",status:q.value===p.value&&q.high===0?"pass":"fail",
    details:{pid:p.value,rows:rows.join("|")}};
}catch(error){result={id:"path_state_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
