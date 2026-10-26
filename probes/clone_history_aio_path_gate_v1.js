// Explain the AIO setup's ENOENT before any request is submitted.
var result,phase="preflight";
try{
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!n.frame||n.frame.length<0x1b00||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a||!n.wrappers.open||!n.wrappers.close)
    throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress,p=n.call("getpid",[]);
  var offsets=[0x1000,0x1800,0x1a00],rows=[];
  var saved=offsets.map(function(v){return Array.from(f.subarray(v,v+64));});
  try{
    for(var i=0;i<offsets.length;i++){
      phase="open_"+i;
      var off=offsets[i],path="/dev/null";
      f.fill(0,off,off+64);
      for(var j=0;j<path.length;j++)f[off+j]=path.charCodeAt(j);
      if(api&&api.markSync)api.markSync("aio_path_before_"+i);
      var c=n.call("open",[a+off,0,0]);
      var e=c.value===-1?n.readErrno():0,closed=-1;
      if(c.high===0&&c.value>=3&&c.value<1024){
        var cl=n.call("close",[c.value]);closed=cl.value;
      }
      rows.push(off.toString(16)+":"+c.value+"/"+c.high+"e"+e+"c"+closed);
    }
  }finally{
    for(var k=0;k<offsets.length;k++)for(var r=0;r<64;r++)
      f[offsets[k]+r]=saved[k][r];
  }
  var q=n.call("getpid",[]);
  result={id:"aio_path_gate_v1",status:q.value===p.value&&q.high===0?"pass":"fail",
    details:{pid:p.value,rows:rows.join("|")}};
}catch(error){result={id:"aio_path_gate_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
