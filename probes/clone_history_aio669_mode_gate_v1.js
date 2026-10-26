// The live libkernel_web image has four callers that place these modes
// in arg1 of syscall 669. Compare null and owned/count-zero request shapes.
var result,phase="preflight";
try{
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  if(!n||!n.wrappers||typeof n.wrappers.sys669!=="number"||
     !n.frame||n.frame.length<0x1a40||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a)throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress,p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)throw new Error("pid_invalid");
  var saved=Array.from(f.subarray(0x1800,0x1a40)),rows=[],guard=true;
  try{
    var modes=[1,2,0x1001,0x1002];
    for(var m=0;m<modes.length;m++)for(var shape=0;shape<2;shape++){
      phase="mode_"+modes[m]+"_shape_"+shape;
      f.fill(0,0x1800,0x1900);
      f.fill(0xa5,0x1900,0x1a40);
      if(api&&api.markSync)api.markSync("aio669_"+m+"_"+shape);
      var args=shape===0?[modes[m],0,0,0,0,0]:
        [modes[m],a+0x1800,0,0,a+0x1900,0];
      var c=n.call("sys669",args),e=c.value===-1?n.readErrno():0;
      var changed=0,hex="";
      for(var j=0;j<16;j++){
        if(f[0x1900+j]!==0xa5)changed++;
        if(j<8)hex+=("0"+f[0x1900+j].toString(16)).slice(-2);
      }
      for(var g=0x1a00;g<0x1a40;g++)if(f[g]!==0xa5)guard=false;
      rows.push(modes[m].toString(16)+"/"+shape+":"+c.value+"/"+c.high+
        "e"+e+"c"+changed+"="+hex);
    }
  }finally{for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];}
  var q=n.call("getpid",[]);
  var restored=q.high===0&&q.value===p.value&&s.array[0]===s.a&&
    saved.every(function(v,i){return f[0x1800+i]===v;});
  result={id:"aio669_mode_gate_v1",status:guard&&restored?"pass":"fail",
    details:{pid:p.value,rows:rows.join("|"),guard:guard,restored:restored}};
}catch(error){result={id:"aio669_mode_gate_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
