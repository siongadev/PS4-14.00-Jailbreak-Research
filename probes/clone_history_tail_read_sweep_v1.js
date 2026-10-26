// Fresh 14.00 wrappers 671/672/674/677: zero and owned-output shapes.
// Every call has a marker, so an interrupted run identifies its entry.
var result,phase="preflight";
try{
  var n=window.__fw14NativeInvoke,s=window.__fw14ArrayState;
  var nums=[671,672,674,677];
  if(!n||!n.wrappers||!n.frame||n.frame.length<0x1b00||
     !Number.isSafeInteger(n.frameAddress)||!s||s.array[0]!==s.a||
     nums.some(function(v){return typeof n.wrappers["sys"+v]!=="number";}))
    throw new Error("plan_missing");
  var f=n.frame,a=n.frameAddress,p=n.call("getpid",[]);
  if(p.high!==0||p.value<1||p.value>100000)throw new Error("pid_invalid");
  var saved=Array.from(f.subarray(0x1800,0x1b00)),rows=[],guard=true;
  try{
    for(var i=0;i<nums.length;i++)for(var shape=0;shape<2;shape++){
      phase="sys"+nums[i]+"_shape"+shape;
      f.fill(0xa5,0x1800,0x1b00);
      f[0x1900]=0x20;f[0x1901]=f[0x1902]=f[0x1903]=0;
      var args=shape===0?[0,0,0,0,0,0]:
        [a+0x1800,0x100,a+0x1900,0,0,0];
      if(api&&api.markSync)api.markSync("tail_"+nums[i]+"_"+shape);
      var c=n.call("sys"+nums[i],args);
      var e=c.value===-1?n.readErrno():0,changed=0,hex="";
      for(var j=0;j<32;j++){
        if(f[0x1800+j]!==0xa5)changed++;
        if(j<8)hex+=("0"+f[0x1800+j].toString(16)).slice(-2);
      }
      for(var g=0x1a00;g<0x1b00;g++)if(f[g]!==0xa5)guard=false;
      var count=f[0x1900]+f[0x1901]*256+f[0x1902]*65536+f[0x1903]*16777216;
      rows.push(nums[i]+"/"+shape+":"+c.value+"/"+c.high+"e"+e+
        "c"+changed+"n"+count+"="+hex);
    }
  }finally{for(var r=0;r<saved.length;r++)f[0x1800+r]=saved[r];}
  var q=n.call("getpid",[]);
  var restored=q.high===0&&q.value===p.value&&s.array[0]===s.a&&
    saved.every(function(v,i){return f[0x1800+i]===v;});
  result={id:"tail_read_sweep_v1",status:guard&&restored?"pass":"fail",
    details:{pid:p.value,rows:rows.join("|"),guard:guard,restored:restored}};
}catch(error){result={id:"tail_read_sweep_v1",status:"error",
  details:{phase:phase,error:String(error).slice(0,180)}};}
return [result];
