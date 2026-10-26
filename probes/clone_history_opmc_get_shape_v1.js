// 14.00 OPMC readback shape census. Four calls, each with its own marker.
var result, phase="preflight";
try {
  var n=window.__fw14NativeInvoke, s=window.__fw14ArrayState;
  if(!n||!n.wrappers||typeof n.wrappers.sys567!=="number"||
     !n.frame||n.frame.length<0x1840||!Number.isSafeInteger(n.frameAddress)||
     !s||s.array[0]!==s.a) throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress,p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000) throw new Error("pid_invalid");
  var saved=Array.from(f.subarray(0x1800,0x1840));
  var rows=[], guard=true;
  try {
    var shapes=[[0,a+0x1800],[1,a+0x1800],[a+0x1800,0],[a+0x1800,1]];
    for(var j=0;j<shapes.length;j++){
      phase="shape_"+j;
      f.fill(0xa5,0x1800,0x1840);
      if(api&&api.markSync) api.markSync("opmc_get_before_"+j);
      var c=n.call("sys567",[shapes[j][0],shapes[j][1],0,0,0,0]);
      var e=c.value===-1?n.readErrno():0;
      var changed=0, hex="";
      for(var k=0;k<16;k++){
        if(f[0x1800+k]!==0xa5) changed++;
        hex+=("0"+f[0x1800+k].toString(16)).slice(-2);
      }
      for(var g=0x1810;g<0x1840;g++) if(f[g]!==0xa5) guard=false;
      rows.push(j+":"+c.value+"/"+c.high+"e"+e+"c"+changed+"="+hex);
    }
  } finally {
    for(var r=0;r<saved.length;r++) f[0x1800+r]=saved[r];
  }
  var q=n.call("getpid",[]);
  var restored=q.high===0&&q.value===p.value&&s.array[0]===s.a&&
    saved.every(function(v,i){return f[0x1800+i]===v;});
  result={id:"opmc_get_shape_v1",status:guard&&restored?"pass":"fail",
    details:{pid:p.value,rows:rows.join("|"),guard:guard,restored:restored}};
} catch(error) {
  result={id:"opmc_get_shape_v1",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
